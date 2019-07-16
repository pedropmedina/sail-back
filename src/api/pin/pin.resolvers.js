const { PubSub } = require('apollo-server');
const authorize = require('../../utils/authorize');

// instantiate PubSub making asyncIterator and publish
const pubsub = new PubSub();

// subcriptions event names
const PIN_CREATED = 'PIN_CREATED';
const PIN_UPDATED = 'PIN_UPDATED';
const PIN_DELETED = 'PIN_DELETED';

const getPins = async (_, __, { models }) => {
  const pins = await models.Pin.find({})
    .populate('author')
    .populate('comments')
    .exec();
  return pins;
};

const getPin = async (_, { pinId }, { models }) => {
  const pin = await models.Pin.findById(pinId)
    .populate('author')
    .populate('comments')
    .exec();
  return pin;
};

// two things to have in mind when creating a pin:
// 1 - the author is the same user found in ctx.
// 2 - comments don't have to be populated as there's no comments pointed to this newly created pin yet
const createPin = authorize(async (_, args, { models, currentUser }) => {
  const newPin = await new models.Pin({
    ...args.input,
    author: currentUser._id
  }).save();
  const pinCreated = await models.Pin.populate(newPin, 'author');
  // push pin into current user's pins array
  currentUser.pins.push(pinCreated._id);
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
    .populate('comments')
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
    .populate('comments')
    .exec();
  await pinDeleted.remove();
  pubsub.publish(PIN_DELETED, { pinDeleted });
  return pinDeleted;
});

module.exports = {
  Query: {
    getPins,
    getPin
  },
  Mutation: {
    createPin,
    updatePin,
    deletePin
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
