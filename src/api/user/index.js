module.exports = {
  typeDefs: require('../../utils/loadGraphql')('user/user.graphql'),
  resolvers: require('./user.resolvers'),
  model: require('./user.model')
};
