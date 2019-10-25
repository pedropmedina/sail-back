const { PubSub, withFilter, ApolloError } = require('apollo-server');
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
      // find conversation and check if currentUser is a participant to allow write access
      let conversation = await models.Conversation.findById(
        input.conversation
      ).exec();

      const isParticipant = conversation.participants.some(
        username => username === currentUser.username
      );
      if (!isParticipant) {
        throw new ApolloError('Must be a participant!');
      }

      let message = new models.Message({
        ...input,
        author: currentUser._id
      });
      await message.save();

      // push message into conversation
      conversation.messages.push(message._id);
      // increment unreadCount in conversation for each user, but the author of message
      conversation.unreadCount.forEach(
        each => each.username !== currentUser.username && each.count++
      );

      conversation = await conversation.save();

      // populate conversation's fields
      const opts = [
        { path: 'messages', populate: 'author' },
        { path: 'author', populate: 'pins' }
      ];
      conversation = await models.Conversation.populate(conversation, opts);

      // publish message
      pubSub.publish(MESSAGE_CREATED, { messageCreated: conversation });

      const messageOpts = [
        {
          path: 'conversation',
          populate: [{ path: 'author' }]
        },
        { path: 'author' }
      ];
      return await models.Message.populate(message, messageOpts);
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
        (payload, { conversationId }, { currentUser }) => {
          const conversation = payload.messageCreated;
          const isParticipant = conversation.participants.some(
            username => username === currentUser.username
          );
          return conversationId
            ? conversation._id.equals(conversationId) && isParticipant
            : isParticipant;
        }
      )
    },
    messageDeleted: {
      subscribe: () => pubSub.asyncIterator(MESSAGE_DELETED)
    }
  }
};
