const authorize = require('../../utils/authorize');
const grantAdminAccess = require('../../utils/grantAdminAccess');

const getMessages = grantAdminAccess(async (_, __, { models }) => {
  try {
    const messages = await models.Message.find({})
      .populate('conversation')
      .populate('author')
      .exec();
    return messages;
  } catch (error) {
    console.error('Error while getting messages', error);
    throw error;
  }
});

const getMessage = authorize(async (_, { messageId }, { models }) => {
  try {
    const message = await models.Message.findById(messageId)
      .populate('conversation')
      .populate('author')
      .exec();
    return message;
  } catch (error) {
    console.error('Erro while getting message', error);
    throw error;
  }
});

const createMessage = authorize(
  async (_, { input }, { models, currentUser }) => {
    try {
      const message = await new models.Message({
        ...input,
        author: currentUser._id
      }).save();
      return await models.Message.populate(message, [
        { path: 'conversation' },
        { path: 'author' }
      ]);
    } catch (error) {
      console.error('Error while creating message', error);
      throw error;
    }
  }
);

const deleteMessage = grantAdminAccess(async (_, { messageId }, { models }) => {
  try {
    await models.Message.findByIdAndDelete(messageId).exec();
    return true;
  } catch (error) {
    console.error('Error while deleting message', error);
    throw error;
  }
});

module.exports = {
  Query: {
    getMessages,
    getMessage
  },
  Mutation: {
    createMessage,
    deleteMessage
  }
};
