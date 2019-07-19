const { ApolloError } = require('apollo-server');
const authorize = require('../../utils/authorize');
const grantAdminAccess = require('../../utils/grantAdminAccess');

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
      return await models.Request.populate(request, 'author');
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
    const { to, status, requestType, author } = request;
    // make sure the request was accepted and is of type friend
    if (!(status === 'ACCEPTED' && requestType === 'FRIEND')) {
      throw new ApolloError('Incorrect request status and/or type!');
    }
    // update friends array for current user's accepting request
    currentUser.friends = [...currentUser.friends, author];
    // update friends array for the author of the request
    await models.User.findByIdAndUpdate(author, {
      $push: { friends: to }
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
