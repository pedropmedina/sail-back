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
    const condition = req.to === to && req.reqType === reqType;
    return cb && typeof cb === 'function' && condition ? cb(req) : condition;
  });
};

const _checkForExistingFriendReq = async (input, currentUser, models) => {
  const fromUser = await models.User.populate(currentUser, 'sentRequests');
  const toUser = await models.User.findOne({ username: input.to })
    .populate('sentRequests')
    .exec();

  // check if either user has already sent request
  const hasReq1 = _hasSentReq(fromUser.sentRequests, toUser.username, 'FRIEND');
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
    toUser.username,
    'INVITE',
    req => req.plan.equals(input.plan)
  );
  const hasReq2 = _hasSentReq(
    toUser.sentRequests,
    fromUser.username,
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
    req.to === currentUser.username || req.author._id.equals(currentUser._id)
  );
};

const getRequests = authorize(
  async (_, { reqType }, { models, currentUser }) => {
    try {
      const { _id, username } = currentUser;
      let requests;

      switch (reqType) {
        case 'FRIEND':
        case 'INVITE':
          requests = await models.Request.find({
            $and: [{ reqType }, { $or: [{ author: _id }, { to: username }] }]
          })
            .populate('author')
            .exec();
          break;
        default:
          requests = await models.Request.find({
            $or: [{ author: _id }, { to: username }]
          })
            .populate('author')
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

      // return req with populated author
      const populatePaths = [{ path: 'author' }];
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
        .exec();

      // update users and plan documents given the request type
      if (currentUser.username === req.to) {
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
              $push: { participants: currentUser.username },
              $pull: { invites: currentUser.username }
            }).exec();
            await models.Conversation.findByIdAndUpdate(plan.chat, {
              $push: {
                participants: currentUser.username,
                unreadCount: { username: currentUser.username }
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
        req = await models.Request.populate(req, [{ path: 'author' }]);
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
  FriendRequest: {
    to: async (root, _, { models }) => {
      return await models.User.findOne({ username: root.to }).exec();
    }
  },
  InviteRequest: {
    plan: async ({ plan, reqType }, _, { models }) => {
      if (reqType === 'INVITE') {
        const p = await models.Plan.findById(plan).exec();
        return p;
      }
    },
    to: async (root, _, { models }) => {
      return await models.User.findOne({ username: root.to }).exec();
    }
  }
};
