module.exports = async (userId, usersLoader) => {
  try {
    return await usersLoader.load(userId);
  } catch (error) {
    console.error('Error getting current user: ', error);
  }
};
