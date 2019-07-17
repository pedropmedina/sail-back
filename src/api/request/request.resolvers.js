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
      return await models.Request().populate(request, 'author');
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
      // pull request's id from users document
      await currentUser
        .updateOne({ $pull: { sentRequests: request._id } })
        .exec();
      await models.User.updateMany(
        { receivedRequests: { $in: [request._id] } },
        { $pull: { receivedRequest: request._id } }
      ).exec();
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
    __resolveType({ requestType }) {
      switch (requestType) {
        case 'INVITE':
          return 'InviteRequest';
        case 'FRIEND':
          return 'FriendRequest';
        default:
          return null;
      }
    },
    plan: async ({ plan, requestType }, _, { models }) => {
      if (requestType === 'INVITE') {
        return await models.Plan.findById(plan).exec();
      }
    }
  }
};
