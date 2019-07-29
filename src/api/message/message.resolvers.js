const { PubSub } = require('apollo-server');
const authorize = require('../../utils/authorize');
const grantAdminAccess = require('../../utils/grantAdminAccess');

const pubSub = new PubSub();

const MESSAGE_CREATED = 'MESSAGE_CREATED';
const MESSAGE_UPDATED = 'MESSAGE_UPDATED';
const MESSAGE_DELETED = 'MESSAGE_DELETED';
const MESSAGES_REMOVED = 'MESSAGES_REMOVED';
const MESSAGE_REMOVED = 'MESSAGE_REMOVE';

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
      // add message to each participant in conversation and return conversation
      const conversation = await message.addMessageToConversation(
        models.Conversation
      );
      // publish message
      pubSub.publish(MESSAGE_CREATED, { messageCreated: conversation });
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
    // delete message's id from each participant in conversation and return conversation
    const conversation = await models.Conversation.removeMessageFromUsers(
      message.conversation,
      message._id
    );
    // publish updated conversation upon deletion of message
    pubSub.publish(MESSAGE_DELETED, { messageDeleted: conversation });
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
    // publish the updated conversation with messages removed for current user
    pubSub.publish(MESSAGES_REMOVED, { messagedRemoved: conversation });
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
    // publish updated  conversation with removed message for current user
    pubSub.publish(MESSAGE_REMOVED, { messageRemoved: conversation });
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
  },
  Subscription: {
    messageCreated: {
      subscribe: () => pubSub.asyncIterator(MESSAGE_CREATED)
    },
    messageUpdated: {
      subscribe: () => pubSub.asyncIterator(MESSAGE_UPDATED)
    },
    messageDeleted: {
      subscribe: () => pubSub.asyncIterator(MESSAGE_DELETED)
    },
    messagesRemoved: {
      subscribe: () => pubSub.asyncIterator(MESSAGES_REMOVED)
    },
    messageRemoved: {
      subscribe: () => pubSub.asyncIterator(MESSAGE_REMOVED)
    }
  }
};
