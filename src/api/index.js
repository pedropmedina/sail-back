const merge = require('lodash/merge');

// api
const pin = require('./pin');

module.exports = {
  typeDefs: [pin.typeDefs].join(' '),
  resolvers: merge({}, pin.resolvers),
  context: {
    models: {
      Pin: pin.model
    }
  }
};
