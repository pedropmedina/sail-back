module.exports = {
  typeDefs: require('../../utils/loadGraphql')('comment/comment.graphql'),
  resolvers: require('./comment.resolvers'),
  model: require('./comment.model')
};
