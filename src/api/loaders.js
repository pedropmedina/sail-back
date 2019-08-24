const _ = require('lodash');
const DataLoader = require('dataloader');

const { User, BlacklistedToken } = require('./user/user.model');

// dataloader takes an array of keys and returns an array of values
const createUsersLoader = () =>
  new DataLoader(async ids => {
    const users = await User.find({ _id: { $in: ids } }).exec();
    const usersKeyedById = _.keyBy(users, '_id');
    return ids.map(id => usersKeyedById[id]);
  });

const createBlacklistedTokensLoader = () =>
  new DataLoader(async tokens => {
    const foundTokens = await BlacklistedToken.find({ token: { $in: tokens } }).exec(); // prettier-ignore
    const tokensKeyedBytoken = _.keyBy(foundTokens, 'token');
    return tokens.map(token => tokensKeyedBytoken[token]);
  });

module.exports = () => ({
  users: createUsersLoader(),
  tokens: createBlacklistedTokensLoader()
});
