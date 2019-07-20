const { ApolloError } = require('apollo-server');
const authorize = require('../../utils/authorize');
const grantAdminAccess = require('../../utils/grantAdminAccess');

const _hasReceivedReq = (userDoc, currentUserId, reqType, cb) => {
  return userDoc.receivedRequests.some(
    req =>
      req.author.toString() === currentUserId.toString() &&
      req.requestType === reqType &&
      (cb && typeof cb === 'function' && cb(req))
  );
};

const _hasSentReq = (userDoc, toUserId, reqType) => {
  return userDoc.sentRequests.some(
    req => req.to.toString() === toUserId && req.requestType === reqType
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
      switch (input.requestType) {
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
      const request = await new models.Request({
        ...input,
        author: currentUser._id
      }).save();
      // push request in author's sentRequests array
      currentUser.sentRequests.push(request._id);
      await currentUser.save();
      // find users to whom request has been sent and
      // push requst into their receivedRequest's array
      await models.User.updateMany(
        { _id: { $in: request.to } },
        { $push: { receivedRequests: request._id } }
      );
      // return request with populated author
      const populatePaths = [{ path: 'author' }, { path: 'to' }];
      return await models.Request.populate(request, populatePaths);
    } catch (error) {
      console.error('Error while creating invite ', error);
      throw error;
    }
  }
);

const updateRequest = authorize(
  async (_, { input: { requestId, ...update } }, { models }) => {
    try {
      return await models.Request.findByIdAndUpdate(requestId, update, {
        new: true
      })
        .populate('author')
        .exec();
    } catch (error) {
      console.error('Error while updating invite ', error);
      throw error;
    }
  }
);

const deleteRequest = authorize(
  async (_, { requestId }, { models, currentUser }) => {
    try {
      const request = await models.Request.findOneAndDelete({
        _id: requestId,
        author: currentUser._id
      }).exec();
      // pull request's id from request's owner sentRequest's array
      await currentUser
        .updateOne({ $pull: { sentRequests: request._id } })
        .exec();
      // pull request from users to whom request was sent to
      await models.User.updateMany(
        { receivedRequests: { $in: [request._id] } },
        { $pull: { receivedRequests: request._id } }
      ).exec();
      return true;
    } catch (error) {
      console.error('Error while deleting invite ', error);
      throw error;
    }
  }
);

const acceptFriendRequest = authorize(
  async (_, { requestId }, { models, currentUser }) => {
    const request = await models.Request.findById(requestId).exec();
    // update request status and persist changes
    request.status = 'ACCEPTED';
    await request.save();
    const { to, status, requestType, author } = request;
    // make sure the request was accepted and is of type friend
    if (!(status === 'ACCEPTED' && requestType === 'FRIEND')) {
      throw new ApolloError('Incorrect request status and/or type!');
    }
    // update friends array for current user's accepting request and
    // remove request from receivedRequests array
    currentUser.friends = [...currentUser.friends, author];
    currentUser.receivedRequests = currentUser.receivedRequests.filter(
      req => req.toString() !== requestId.toString()
    );
    // update friends array for the author of the request and
    // pull the request from sentRequests arrray
    await models.User.findByIdAndUpdate(author, {
      $push: { friends: to },
      $pull: { sentRequests: requestId }
    }).exec();
    await currentUser.save();
    return true;
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
    acceptFriendRequest
  },
  Request: {
    __resolveType({ requestType }) {
      switch (requestType) {
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
    plan: async ({ plan, requestType }, _, { models }) => {
      if (requestType === 'INVITE') {
        return await models.Plan.findById(plan).exec();
      }
    }
  }
};
