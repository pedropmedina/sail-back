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
  context: async ({ req }) => {
    let currentUser = null;
    try {
      // get the user token from the headers
      const auth = req.headers.authorization || '';
      const token = auth ? auth.split(' ')[1] : null;
      // if token, find user, else user === null
      currentUser = token && (await getCurrentUser(token, user.model.User));
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
