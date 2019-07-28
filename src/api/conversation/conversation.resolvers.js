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
      const conversation = await models.Conversation.findById(
        conversationId
      ).exec();
      await conversation.remove();
      return true;
    } catch (error) {
      console.error('Error while deleting conversation', error);
      throw error;
    }
  }
);

const emptyMessages = authorize(
  async (_, { conversationId }, { models, currentUser }) => {
    const { username } = currentUser;
    const field = `keyedMessagesByUser.${username}`;
    return await models.Conversation.findByIdAndUpdate(
      conversationId,
      {
        [field]: []
      },
      { new: true }
    )
      .populate('messages')
      .exec();
  }
);

const pullMessage = authorize(async (_, { input }, { models, currentUser }) => {
  const { conversationId, messageId } = input;
  const { username } = currentUser;
  const field = `keyedMessagesByUser.${username}`;
  return await models.Conversation.findByIdAndUpdate(
    conversationId,
    {
      $pull: { [field]: messageId }
    },
    { new: true }
  )
    .populate('messages')
    .exec();
});

module.exports = {
  Query: {
    getConversations,
    getConversation
  },
  Mutation: {
    createConversation,
    deleteConversation,
    emptyMessages,
    pullMessage
  },
  Conversation: {
    participants: async (root, _, { models }) => {
      return await models.User.find({
        username: { $in: root.participants }
      }).exec();
    }
  }
};
