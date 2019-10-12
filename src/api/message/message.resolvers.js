const { PubSub, withFilter } = require('apollo-server');
const authorize = require('../../utils/authorize');
const grantAdminAccess = require('../../utils/grantAdminAccess');

const pubSub = new PubSub();

const MESSAGE_CREATED = 'MESSAGE_CREATED';
const MESSAGE_DELETED = 'MESSAGE_DELETED';

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
      let message = new models.Message({
        ...input,
        author: currentUser._id
      });
      await message.save();

      // push new message in to its corresponding array
      await models.Conversation.findByIdAndUpdate(input.conversation, {
        $push: { messages: message._id }
      }).exec();

      // populate all fields for message
      message = await models.Message.populate(message, [
        {
          path: 'conversation',
          populate: [{ path: 'messages' }, { path: 'author' }]
        },
        { path: 'author' }
      ]);

      // publish message
      pubSub.publish(MESSAGE_CREATED, { messageCreated: message });

      return message;
    } catch (error) {
      console.error('Error while creating message', error);
      throw error;
    }
  }
);

const deleteMessage = grantAdminAccess(async (_, { messageId }, { models }) => {
  try {
    let message = await models.Message.findByIdAndDelete(messageId).exec();

    message = await models.Message.populate(message, [
      { path: 'conversation' },
      { path: 'author' }
    ]);
    // publish deleted message
    pubSub.publish(MESSAGE_DELETED, { messageDeleted: message });
    return true;
  } catch (error) {
    console.error('Error while deleting message', error);
    throw error;
  }
});

// const removeMessages = authorize(
//   async (_, { conversationId }, { models, currentUser: { username } }) => {
//     let conversation = await models.Conversation.findById(
//       conversationId
//     ).exec();
//     conversation.keyedMessagesByUser[username] = [];
//     conversation.markModified(`keyedMessagesByUser.${username}`);
//     await conversation.save();
//     conversation = await models.Conversation.populate(conversation, [
//       { path: 'messages' },
//       { path: 'author' }
//     ]);
//     // publish the updated conversation with messages removed for current user
//     pubSub.publish(MESSAGES_REMOVED, { messagesRemoved: conversation });
//     return true;
//   }
// );

// const removeMessage = authorize(
//   async (
//     _,
//     { input: { conversationId, messageId } },
//     { models, currentUser: { username } }
//   ) => {
//     let conversation = await models.Conversation.findById(
//       conversationId
//     ).exec();
//     const messages = conversation.keyedMessagesByUser[username];
//     conversation.keyedMessagesByUser[username] = messages.filter(
//       msgId => !msgId.equals(messageId)
//     );
//     conversation.markModified(`keyedMessagesByUser.${username}`);
//     await conversation.save();
//     conversation = await models.Conversation.populate(conversation, [
//       { path: 'messages' },
//       { path: 'author' }
//     ]);
//     // publish updated  conversation with removed message for current user
//     pubSub.publish(MESSAGE_REMOVED, { messageRemoved: conversation });
//     return true;
//   }
// );

module.exports = {
  Query: {
    getMessages,
    getMessage
  },
  Mutation: {
    createMessage,
    deleteMessage
  },
  Subscription: {
    messageCreated: {
      subscribe: withFilter(
        () => pubSub.asyncIterator(MESSAGE_CREATED),
        (payload, { conversationId }) => {
          const { conversation } = payload.messageCreated;
          return conversation._id.equals(conversationId);
        }
      )
    },
    messageDeleted: {
      subscribe: () => pubSub.asyncIterator(MESSAGE_DELETED)
    }
  }
};
