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
  context: async ({ req, res, payload }) => {
    const loaders = createLoaders();
    let currentUser = null;

    // handle authentication for requests made via both http and ws
    const wsToken = payload ? payload.authToken : '';
    const reqToken = req ? req.headers.authorization.split(' ')[1] : '';
    currentUser = wsToken
      ? await getCurrentUser(wsToken, loaders.users)
      : reqToken
      ? await getCurrentUser(reqToken, loaders.users)
      : null;

    console.log({ wsToken, reqToken });

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
