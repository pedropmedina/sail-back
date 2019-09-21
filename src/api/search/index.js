module.exports = {
  typeDefs: require('../../utils/loadGraphql')('search/search.graphql'),
  resolvers: require('./search.resolvers')
};
