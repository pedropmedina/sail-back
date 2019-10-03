const _ = require('lodash');
const DataLoader = require('dataloader');

const User = require('./user/user.model');

// dataloader takes an array of keys and returns an array of values
const createUsersLoader = () =>
  new DataLoader(async ids => {
    const users = await User.find({ _id: { $in: ids } }).exec();
    const usersKeyedById = _.keyBy(users, '_id');
    return ids.map(id => usersKeyedById[id]);
  });

module.exports = () => ({
  users: createUsersLoader()
});
