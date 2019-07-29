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
      const message = new models.Message({
        ...input,
        author: currentUser._id
      });
      await message.addMessageToConversation(models.Conversation);
      await message.save();
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
    const message = await models.Message.findByIdAndDelete(messageId).exec();
    await models.Conversation.removeMessageFromUsers(
      message.conversation,
      message._id
    );
    return true;
  } catch (error) {
    console.error('Error while deleting message', error);
    throw error;
  }
});

const removeMessages = authorize(
  async (_, { conversationId }, { models, currentUser: { username } }) => {
    const conversation = await models.Conversation.findById(
      conversationId
    ).exec();
    conversation.keyedMessagesByUser[username] = [];
    conversation.markModified(`keyedMessagesByUser.${username}`);
    await conversation.save();
    return true;
  }
);

const removeMessage = authorize(
  async (
    _,
    { input: { conversationId, messageId } },
    { models, currentUser: { username } }
  ) => {
    const conversation = await models.Conversation.findById(
      conversationId
    ).exec();
    const messages = conversation.keyedMessagesByUser[username];
    conversation.keyedMessagesByUser[username] = messages.filter(
      msgId => !msgId.equals(messageId)
    );
    conversation.markModified(`keyedMessagesByUser.${username}`);
    await conversation.save();
    return true;
  }
);

module.exports = {
  Query: {
    getMessages,
    getMessage
  },
  Mutation: {
    createMessage,
    deleteMessage,
    removeMessages,
    removeMessage
  }
};
