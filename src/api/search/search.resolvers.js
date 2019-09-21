const search = async (_, { searchText }, { models }) => {
  const plans = models.Plan.find({ $text: { $search: searchText } })
    .populate({ path: 'location', populate: { path: 'comments' } })
    .populate('chat')
    .populate('participants')
    .populate('author')
    .exec();

  const pins = models.Pin.find({ $text: { $search: searchText } })
    .populate('author')
    .populate('comments')
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
};

module.exports = {
  Query: {
    search
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
