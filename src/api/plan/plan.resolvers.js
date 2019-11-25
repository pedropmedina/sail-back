const { ApolloError } = require('apollo-server');
const authorize = require('../../utils/authorize');

const getPlan = authorize(async (_, { planId }, { models }) => {
  try {
    const plan = await models.Plan.findById(planId)
      .populate({ path: 'location', populate: { path: 'comments' } })
      .populate({
        path: 'chat',
        populate: [
          { path: 'author' },
          { path: 'messages', populate: 'author' },
          { path: 'plan' },
          { path: 'participants' }
        ]
      })
      .populate('participants')
      .populate('invites')
      .populate('author')
      .exec();
    return plan;
  } catch (error) {
    console.error('Error while getting plan', error);
    throw error;
  }
});

const getPlans = authorize(async (_, __, { models, currentUser }) => {
  try {
    const plans = await models.Plan.find({
      participants: { $in: [currentUser._id] }
    })
      .populate({ path: 'location', populate: { path: 'comments' } })
      .populate({
        path: 'chat',
        populate: [
          { path: 'author' },
          { path: 'messages', populate: 'author' },
          { path: 'plan' },
          { path: 'participants' }
        ]
      })
      .populate('participants')
      .populate('invites')
      .populate('author')
      .exec();
    return plans;
  } catch (error) {
    console.log(error('Error getting plan.'));
  }
});

const createPlan = authorize(async (_, { input }, { models, currentUser }) => {
  try {
    const { invites } = input;

    // find all user's id for each invite
    const aggregation = await models.User.aggregate([
      { $match: { username: { $in: invites } } },
      { $group: { _id: null, array: { $push: '$_id' } } },
      { $project: { array: true, _id: false } }
    ]);
    const invitesIds = aggregation[0]['array'];

    // create new plan with chat's id
    const plan = new models.Plan({
      ...input,
      invites: invitesIds,
      author: currentUser._id
    });

    // create corresponding chat
    const chat = await new models.Conversation({
      author: currentUser._id,
      participants: [currentUser._id],
      plan: plan._id
    });

    // set unreadCount
    chat.setUnreadCount([currentUser._id]);

    // create welcome message
    const message = await new models.Message({
      conversation: chat._id,
      content: 'Hi guys!',
      author: currentUser._id
    }).save();

    // update conversation with new welcome message
    chat.messages = [message._id];
    await chat.save();
    // update plan with created chat
    plan.chat = chat._id;
    await plan.save();

    const opts = [
      { path: 'location', populate: 'comments' },
      {
        path: 'chat',
        populate: [
          { path: 'author' },
          { path: 'messages', populate: 'author' },
          { path: 'plan' },
          { path: 'participants' }
        ]
      },
      { path: 'participants' },
      { path: 'invites' },
      { path: 'author' }
    ];
    return await models.Plan.populate(plan, opts);
  } catch (error) {
    console.error('Error while creating plan', error);
    throw error;
  }
});

const updatePlan = authorize(async (_, { input }, { models }) => {
  try {
    const { planId, ...update } = input;
    const plan = await models.Plan.findByIdAndUpdate(planId, update, {
      new: true
    })
      .populate({ path: 'location', populate: 'comments' })
      .populate({
        path: 'chat',
        populate: [
          { path: 'author' },
          { path: 'messages', populate: 'author' },
          { path: 'plan' },
          { path: 'participants' }
        ]
      })
      .populate('participants')
      .populate('invites')
      .populate('author')
      .exec();
    return plan;
  } catch (error) {
    console.error('Error while updating plan', error);
    throw error;
  }
});

const deletePlan = authorize(async (_, { planId }, { models, currentUser }) => {
  try {
    const plan = await models.Plan.findOne({
      _id: planId,
      author: currentUser._id
    }).exec();

    if (!plan) {
      throw new ApolloError('Unauthorized action!');
    }

    await plan.remove();
    return true;
  } catch (error) {
    console.error('Erro while deleting plan', error);
    throw error;
  }
});

module.exports = {
  Query: {
    getPlan,
    getPlans
  },
  Mutation: {
    createPlan,
    updatePlan,
    deletePlan
  }
};
