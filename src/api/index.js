const merge = require('lodash/merge');
const { GraphQLJSONObject } = require('graphql-type-json');

// api
const plan = require('./plan');
const conversation = require('./conversation');
const message = require('./message');
const request = require('./request');
const pin = require('./pin');
const comment = require('./comment');
const user = require('./user');
const search = require('./search');

// dataloaders
const createLoaders = require('./loaders');

// utilities
const getCurrentUser = require('../utils/getCurrentUser');

module.exports = {
  typeDefs: [
    plan.typeDefs,
    conversation.typeDefs,
    message.typeDefs,
    request.typeDefs,
    pin.typeDefs,
    comment.typeDefs,
    user.typeDefs,
    search.typeDefs
  ].join(' '),
  resolvers: merge(
    { JSONObject: GraphQLJSONObject },
    plan.resolvers,
    conversation.resolvers,
    message.resolvers,
    request.resolvers,
    pin.resolvers,
    comment.resolvers,
    user.resolvers,
    search.resolvers
  ),
  subscriptions: {
    onConnect: async connectionParams => {
      // pass token down in the connection.context obj
      const token = connectionParams.authToken || '';
      return { token };
    }
  },
  context: async ({ req, res, connection }) => {
    const loaders = createLoaders();
    let currentUser = null;

    // handle authentication for requests made via websocket
    if (connection && connection.context.token) {
      const token = connection.context.token;
      currentUser = await getCurrentUser(token, loaders.users);
    }

    // handle authentication for requests made via http
    if (req && req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1] || '';
      currentUser = await getCurrentUser(token, loaders.users);
    }

    return {
      req,
      res,
      currentUser,
      models: {
        Plan: plan.model,
        Conversation: conversation.model,
        Message: message.model,
        Request: request.model,
        Pin: pin.model,
        Comment: comment.model,
        User: user.model
      },
      loaders
    };
  }
};
