const { AuthenticationError } = require('apollo-server');
const bcrypt = require('bcryptjs');

// utils
const grantAdminAccess = require('../../utils/grantAdminAccess');
const authorize = require('../../utils/authorize');
const createToken = require('../../utils/createToken');
const setCookie = require('../../utils/setCookie');

const USER_OPTS = [
  {
    path: 'myPlans',
    populate: [
      { path: 'location' },
      { path: 'participants' },
      { path: 'invites' },
      { path: 'chat' },
      { path: 'author' }
    ]
  },
  {
    path: 'inPlans',
    populate: [
      { path: 'location' },
      { path: 'participants' },
      { path: 'invites' },
      { path: 'chat' },
      { path: 'author' }
    ]
  },
  { path: 'myPins', populate: { path: 'comments', populate: 'author' } },
  { path: 'likedPins', populate: { path: 'comments', populate: 'author' } },
  {
    path: 'friends',
    populate: [{ path: 'friends' }, { path: 'sentRequests' }]
  },
  {
    path: 'sentRequests',
    populate: [{ path: 'author' }, { path: 'to' }, { path: 'plan' }]
  }
];

// sign up new user
const signupUser = async (
  _,
  { input: { email, password } },
  { models, res }
) => {
  try {
    // check if email already exists
    let user = await models.User.findOne({ email }).exec();
    if (user) throw new AuthenticationError('User alredy registered!');

    // enctrypt password
    if (password.length < 6)
      throw new AuthenticationError(
        'Password must be at least 6 characters long!'
      );
    const hash = await bcrypt.hash(password, 10);

    // create user
    user = new models.User({ email, password: hash });
    await user.save();

    // create refresh token and set new cookie
    const refreshToken = createToken(
      { userId: user._id, tokenVersion: user.tokenVersion },
      'refresh'
    );
    const cookiesOptions = { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true };
    setCookie(res, 'refresh-token', refreshToken, cookiesOptions);

    return {
      token: createToken({ userId: user._id }, 'access'),
      user
    };
  } catch (error) {
    console.error('Error while signing up: ', error.message);
    throw error;
  }
};

// login existing user
const loginUser = async (
  _,
  { input: { username, password } },
  { models, res }
) => {
  try {
    // check for user in db
    const user = await models.User.findOne({
      $or: [{ username }, { email: username }]
    });
    if (!user) throw new AuthenticationError('Wrong credentials.');

    // validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new AuthenticationError('Wrong credentials.');

    // create refresh token and set new cookie
    const refreshToken = createToken(
      { userId: user._id, tokenVersion: user.tokenVersion },
      'refresh'
    );
    const cookiesOptions = { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true };
    setCookie(res, 'refresh-token', refreshToken, cookiesOptions);

    return {
      token: createToken({ userId: user._id }, 'access'),
      user: await models.User.populate(user, USER_OPTS)
    };
  } catch (error) {
    console.error('Error while logging user: ', error.message);
    throw error;
  }
};

// access current user's info
const me = authorize(async (_, __, { models, currentUser }) => {
  return await models.User.populate(currentUser, USER_OPTS);
});

// allow admins to access users' info
const getUsers = grantAdminAccess(async (_, __, { models }) => {
  try {
    const users = await models.User.find({}).exec();
    return await models.User.populate(users, USER_OPTS);
  } catch (error) {
    console.error('Error while getting users', error);
  }
});

const getUser = authorize(async (_, { userId, username }, { models }) => {
  try {
    const user = await models.User.findOne({
      $or: [{ _id: userId }, { username }]
    }).exec();
    return await models.User.populate(user, USER_OPTS);
  } catch (error) {
    console.error('Error while getting user', error);
    return error;
  }
});

// iterate over input and update currentUser with provided values
const updateUser = authorize(async (_, { input }, { models, currentUser }) => {
  try {
    for (let prop in input) {
      if (Object.prototype.hasOwnProperty.call(input, prop)) {
        currentUser[prop] = input[prop];
      }
    }
    await currentUser.save();
    return await models.User.populate(currentUser, USER_OPTS);
  } catch (error) {
    console.error('Error while updating user', error);
    throw error;
  }
});

const updateUserPrivacy = authorize(
  async (_, { input }, { models, currentUser }) => {
    try {
      const { username, currentPassword, newPassword } = input;
      // check if username change was required
      if (username !== currentUser.username) {
        const user = await models.User.findOne({ username }).exec();
        if (user) throw new Error('Username name taken!');
        currentUser.username = username;
      }
      if (currentPassword && newPassword) {
        // validate password
        const isPasswordValid = await bcrypt.compare(
          currentPassword,
          currentUser.password
        );
        if (!isPasswordValid) throw new Error('Ivalid password!');
        const hash = await bcrypt.hash(newPassword, 10);
        currentUser.password = hash;
        currentUser.tokenVersion = currentUser.tokenVersion + 1; // increment token version
      }
      await currentUser.save();

      return await models.User.populate(currentUser, USER_OPTS);
    } catch (error) {
      throw error;
    }
  }
);

const deleteUser = authorize(async (_, { userId }, { models }) => {
  try {
    const user = await models.User.findById(userId).exec();
    await user.remove();

    return await models.User.populate(user, USER_OPTS);
  } catch (error) {
    console.error('Error while deleting user', error);
  }
});

const logoutUser = (_, __, { res }) => {
  res.clearCookie('refresh-token', { path: '/' });
  return true;
};

module.exports = {
  Query: {
    me,
    getUsers,
    getUser
  },
  Mutation: {
    signupUser,
    loginUser,
    logoutUser,
    updateUser,
    updateUserPrivacy,
    deleteUser
  },
  User: {
    fullName: root => {
      const { firstName, lastName, username } = root;
      const option1 = firstName && lastName && firstName + ' ' + lastName;
      const option2 = firstName;
      const option3 = username;
      return option1 ? option1 : option2 ? option2 : option3;
    }
  }
};
