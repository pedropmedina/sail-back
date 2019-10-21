const { PubSub } = require('apollo-server');
const grantAdminAccess = require('../../utils/grantAdminAccess');
const authorize = require('../../utils/authorize');

const pubSub = new PubSub();

const CONVERSATION_CREATED = 'CONVERSATION_CREATED';

const getConversations = authorize(async (_, __, { models, currentUser }) => {
  try {
    const conversations = await models.Conversation.find({
      participants: { $in: [currentUser.username] }
    })
      .populate({ path: 'messages', populate: [{ path: 'author' }] })
      .populate('author')
      .exec();

    return conversations;
  } catch (error) {
    console.error('Error while getting conversations', error);
    throw error;
  }
});

const getConversation = authorize(async (_, { conversationId }, { models }) => {
  try {
    const conversation = await models.Conversation.findById(conversationId)
      .populate({ path: 'messages', populate: [{ path: 'author' }] })
      .populate('author')
      .exec();
    return conversation;
  } catch (error) {
    console.error('Error while getting conversation', error);
    throw error;
  }
});

const createConversation = authorize(
  async (_, { input }, { models, currentUser }) => {
    try {
      const { participants, message } = input;
      // instantiate new conversation
      let conversation = new models.Conversation({
        participants: [...participants, currentUser.username],
        author: currentUser._id
      });

      // check if message send in input and create new message for conversation
      if (message) {
        const newMessage = await new models.Message({
          conversation: conversation._id,
          content: message,
          author: currentUser._id
        }).save();
        conversation.messages = [newMessage._id];
      }

      // save conversation and populate fields
      conversation = await conversation.save();
      const opts = [
        { path: 'messages', populate: 'author' },
        { path: 'author', populate: 'pins' }
      ];
      conversation = await models.Conversation.populate(conversation, opts);
      // publish new conversation
      pubSub.publish(CONVERSATION_CREATED, {
        conversationCreated: conversation
      });
      return conversation;
    } catch (error) {
      console.error('Error while creating conversation', error);
    }
  }
);

const deleteConversation = grantAdminAccess(
  async (_, { conversationId }, { models }) => {
    try {
      const conversation = await models.Conversation.findById(conversationId);
      await conversation.remove();
      return true;
    } catch (error) {
      console.error('Error while deleting conversation', error);
      throw error;
    }
  }
);

module.exports = {
  Query: {
    getConversations,
    getConversation
  },
  Mutation: {
    createConversation,
    deleteConversation
  },
  Subscription: {
    conversationCreated: {
      subscribe: () => pubSub.asyncIterator(CONVERSATION_CREATED)
    }
  },
  Conversation: {
    participants: async (root, _, { models }) => {
      return await models.User.find({
        username: { $in: root.participants }
      }).exec();
    }
  }
};
