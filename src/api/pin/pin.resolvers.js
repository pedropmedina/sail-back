const getPins = async (root, args, { models }) => {
  const pins = await models.Pin.find({})
    .populate('author')
    .populate('comments')
    .exec();
  return pins;
};

const getPin = async (_, { id }, { models }) => {
  const pin = await models.Pin.findById(id)
    .populate('author')
    .populate('comments')
    .exec();
  return pin;
};

const createPin = async (_, args, { models }) => {
  let newPin = await new models.Pin({ ...args.input }).save().exec();
  newPin = models.Pin.populate(newPin, 'author').populate('comments');
  return newPin;
};

const updatePin = async (_, args, { models }) => {
  const { id, ...update } = args;
  let updatedPin = await models.Pin.findByIdAndUpdate(id, update, {
    new: true
  }).exec();
  updatedPin = await models.Pin.populate('author').populate('comments');
  return updatedPin;
};

const deletePin = async (_, { id }, { models }) => {
  let deletedPin = await models.Pin.findByIdAndDelete(id).exec();
  deletedPin = await models.Pin.populate('author').populate('comments');
  return deletedPin;
};

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
