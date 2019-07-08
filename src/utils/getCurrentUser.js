const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET;

module.exports = async (token, userModel) => {
  try {
    // verify token
    const { payload } = jwt.verify(token, secret);
    // query user in db with id in token's payload
    const currentUser = await userModel.findById(payload).exec();
    // return user to be set in ctx
    return currentUser;
  } catch (error) {
    console.error('Error while getting current user');
  }
};
