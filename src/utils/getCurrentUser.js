const jwt = require('jsonwebtoken');

const accessTokenSecret = process.env.ACCESS_JWT_SECRET;

module.exports = async (token, usersLoader) => {
  try {
    const { userId } = jwt.verify(token, accessTokenSecret);
    return await usersLoader.load(userId);
  } catch (error) {
    console.error('Error getting current user: ', error);
  }
};
