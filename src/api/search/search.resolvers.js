const authorize = require('../../utils/authorize');

const search = authorize(async (_, { searchText }, { models }) => {
  const plans = models.Plan.find({ $text: { $search: searchText } })
    .populate({ path: 'location', populate: { path: 'comments' } })
    .populate({
      path: 'chat',
      populate: [
        { path: 'author' },
        { path: 'messages', populate: 'author' },
        { path: 'plan' }
      ]
    })
    .populate('author')
    .exec();

  const pins = models.Pin.find({ $text: { $search: searchText } })
    .populate('author')
    .populate({ path: 'comments', populate: { path: 'author' } })
    .exec();

  const users = models.User.find({ $text: { $search: searchText } })
    .populate('myPlans')
    .populate('inPlans')
    .populate({
      path: 'pins',
      populate: { path: 'comments' }
    })
    .populate('likedPins')
    .populate('friends')
    .populate({ path: 'sentRequests', populate: { path: 'author' } })
    .populate({ path: 'receivedRequests', populate: { path: 'author' } })
    .exec();

  const results = await Promise.all([plans, pins, users]);
  return results.flat();
});

const searchFriends = authorize(async (_, __, { models, currentUser }) => {
  const user = await models.User.populate(currentUser, [
    { path: 'friends', populate: 'friends' }
  ]);
  return user.friends;
});

const searchPeople = authorize(async (_, { searchText }, { models }) => {
  const users = await models.User.find({ $text: { $search: searchText } })
    .populate('friends')
    .exec();

  return users;
});

module.exports = {
  Query: {
    search,
    searchFriends,
    searchPeople
  },
  Result: {
    __resolveType(obj) {
      if (obj.title && obj.description) return 'Plan';
      if (obj.title && obj.content) return 'Pin';
      if (obj.username || obj.email) return 'User';
      return null;
    }
  }
};
