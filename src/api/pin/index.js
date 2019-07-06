module.exports = {
  typeDefs: require('../../utils/loadGraphql')('pin/pin.graphql'),
  resolvers: require('./pin.resolvers'),
  model: require('./pin.model')
};
