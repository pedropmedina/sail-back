const grantOwnerAccess = require('../../utils/grantOwnerAccess');

const getPins = async (root, args, { models }) => {
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
const createPin = grantOwnerAccess(async (_, args, { models, currentUser }) => {
  const newPin = await new models.Pin({
    ...args.input,
    author: currentUser._id
  }).save();
  const pinAdded = await models.Pin.populate(newPin, 'author');
  return pinAdded;
});

const updatePin = grantOwnerAccess(async (_, args, { models, currentUser }) => {
  const { pinId, ...update } = args.input;
  let updatedPin = await models.Pin.findOneAndUpdate(
    { _id: pinId, author: currentUser._id },
    update,
    { new: true }
  )
    .populate('author')
    .populate('comments')
    .exec();
  return updatedPin;
});

const deletePin = grantOwnerAccess(
  async (_, { pinId }, { models, currentUser }) => {
    let deletedPin = await models.Pin.findOneAndDelete({
      _id: pinId,
      author: currentUser._id
    })
      .populate('author')
      .populate('comments')
      .exec();
    return deletedPin;
  }
);

module.exports = {
  Query: {
    getPins,
    getPin
  },
  Mutation: {
    createPin,
    updatePin,
    deletePin
  }
};
