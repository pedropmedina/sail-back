const { AuthenticationError } = require('apollo-server');
const merge = require('lodash/merge');

// api
const plan = require('./plan');
const conversation = require('./conversation');
const message = require('./message');
const invite = require('./invite');
const pin = require('./pin');
const comment = require('./comment');
const user = require('./user');

// dataloaders
const loaders = require('./loaders');

// utilities
const getCurrentUser = require('../utils/getCurrentUser');

module.exports = {
  typeDefs: [
    plan.typeDefs,
    conversation.typeDefs,
    message.typeDefs,
    invite.typeDefs,
    pin.typeDefs,
    comment.typeDefs,
    user.typeDefs
  ].join(' '),
  resolvers: merge(
    {},
    plan.resolvers,
    conversation.resolvers,
    message.resolvers,
    invite.resolvers,
    pin.resolvers,
    comment.resolvers,
    user.resolvers
  ),
  subscriptions: {
    onConnect: async connectionParams => {
      const { users } = loaders();
      const auth = connectionParams.authorization || '';
      if (auth) {
        const token = auth.split(' ')[1];
        const currentUser = await getCurrentUser(token, users);
        return { currentUser };
      }
      throw new AuthenticationError('Missing authorization token');
    }
  },
  context: async ({ req, connection }) => {
    const { users } = loaders();
    let currentUser = null;
    let token = null;
    try {
      if (connection) {
        // get currentUser over websocket
        currentUser = connection.context.currentUser;
      } else {
        // get the token over http
        const auth = req.headers.authorization || '';
        token = auth && auth.split(' ')[1];
        currentUser = token && (await getCurrentUser(token, users));
      }
    } catch (error) {
      console.log('Error while getting current user!', error);
      throw error;
    }
    return {
      currentUser,
      models: {
        Plan: plan.model,
        Conversation: conversation.model,
        Message: message.model,
        Invite: invite.model,
        Pin: pin.model,
        Comment: comment.model,
        User: user.model.User,
        BlacklistedToken: user.model.BlacklistedToken
      },
      loaders: { users }
    };
  }
};
