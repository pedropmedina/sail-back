const { ApolloError, PubSub, withFilter } = require('apollo-server');
const authorize = require('../../utils/authorize');
const areFriends = require('../../utils/areFriends');

// instantiate PubSub making asyncIterator and publish
const pubsub = new PubSub();

// subcriptions event names
const REQUEST_CREATED = 'REQUEST_CREATED';
const REQUEST_UPDATED = 'REQUEST_UPDATED';
const REQUEST_DELETED = 'REQUEST_DELETED';

const _hasSentReq = (reqs, to, reqType, cb) => {
  return reqs.some(req => {
    const condition = req.to.equals(to) && req.reqType === reqType;
    return cb && typeof cb === 'function' && condition ? cb(req) : condition;
  });
};

const _checkForExistingFriendReq = async (input, currentUser, models) => {
  const fromUser = await models.User.populate(currentUser, 'sentRequests');
  const toUser = await models.User.findOne({ username: input.to })
    .populate('sentRequests')
    .exec();

  // check if either user has already sent request
  const hasReq1 = _hasSentReq(fromUser.sentRequests, toUser._id, 'FRIEND');
  const hasReq2 = _hasSentReq(toUser.sentRequests, fromUser._id, 'FRIEND');

  // check if they're alredy friends
  const isFriend1 = areFriends(fromUser.friends, toUser._id);
  const isFriend2 = areFriends(toUser.friends, fromUser._id);

  if (isFriend1 || isFriend2) {
    console.error('Already friends');
    throw new ApolloError('Already existing friends!');
  }

  if (hasReq1 || hasReq2) {
    console.error('friend request already made!');
    throw new ApolloError('Friend request already has been made!');
  }
};

const _checkForExistingInviteReq = async (input, currentUser, models) => {
  const fromUser = await models.User.populate(currentUser, 'sentRequests');
  const toUser = await models.User.findOne({ username: input.to })
    .populate('sentRequests')
    .exec();

  // make sure the request is only made to friends
  const isFriend1 = areFriends(fromUser.friends, toUser._id);
  const isFriend2 = areFriends(toUser.friends, fromUser._id);

  if (!isFriend1 || !isFriend2) {
    throw new ApolloError('Must be a friend first to sent invite!');
  }

  const hasReq1 = _hasSentReq(
    fromUser.sentRequests,
    toUser._id,
    'INVITE',
    req => req.plan.equals(input.plan)
  );
  const hasReq2 = _hasSentReq(
    toUser.sentRequests,
    fromUser._id,
    'INVITE',
    req => req.plan.equals(input.plan)
  );

  if (hasReq1 || hasReq2) {
    console.error('Invite request already made!');
    throw new ApolloError(
      'Invite request already exist for selected user and plan!'
    );
  }
};

const sendDataToCorrenspondingParties = (name, payload, context) => {
  const { currentUser } = context;
  const req = payload[name];
  return (
    req.to.equals(currentUser._id) || req.author._id.equals(currentUser._id)
  );
};

const getRequests = authorize(
  async (_, { reqType }, { models, currentUser }) => {
    try {
      let requests;

      switch (reqType) {
        case 'FRIEND':
        case 'INVITE':
          requests = await models.Request.find({
            $and: [
              { reqType },
              { $or: [{ author: currentUser._id }, { to: currentUser._id }] }
            ]
          })
            .populate('author')
            .populate('to')
            .exec();
          break;
        default:
          requests = await models.Request.find({
            $or: [{ author: currentUser._id }, { to: currentUser._id }]
          })
            .populate('author')
            .populate('to')
            .exec();
          break;
      }
      return requests;
    } catch (error) {
      console.error('Error while getting invites', error);
      throw error;
    }
  }
);

const getRequest = authorize(async (_, { reqId }, { models }) => {
  try {
    return await models.Request.findById(reqId)
      .populate('author')
      .populate('to')
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

      // find to user to update req.to to its _id
      const toUser = await models.User.findOne({ username: input.to }).exec();

      // instantiate request model and save
      const req = await new models.Request({
        ...input,
        to: toUser._id,
        author: currentUser._id
      }).save();
      // push req in author's sentRequests array
      currentUser.sentRequests.push(req._id);
      await currentUser.save();

      // return req with populated author
      const populatePaths = [{ path: 'author' }, { path: 'to' }];
      const requestCreated = await models.Request.populate(req, populatePaths);
      // publish new request
      pubsub.publish(REQUEST_CREATED, { requestCreated });
      return requestCreated;
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
        .populate('to')
        .exec();

      // update users and plan documents given the request type
      if (currentUser._id.equals(req.to._id)) {
        req.status = status;
        if (req.reqType === 'FRIEND') {
          if (req.status === 'ACCEPTED') {
            await currentUser
              .updateOne({
                $push: { friends: req.author._id }
              })
              .exec();
            await models.User.findByIdAndUpdate(req.author._id, {
              $push: { friends: currentUser._id }
            });
          }
        } else if (req.reqType === 'INVITE') {
          if (req.status === 'ACCEPTED') {
            const plan = await models.Plan.findByIdAndUpdate(req.plan, {
              $push: { participants: currentUser._id },
              $pull: { invites: currentUser._id }
            }).exec();
            await models.Conversation.findByIdAndUpdate(plan.chat, {
              $push: {
                participants: currentUser._id,
                unreadCount: { userId: currentUser._id }
              }
            });
            await currentUser
              .updateOne({
                $push: { inPlans: req.plan }
              })
              .exec();
          }
        }
        req = await req.save();
      }
      pubsub.publish(REQUEST_UPDATED, { requestUpdated: req });
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
      // delete the request if currenUser is author
      const req = await models.Request.findOneAndDelete({
        _id: reqId,
        author: currentUser._id
      })
        .populate('author')
        .populate('to')
        .exec();

      if (!req) {
        throw new ApolloError('Unauthorized action!');
      }

      // remove invite from plan.invites
      if (req.reqType === 'INVITE') {
        await models.Plan.findByIdAndUpdate(req.plan, {
          $pull: { invites: req.to }
        }).exec();
      }

      // pull request's id from request's owner sentRequests' array
      await currentUser
        .updateOne({
          $pull: { sentRequests: req._id }
        })
        .exec();
      pubsub.publish(REQUEST_DELETED, { requestDeleted: req });
      return req;
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
  Subscription: {
    requestCreated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(REQUEST_CREATED),
        (payload, _, context) =>
          sendDataToCorrenspondingParties('requestCreated', payload, context)
      )
    },
    requestUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(REQUEST_UPDATED),
        (payload, _, context) =>
          sendDataToCorrenspondingParties('requestUpdated', payload, context)
      )
    },
    requestDeleted: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(REQUEST_DELETED),
        (payload, _, context) =>
          sendDataToCorrenspondingParties('requestDeleted', payload, context)
      )
    }
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
        const p = await models.Plan.findById(plan).exec();
        return p;
      }
    }
  }
};
