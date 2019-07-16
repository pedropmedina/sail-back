module.exports = {
  typeDefs: require('../../utils/loadGraphql')(
    'conversation/conversation.graphql'
  ),
  resolvers: require('./conversation.resolvers'),
  model: require('./conversation.model')
};
