const { ApolloError } = require('apollo-server');
const authorize = require('../../utils/authorize');
const areFriends = require('../../utils/areFriends');

const _hasReceivedReq = (userDoc, currentUserId, reqType, cb) => {
  return userDoc.receivedRequests.some(req => {
    const condition =
      req.author.toString() === currentUserId.toString() &&
      req.reqType === reqType;
    return cb && typeof cb === 'function' && condition ? cb(req) : condition;
  });
};

const _hasSentReq = (userDoc, toUserId, reqType, cb) => {
  return userDoc.sentRequests.some(req => {
    const condition =
      req.to.toString() === toUserId.toString() && req.reqType === reqType;
    return cb && typeof cb === 'function' && condition ? cb(req) : condition;
  });
};

const _checkForExistingFriendReq = async (input, currentUser, models) => {
  const toUser = await models.User.findOne({ email: input.to })
    .populate('receivedRequests')
    .exec();
  const fromUser = await models.User.populate(currentUser, 'sentRequests');

  const existingReceivedReq = _hasReceivedReq(
    toUser,
    currentUser._id,
    'FRIEND'
  );
  const existingSentReq = _hasSentReq(fromUser, toUser._id, 'FRIEND');

  const alreadyFriends = areFriends(
    toUser.friends,
    fromUser.friends,
    currentUser._id,
    toUser._id
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
  const toUser = await models.User.findOne({ email: input.to })
    .populate('receivedRequests')
    .exec();
  const fromUser = await models.User.populate(currentUser, 'sentRequests');

  // make sure the request is only made to friends
  const isFriend = areFriends(
    toUser.friends,
    fromUser.friends,
    currentUser._id,
    toUser._id
  );

  if (!isFriend) {
    throw new ApolloError('Must be a friend first to sent invite!');
  }

  const existingReceivedReq = _hasReceivedReq(
    toUser,
    currentUser._id,
    'INVITE',
    req => req.plan.toString() === input.plan.toString()
  );
  const existingSentReq = _hasSentReq(
    fromUser,
    toUser._id,
    'INVITE',
    req => req.plan.toString() === input.plan.toString()
  );

  if (existingReceivedReq || existingSentReq) {
    console.error('Invite request already made!');
    throw new ApolloError(
      'Invite request already exist for selected user and plan!'
    );
  }
};

const getRequests = authorize(async (_, __, { models, currentUser }) => {
  try {
    return await models.Request.find({
      $or: [{ author: currentUser._id }, { to: currentUser.email }]
    })
      .populate('author')
      .exec();
  } catch (error) {
    console.error('Error while getting invites', error);
    throw error;
  }
});

const getRequest = authorize(async (_, { reqId }, { models }) => {
  try {
    return await models.Request.findById(reqId)
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
          throw new ApolloError('Invalid request type!');
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
      await models.User.findOneAndUpdate(
        { email: req.to },
        {
          $push: { receivedRequests: req._id }
        }
      );
      // return req with populated author
      const populatePaths = [{ path: 'author' }];
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
      let req = await models.Request.findById(reqId)
        .populate('author')
        .exec();
      // if currentUser == req.to
      // 1 - update req.status
      // and reqType === FRIEND
      // and if req's status == ACCEPTED
      // 1 - push req.author into currentUser's friends and remove reqId from receivedRequests
      // 2 - push req.to into req.author's friends
      // and if req's status == DENIED
      // 1 - remove reqId from currentUser's receivedRequests

      // if currentUser == req.to
      // and reqType === INVITE
      // and if req's status === ACCEPTED
      // 1 - push currentUser._id into plan.participants
      // 2 - remove req from currentUser.receivedRequests
      // and if req's status === DENIED
      // 1 - remove req from currentUser.receivedRequests

      if (currentUser.email === req.to) {
        req.status = status;
        if (req.reqType === 'FRIEND') {
          if (req.status === 'ACCEPTED') {
            await currentUser
              .updateOne({
                $push: { friends: req.author._id },
                $pull: { receivedRequests: reqId }
              })
              .exec();
            await models.User.findByIdAndUpdate(req.author._id, {
              $push: { friends: currentUser._id }
            });
          } else if (req.status === 'DENIED') {
            await currentUser.updateOne({
              $pull: { receivedRequests: reqId }
            });
          }
        } else if (req.reqType === 'INVITE') {
          if (req.status === 'ACCEPTED') {
            await models.Plan.findByIdAndUpdate(req.plan, {
              $push: { participants: currentUser._id }
            }).exec();
            await currentUser
              .updateOne({
                $pull: { receivedRequests: reqId },
                $push: { inPlans: req.plan }
              })
              .exec();
          } else if (req.status === 'DENIED') {
            await currentUser
              .updateOne({ $pull: { receivedRequests: reqId } })
              .exec();
          }
        }
        req = await req.save();
        req = await models.Request.populate(req, [{ path: 'author' }]);
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

      if (!req) {
        throw new ApolloError('Unauthorized action!');
      }

      // pull request's id from request's owner sentRequests' array
      await currentUser
        .updateOne({
          $pull: { sentRequests: req._id }
        })
        .exec();
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
    deleteRequest
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
  FriendRequest: {
    to: async (root, _, { models }) => {
      return await models.User.findOne({ email: root.to }).exec();
    }
  },
  InviteRequest: {
    plan: async ({ plan, reqType }, _, { models }) => {
      if (reqType === 'INVITE') {
        return await models.Plan.findById(plan).exec();
      }
    },
    to: async (root, _, { models }) => {
      return await models.User.findOne({ email: root.to }).exec();
    }
  }
};
