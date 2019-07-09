module.exports = {
  typeDefs: require('../../utils/loadGraphql')('api/comment.graphql'),
  resolvers: require('./comment.resolvers'),
  model: require('./comment.model')
};
