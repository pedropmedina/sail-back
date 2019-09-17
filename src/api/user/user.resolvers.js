const { AuthenticationError } = require('apollo-server');
const bcrypt = require('bcryptjs');

// utils
const grantAdminAccess = require('../../utils/grantAdminAccess');
const authorize = require('../../utils/authorize');
const createTokens = require('../../utils/createTokens');
const { setCookies, getCookies } = require('../../utils/handleCookies');

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

    // create tokens and set cookies
    const tokens = createTokens(user._id);
    setCookies(res, tokens);

    return user;
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
      .populate('myPlans')
      .populate('inPlans')
      .populate({
        path: 'pins',
        populate: { path: 'comments' }
      })
      .populate('likedPins')
      .populate('friends')
      .populate({path: 'sentRequests', populate: { path: 'author'}})
      .populate({path: 'receivedRequests', populate: { path: 'author'}})
      .exec();
    if (!user) throw new AuthenticationError('Wrong credentials.');

    // validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new AuthenticationError('Wrong credentials.');

    // create tokens and set cookies
    const tokens = createTokens(user._id);
    setCookies(res, tokens);

    return user;
  } catch (error) {
    console.error('Error while logging user: ', error.message);
    throw error;
  }
};

// logout user and blacklist token
const blacklistTokens = async (_, __, { models, req }) => {
  try {
    const { refreshToken } = getCookies(req);
    await new models.BlacklistedToken({ token: refreshToken }).save();
    return true;
  } catch (error) {
    console.error('Error while blacklisting token: ', error.message);
    return false;
  }
};

// access current user's info
const me = authorize(async (_, __, { models, currentUser }) => {
  const opts = [
    { path: 'myPlans' },
    { path: 'inPlans' },
    { path: 'myPins', populate: { path: 'comments' } },
    { path: 'likedPins' },
    { path: 'friends' },
    { path: 'sentRequests', populate: { path: 'author' } },
    { path: 'receivedRequests', populate: { path: 'author' } }
  ];
  return await models.User.populate(currentUser, opts);
});

// allow admins to access users' info
const getUsers = grantAdminAccess(async (_, __, { models }) => {
  try {
    const users = await models.User.find({})
      .populate('myPlans')
      .populate('inPlans')
      .populate({
        path: 'myPins',
        populate: { path: 'comments' }
      })
      .populate('likedpins')
      .populate('friends')
      .exec();
    return users;
  } catch (error) {
    console.error('Error while getting users', error);
  }
});

const getUser = grantAdminAccess(async (_, { userId }, { models }) => {
  try {
    const user = await models.User.findById(userId)
      .populate('myPlans')
      .populate('inPlans')
      .populate({
        path: 'myPins',
        populate: { path: 'comments' }
      })
      .populate('likedpins')
      .populate('friends')
      .exec();
    return user;
  } catch (error) {
    console.error('Error while getting user', error);
    return error;
  }
});

// either current user and admin can update and delete user
const updateUser = authorize(
  async (_, { input: { userId, ...update } }, { models }) => {
    try {
      const user = await models.User.findByIdAndUpdate(userId, update, {
        new: true
      })
        .populate('myPlans')
        .populate('inPlans')
        .populate({
          path: 'myPins',
          populate: { path: 'comments' }
        })
        .populate('likedpins')
        .populate('friends')
        .exec();
      return user;
    } catch (error) {
      console.error('Error while updating user', error);
      throw error;
    }
  }
);

const deleteUser = authorize(async (_, { userId }, { models }) => {
  try {
    const user = await models.User.findById(userId)
      .populate('myPlans')
      .populate('inPlans')
      .populate({
        path: 'myPins',
        populate: { path: 'comments' }
      })
      .populate('likedpins')
      .populate('friends')
      .exec();
    await user.remove();
    return user;
  } catch (error) {
    console.error('Error while deleting user', error);
  }
});

const likePin = authorize(async (_, { pinId }, { currentUser }) => {
  currentUser.likes.push(pinId);
  await currentUser.save();
  return true;
});

module.exports = {
  Query: {
    me,
    getUsers,
    getUser
  },
  Mutation: {
    signupUser,
    loginUser,
    blacklistTokens,
    updateUser,
    deleteUser,
    likePin
  }
};
