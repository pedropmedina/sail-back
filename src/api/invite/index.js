module.exports = {
  typeDefs: require('../../utils/loadGraphql')('invite/invite.graphql'),
  resolvers: require('./invite.resolvers'),
  model: require('./invite.model')
};
