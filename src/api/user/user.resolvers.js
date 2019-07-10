const { AuthenticationError } = require('apollo-server');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// utils
const grantAdminAccess = require('../../utils/grantAdminAccess');
const grantOwnerAccess = require('../../utils/grantOwnerAccess');

const secret = process.env.JWT_SECRET;

// sign up new user
const signupUser = async (_, { input: { username, password } }, { models }) => {
  try {
    // check if username already exists
    let user = await models.User.findOne({ username }).exec();
    if (user) throw new AuthenticationError('User alredy registered!');

    // enctrypt password
    if (password.length < 6)
      throw new AuthenticationError(
        'Password must be at least 6 characters long!'
      );
    const hash = await bcrypt.hash(password, 10);

    // create user
    user = new models.User({ username, password: hash });
    await user.save();

    // generate token to be sent to the user
    const token = jwt.sign({ payload: user._id }, secret, {
      expiresIn: '1 day'
    });

    // return auth schema to the client
    return {
      token,
      user
    };
  } catch (error) {
    console.error('Error while signing up: ', error.message);
    throw error;
  }
};

// login existing user
const loginUser = async (_, { input: { username, password } }, { models }) => {
  try {
    // check for user in db
    const user = await models.User.findOne({ username }).exec();
    if (!user) throw new AuthenticationError('Wrong credentials.');

    // validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new AuthenticationError('Wrong credentials.');

    // generate token
    const token = jwt.sign({ payload: user._id }, secret, {
      expiresIn: '1 day'
    });

    // return auth schema to client
    return {
      token,
      user
    };
  } catch (error) {
    console.error('Error while logging user: ', error.message);
    throw error;
  }
};

// logout user and blacklist token
const logoutUser = async (_, { token }, { models }) => {
  try {
    await new models.BlacklistedToken({ token }).save();
    return true;
  } catch (error) {
    console.error('Error while blacklisting token: ', error.message);
  }
};

const getUsers = grantAdminAccess(async (_, __, { models }) => {
  try {
    const users = await models.User.find({}).exec();
    return users;
  } catch (error) {
    console.error('Error while getting users', error);
  }
});

const getUser = grantOwnerAccess(async (_, { id }, { models }) => {
  try {
    const user = await models.User.finById(id).exec();
    return user;
  } catch (error) {
    console.error('Error while getting user', error);
    return error;
  }
});

const updateUser = grantOwnerAccess(
  async (_, { id, ...update }, { models }) => {
    try {
      const user = await models.User.findByIdAndUpdate(id, update, {
        new: true
      }).exec();
      return user;
    } catch (error) {
      console.error('Error while updating user', error);
    }
  }
);

const deleteUser = grantOwnerAccess(async (_, { id }, { models }) => {
  try {
    const user = await models.User.findByIdAndDelete(id).exec();
    return user;
  } catch (error) {
    console.error('Error while deleting user', error);
  }
});

module.exports = {
  Query: {
    getUsers,
    getUser
  },
  Mutation: {
    signupUser,
    loginUser,
    logoutUser,
    updateUser,
    deleteUser
  }
};
