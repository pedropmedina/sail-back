module.exports = {
  typeDefs: require('../../utils/loadGraphql')('message/message.graphql'),
  resolvers: require('./message.resolvers'),
  model: require('./message.model')
};
