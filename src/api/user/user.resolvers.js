const { AuthenticationError } = require('apollo-server');
const bcrypt = require('bcryptjs');

// utils
const grantAdminAccess = require('../../utils/grantAdminAccess');
const authorize = require('../../utils/authorize');
const createToken = require('../../utils/createToken');
const setCookie = require('../../utils/setCookie');

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
    })
      .populate({
        path: 'myPlans',
        populate: [
          { path: 'location' },
          { path: 'participants' },
          { path: 'invites' },
          { path: 'chat' },
          { path: 'author' }
        ]
      })
      .populate({
        path: 'inPlans',
        populate: [
          { path: 'location' },
          { path: 'participants' },
          { path: 'invites' },
          { path: 'chat' },
          { path: 'author' }
        ]
      })
      .populate({
        path: 'pins',
        populate: { path: 'comments' }
      })
      .populate('likedPins')
      .populate('friends')
      .populate({
        path: 'sentRequests',
        populate: [{ path: 'author' }, { path: 'to' }, { path: 'plan' }]
      })
      .exec();
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
      user
    };
  } catch (error) {
    console.error('Error while logging user: ', error.message);
    throw error;
  }
};

// access current user's info
const me = authorize(async (_, __, { models, currentUser }) => {
  const opts = [
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
    { path: 'myPins', populate: { path: 'comments' } },
    { path: 'likedPins', populate: { path: 'comments' } },
    { path: 'friends' },
    {
      path: 'sentRequests',
      populate: [{ path: 'author' }, { path: 'to' }, { path: 'plan' }]
    }
  ];
  return await models.User.populate(currentUser, opts);
});

// allow admins to access users' info
const getUsers = grantAdminAccess(async (_, __, { models }) => {
  try {
    const users = await models.User.find({})
      .populate({
        path: 'myPlans',
        populate: [
          { path: 'location' },
          { path: 'participants' },
          { path: 'invites' },
          { path: 'chat' },
          { path: 'author' }
        ]
      })
      .populate({
        path: 'inPlans',
        populate: [
          { path: 'location' },
          { path: 'participants' },
          { path: 'invites' },
          { path: 'chat' },
          { path: 'author' }
        ]
      })
      .populate({
        path: 'myPins',
        populate: { path: 'comments' }
      })
      .populate('likedpins')
      .populate('friends')
      .populate({
        path: 'sentRequestsd',
        populate: [{ path: 'author' }, { path: 'to' }, { path: 'plan' }]
      })
      .exec();
    return users;
  } catch (error) {
    console.error('Error while getting users', error);
  }
});

const getUser = authorize(async (_, { userId, username }, { models }) => {
  try {
    const user = await models.User.findOne({
      $or: [{ _id: userId }, { username }]
    })
      .populate({
        path: 'myPlans',
        populate: [
          { path: 'location' },
          { path: 'participants' },
          { path: 'invites' },
          { path: 'chat' },
          { path: 'author' }
        ]
      })
      .populate({
        path: 'inPlans',
        populate: [
          { path: 'location' },
          { path: 'participants' },
          { path: 'invites' },
          { path: 'chat' },
          { path: 'author' }
        ]
      })
      .populate('myPlans')
      .populate({
        path: 'inPlans',
        populate: [{ path: 'location' }, { path: 'participants' }]
      })
      .populate({
        path: 'myPins',
        populate: { path: 'comments' }
      })
      .populate('likedpins')
      .populate('friends')
      .populate({
        path: 'sentRequestsd',
        populate: [{ path: 'author' }, { path: 'to' }, { path: 'plan' }]
      })
      .exec();
    return user;
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
        if (input[prop]) {
          currentUser[prop] = input[prop];
        }
      }
    }
    await currentUser.save();

    const opts = [
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
      { path: 'myPins', populate: { path: 'comments' } },
      { path: 'likedPins', populate: { path: 'comments' } },
      { path: 'friends' },
      {
        path: 'sentRequests',
        populate: [{ path: 'author' }, { path: 'to' }, { path: 'plan' }]
      }
    ];
    return await models.User.populate(currentUser, opts);
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

      const opts = [
        { path: 'myPlans' },
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
        { path: 'likedPins', populate: { path: 'comments' } },
        { path: 'friends' },
        {
          path: 'sentRequests',
          populate: [{ path: 'author' }, { path: 'to' }, { path: 'plan' }]
        }
      ];
      return await models.User.populate(currentUser, opts);
    } catch (error) {
      throw error;
    }
  }
);

const deleteUser = authorize(async (_, { userId }, { models }) => {
  try {
    const user = await models.User.findById(userId)
      .populate({
        path: 'inPlans',
        populate: [
          { path: 'location' },
          { path: 'participants' },
          { path: 'invites' },
          { path: 'chat' },
          { path: 'author' }
        ]
      })
      .populate({
        path: 'myPlans',
        populate: [
          { path: 'location' },
          { path: 'participants' },
          { path: 'invites' },
          { path: 'chat' },
          { path: 'author' }
        ]
      })
      .populate({
        path: 'myPins',
        populate: { path: 'comments' }
      })
      .populate('likedpins')
      .populate('friends')
      .populate({
        path: 'sentRequestsd',
        populate: [{ path: 'author' }, { path: 'to' }, { path: 'plan' }]
      })
      .exec();
    await user.remove();
    return user;
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
  }
};
