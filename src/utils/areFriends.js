module.exports = (friendsIds, userId) => friendsIds.some(f => f.equals(userId));
