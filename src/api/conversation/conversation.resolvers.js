const { PubSub, withFilter } = require('apollo-server');
const grantAdminAccess = require('../../utils/grantAdminAccess');
const authorize = require('../../utils/authorize');

const pubSub = new PubSub();

const CONVERSATION_CREATED = 'CONVERSATION_CREATED';

const getConversations = authorize(async (_, __, { models, currentUser }) => {
  try {
    const conversations = await models.Conversation.find({
      participants: { $in: [currentUser._id] }
    })
      .populate({ path: 'messages', populate: [{ path: 'author' }] })
      .populate('author')
      .populate('plan')
      .populate('participants')
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
      .populate('plan')
      .populate('participants')
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

      // find all user's id for each participant in the conversation
      const aggregation = await models.User.aggregate([
        { $match: { username: { $in: participants } } },
        { $group: { _id: null, array: { $push: '$_id' } } },
        { $project: { array: true, _id: false } }
      ]);
      const participantsId = [...aggregation[0]['array'], currentUser._id];

      // instantiate new conversation
      let conversation = new models.Conversation({
        participants: participantsId,
        author: currentUser._id
      });

      // set unread count for existing participants
      conversation.setUnreadCount(participantsId);

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
        { path: 'author', populate: 'pins' },
        { path: 'plan' },
        { path: 'participants' }
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

const updateConversationUnreadCount = authorize(
  async (_, { input }, { models }) => {
    const { conversationId, unreadCountId, operation } = input;
    // find the conversation to be updated
    const conversation = await models.Conversation.findById(
      conversationId
    ).exec();
    // find the unreadCount subdocument by its id
    const unreadCount = conversation.unreadCount.id(unreadCountId);
    // update the unreadCount subdocument count based on the operation
    switch (operation) {
      case 'INCREMENT':
        unreadCount.count++;
        break;
      case 'DECREMENT':
        unreadCount.count--;
        break;
      case 'RESET':
        unreadCount.count = 0;
        break;
      default:
        break;
    }

    await conversation.save();
    const opts = [
      { path: 'messages', populate: 'author' },
      { path: 'author', populate: 'pins' },
      { path: 'plan' },
      { path: 'participants' }
    ];

    return await models.Conversation.populate(conversation, opts);
  }
);

module.exports = {
  Query: {
    getConversations,
    getConversation
  },
  Mutation: {
    createConversation,
    deleteConversation,
    updateConversationUnreadCount
  },
  Subscription: {
    conversationCreated: {
      subscribe: withFilter(
        () => pubSub.asyncIterator(CONVERSATION_CREATED),
        (payload, _, { currentUser }) => {
          const isParticipant = payload.participants.some(id =>
            id.equals(currentUser._id)
          );
          return isParticipant;
        }
      )
    }
  },
  Conversation: {
    unreadCount: (root, __, { currentUser }) =>
      root.unreadCount.find(unread => unread.userId.equals(currentUser._id))
  }
};
