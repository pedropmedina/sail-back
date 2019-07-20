const { ApolloError } = require('apollo-server');
const authorize = require('../../utils/authorize');
const grantAdminAccess = require('../../utils/grantAdminAccess');

const _hasReceivedReq = (userDoc, currentUserId, reqType, cb) => {
  return userDoc.receivedRequests.some(
    req =>
      req.author.toString() === currentUserId.toString() &&
      req.reqType === reqType &&
      (cb && typeof cb === 'function' && cb(req))
  );
};

const _hasSentReq = (userDoc, toUserId, reqType) => {
  return userDoc.sentRequests.some(
    req => req.to.toString() === toUserId && req.reqType === reqType
  );
};

const _areFriends = (friends1, friends2, userId1, userId2) => {
  return (
    friends1.some(f => f.toString() === userId1.toString()) &&
    friends2.some(f => f.toString() === userId2.toString())
  );
};

const _checkForExistingFriendReq = async (input, currentUser, models) => {
  const toUser = await models.User.findById(input.to)
    .populate('receivedRequests')
    .exec();
  const fromUser = await models.User.populate(currentUser, 'sentRequests');

  const existingReceivedReq = _hasReceivedReq(
    toUser,
    currentUser._id,
    'FRIEND'
  );
  const existingSentReq = _hasSentReq(fromUser, input.to, 'FRIEND');

  const alreadyFriends = _areFriends(
    toUser.friends,
    fromUser.friends,
    currentUser._id,
    input.to
  );

  if (alreadyFriends) {
    console.error('Already friends');
    throw new ApolloError('Already existing friends!');
  }

  if (existingReceivedReq || existingSentReq) {
    console.error('friend request already made!');
    throw new ApolloError('Friend request already has been made!');
  }
};

const _checkForExistingInviteReq = async (input, currentUser, models) => {
  const toUser = await models.User.findById(input.to)
    .populate('receivedRequests')
    .exec();
  const fromUser = await models.User.populate(currentUser, 'sentRequests');

  const existingReceivedReq = _hasReceivedReq(
    toUser,
    currentUser._id,
    'INVITE',
    req => req.plan.toString() === input.plan
  );
  const existingSentReq = _hasSentReq(
    fromUser,
    input.to,
    'INVITE',
    req => req.plan.toString() === input.plan
  );

  if (existingReceivedReq || existingSentReq) {
    console.error('Invite request already made!');
    throw new ApolloError(
      'Invite request already exist for selected user and plan!'
    );
  }
};

const getRequests = grantAdminAccess(async (_, __, { models }) => {
  try {
    return await models.Request.find({})
      .populate('author')
      .exec();
  } catch (error) {
    console.error('Error while getting invites', error);
    throw error;
  }
});

const getRequest = authorize(async (_, { requestId }, { models }) => {
  try {
    return await models.Request.findById(requestId)
      .populate('author')
      .exec();
  } catch (error) {
    console.error('Error while getting invite ', error);
    throw error;
  }
});

const createRequest = authorize(
  async (_, { input }, { models, currentUser }) => {
    try {
      switch (input.reqType) {
        case 'FRIEND':
          await _checkForExistingFriendReq(input, currentUser, models);
          break;
        case 'INVITE':
          await _checkForExistingInviteReq(input, currentUser, models);
          break;
        default:
          break;
      }

      // instantiate request model and save
      const req = await new models.Request({
        ...input,
        author: currentUser._id
      }).save();
      // push req in author's sentRequests array
      currentUser.sentRequests.push(req._id);
      await currentUser.save();
      // find users to whom req has been sent and
      // push request into their receivedRequest's array
      await models.User.findByIdAndUpdate(req.to, {
        $push: { receivedRequests: req._id }
      });
      // return req with populated author
      const populatePaths = [{ path: 'author' }, { path: 'to' }];
      return await models.Request.populate(req, populatePaths);
    } catch (error) {
      console.error('Error while creating invite ', error);
      throw error;
    }
  }
);

const updateRequest = authorize(
  async (_, { input: { reqId, status } }, { models, currentUser }) => {
    try {
      // make sure that status has changed to ACCEPTED or DENIED
      if (status === 'PENDING') {
        throw new ApolloError("Status hasn't changed!");
      }
      // find the request that needs to be updated
      const req = await models.Request.findById(reqId)
        .populate('author')
        .exec();
      // pull request from receivedRequest array and
      // add to friends or confirmedInvites array based on reqType
      if (req.status === 'ACCEPTED') {
        if (req.reqType === 'FRIEND') {
          if (currentUser._id.toString() === req.to.toString()) {
            req.status = status;
            currentUser.friends = [...currentUser.friends, req.author];
            currentUser.receivedRequests = currentUser.receivedRequests.filter(
              req => req.toString() !== reqId.toString()
            );
            await req.save();
          }
        }
      }
      return req;
    } catch (error) {
      console.error('Error while updating invite ', error);
      throw error;
    }
  }
);

const deleteRequest = authorize(
  async (_, { reqId }, { models, currentUser }) => {
    try {
      // delete the request if currenUser is author and status is not PENDING
      const req = await models.Request.findOneAndDelete({
        _id: reqId,
        author: currentUser._id,
        status: { $ne: 'PENDING' }
      }).exec();

      // pull request's id from request's owner sentRequest's array
      if (req.status === 'ACCEPTED') {
        if (req.reqType === 'FRIEND') {
          await currentUser
            .updateOne({
              $pull: { sentRequests: req._id },
              $push: { friends: req.to }
            })
            .exec();
        }
      }
      return true;
    } catch (error) {
      console.error('Error while deleting invite ', error);
      throw error;
    }
  }
);

module.exports = {
  Query: {
    getRequests,
    getRequest
  },
  Mutation: {
    createRequest,
    updateRequest,
    deleteRequest,
  },
  Request: {
    __resolveType({ reqType }) {
      switch (reqType) {
        case 'INVITE':
          return 'InviteRequest';
        case 'FRIEND':
          return 'FriendRequest';
        default:
          return null;
      }
    }
  },
  InviteRequest: {
    plan: async ({ plan, reqType }, _, { models }) => {
      if (reqType === 'INVITE') {
        return await models.Plan.findById(plan).exec();
      }
    }
  }
};
