const merge = require('lodash/merge');

// api
const pin = require('./pin');
const user = require('./user');

// utilities
const getCurrentUser = require('../utils/getCurrentUser');

module.exports = {
  typeDefs: [pin.typeDefs].join(' '),
  resolvers: merge({}, pin.resolvers),
  context: ({ req }) => {
    // get the user token from the headers
    const token = req.headers.authorization || '';
    // if token, find user, else user === null
    const currentUser = token ? getCurrentUser(token, user.model.User) : null;
    return {
      currentUser,
      models: {
        Pin: pin.model,
        User: user.model.User,
        BlacklistedToken: user.model.BlacklistedToken
      }
    };
  }
};
