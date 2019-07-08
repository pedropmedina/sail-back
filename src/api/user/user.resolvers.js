const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// utils
const grantAdminAccess = require('../../utils/grantAdminAccess');
const grantOwnerAccess = require('../../utils/grantOwnerAccess');

const secret = process.env.JWT_SECRET;

// sign up new user
const signupUser = async (_, { username, password }, { User }) => {
  try {
    // check if username already exists
    let user = await User.findOne({ username }).exec();
    if (user) return 'Username is taken!';

    // enctrypt password
    const hash = bcrypt.hash(password, 10);

    // create user
    user = new User({ username, password: hash });
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
    console.error('Error while signing up user');
  }
};

// login existing user
const loginUser = async (_, { username, password }, { User }) => {
  try {
    // check for user in db
    const user = await User.findOne({ username }).exec();
    if (!user) return 'Wrong credentials.';

    // validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return 'Wrong credentials.';

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
    return console.error('Error while logging user', error);
  }
};

// logout user and blacklist token
const logoutUser = async (_, { token }, { BlacklistedToken }) => {
  try {
    await new BlacklistedToken({ token }).save();
    return true;
  } catch (error) {
    console.error('Error while blacklisting token', error);
  }
};

const getUsers = grantAdminAccess(async (_, __, { User }) => {
  try {
    const users = await User.find({}).exec();
    return users;
  } catch (error) {
    console.error('Error while getting users', error);
  }
});

const getUser = grantOwnerAccess(async (_, { id }, { User }) => {
  try {
    const user = await User.finById(id).exec();
    return user;
  } catch (error) {
    console.error('Error while getting user', error);
  }
});

const updateUser = grantOwnerAccess(async (_, { id, ...update }, { User }) => {
  try {
    const user = await User.findByIdAndUpdate(id, update, { new: true }).exec();
    return user;
  } catch (error) {
    console.error('Error while updating user', error);
  }
});

const deleteUser = grantOwnerAccess(async (_, { id }, { User }) => {
  try {
    const user = await User.findByIdAndDelete(id).exec();
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
