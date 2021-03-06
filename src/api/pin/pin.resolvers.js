const { PubSub } = require('apollo-server');
const authorize = require('../../utils/authorize');

// instantiate PubSub making asyncIterator and publish
const pubsub = new PubSub();

// subcriptions event names
const PIN_CREATED = 'PIN_CREATED';
const PIN_UPDATED = 'PIN_UPDATED';
const PIN_DELETED = 'PIN_DELETED';

const getPins = authorize(async (_, __, { models }) => {
  const pins = await models.Pin.find({})
    .populate('author')
    .populate({ path: 'comments', populate: { path: 'author' } })
    .exec();
  return pins;
});

const getPin = authorize(async (_, { pinId }, { models }) => {
  const pin = await models.Pin.findById(pinId)
    .populate('author')
    .populate({ path: 'comments', populate: { path: 'author' } })
    .exec();
  return pin;
});

const getPinByCoords = authorize(async (_, { input }, { models }) => {
  const { longitude, latitude } = input;
  const pin = await models.Pin.findOne({ longitude, latitude })
    .populate('author')
    .populate({ path: 'comments', populate: { path: 'author' } })
    .exec();
  return pin;
});

// two things to have in mind when creating a pin:
// 1 - the author is the same user found in ctx.
// 2 - comments don't have to be populated as there's no comments pointed to this newly created pin yet
const createPin = authorize(async (_, args, { models, currentUser }) => {
  const newPin = await new models.Pin({
    ...args.input,
    author: currentUser._id
  }).save();
  const pinCreated = await models.Pin.populate(newPin, [
    { path: 'author' },
    { path: 'comments', populate: 'author' }
  ]);
  // push pin into current user's pins array
  currentUser.myPins.push(pinCreated._id);
  await currentUser.save();
  pubsub.publish(PIN_CREATED, { pinCreated });
  return pinCreated;
});

const updatePin = authorize(async (_, args, { models, currentUser }) => {
  const { pinId, ...update } = args.input;
  let pinUpdated = await models.Pin.findOneAndUpdate(
    { _id: pinId, author: currentUser._id },
    update,
    { new: true }
  )
    .populate('author')
    .populate({ path: 'comments', populate: { path: 'author' } })
    .exec();
  pubsub.publish(PIN_UPDATED, { pinUpdated });
  return pinUpdated;
});

// query pin and use remove on retuned document to trigger 'remove' hooks
// and remove all comments related to this pin
const deletePin = authorize(async (_, { pinId }, { models, currentUser }) => {
  const pinDeleted = await models.Pin.findOne({
    _id: pinId,
    author: currentUser._id
  })
    .populate('author')
    .populate({ path: 'comments', populate: { path: 'author' } })
    .exec();
  await pinDeleted.remove();
  pubsub.publish(PIN_DELETED, { pinDeleted });
  return pinDeleted;
});

const likePin = authorize(async (_, { pinId }, { currentUser }) => {
  currentUser.likedPins.push(pinId);
  await currentUser.save();
  return true;
});

const unlikePin = authorize(async (_, { pinId }, { currentUser }) => {
  currentUser.likedPins = currentUser.likedPins.filter(
    pin => !pin._id.equals(pinId)
  );
  await currentUser.save();
  return true;
});

module.exports = {
  Query: {
    getPins,
    getPin,
    getPinByCoords
  },
  Mutation: {
    createPin,
    updatePin,
    deletePin,
    likePin,
    unlikePin
  },
  Subscription: {
    pinCreated: {
      subscribe: () => pubsub.asyncIterator(PIN_CREATED)
    },
    pinUpdated: {
      subscribe: () => pubsub.asyncIterator(PIN_UPDATED)
    },
    pinDeleted: {
      subscribe: () => pubsub.asyncIterator(PIN_DELETED)
    }
  }
};
