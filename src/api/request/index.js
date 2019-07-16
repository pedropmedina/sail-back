module.exports = {
  typeDefs: require('../../utils/loadGraphql')('request/request.graphql'),
  resolvers: require('./request.resolvers'),
  model: require('./request.model')
};
