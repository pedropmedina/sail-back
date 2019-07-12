const _ = require('lodash');
const DataLoader = require('dataloader');

const { User } = require('./user/user.model');

// dataloader takes an array of keys and returns an array of values
const createUsersLoader = () =>
  new DataLoader(async usersId => {
    const users = await User.find({ _id: { $in: usersId } }).exec();
    const usersKeyedById = _.keyBy(users, '_id');
    return usersId.map(userId => usersKeyedById[userId]);
  });

module.exports = () => ({
  users: createUsersLoader()
});
