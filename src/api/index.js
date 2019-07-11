const { AuthenticationError } = require('apollo-server');
const merge = require('lodash/merge');

// api
const pin = require('./pin');
const comment = require('./comment');
const user = require('./user');

// utilities
const getCurrentUser = require('../utils/getCurrentUser');

module.exports = {
  typeDefs: [pin.typeDefs, comment.typeDefs, user.typeDefs].join(' '),
  resolvers: merge({}, pin.resolvers, comment.resolvers, user.resolvers),
  subscriptions: {
    onConnect: async connectionParams => {
      const auth = connectionParams.authorization || '';
      if (auth) {
        const token = auth.split(' ')[1];
        const currentUser = await getCurrentUser(token, user.model.User);
        return { currentUser };
      }
      throw new AuthenticationError('Missing authorization token');
    }
  },
  context: async ({ req, connection }) => {
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
        currentUser = token && (await getCurrentUser(token, user.model.User));
      }
    } catch (error) {
      console.log('Error while getting current user!', error);
      throw error;
    }
    return {
      currentUser,
      models: {
        Pin: pin.model,
        Comment: comment.model,
        User: user.model.User,
        BlacklistedToken: user.model.BlacklistedToken
      }
    };
  }
};
