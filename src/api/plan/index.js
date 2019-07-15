module.exports = {
  typeDefs: require('../../utils/loadGraphql')('plan/plan.graphql'),
  resolvers: require('./plan.resolvers'),
  model: require('./plan.model')
};
