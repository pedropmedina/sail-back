const grantAdminAccess = require('../../utils/grantAdminAccess');
const authorize = require('../../utils/authorize');

const getConversations = authorize(async (_, __, { models }) => {
  try {
    const conversations = await models.Conversation.find({})
      .populate('messages')
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
      .populate('messages')
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
      const conversation = await new models.Conversation({
        ...input,
        author: currentUser._id
      })
        .keyMessagesByUser(currentUser.username)
        .save();
      const opts = [{ path: 'messages' }, { path: 'author', populate: 'pins' }];
      return await models.Conversation.populate(conversation, opts);
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
  Conversation: {
    participants: async (root, _, { models }) => {
      return await models.User.find({
        username: { $in: root.participants }
      }).exec();
    },
    // Since messages have already been queried under the messages array,
    // simply return a new object of participant's messages based on existing
    // messages' id under each participant's username. This avoids re-quering all messages multiple times
    keyedMessagesByUser: root => {
      return root.participants.reduce((populatedMessages, participant) => {
        const messages = root.messages.filter(message => {
          return root.keyedMessagesByUser[participant].some(msgId =>
            msgId.equals(message._id)
          );
        });
        populatedMessages[participant] = messages;
        return populatedMessages;
      }, {});
    }
  }
};
