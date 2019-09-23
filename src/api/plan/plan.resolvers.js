const { ApolloError } = require('apollo-server');
const authorize = require('../../utils/authorize');

const getPlan = authorize(async (_, { planId }, { models }) => {
  try {
    const plan = await models.Plan.finById(planId)
      .populate({ path: 'location', populate: { path: 'comments' } })
      .populate('chat')
      .populate('participants')
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
      .populate('chat')
      .populate('participants')
      .populate('author')
      .exec();
    return plans;
  } catch (error) {
    console.log(error('Error getting plan.'));
  }
});

const createPlan = authorize(async (_, { input }, { models, currentUser }) => {
  try {
    let plan = new models.Plan({
      ...input,
      author: currentUser._id
    });
    await plan.save();
    const opts = [
      { path: 'location', populate: 'comments' },
      { path: 'participants' },
      { path: 'author' }
    ];
    plan = await models.Plan.populate(plan, opts);
    return plan;
  } catch (error) {
    console.error('Error while creating plan', error);
    throw error;
  }
});

const updatePlan = authorize(async (_, { input }, { models }) => {
  try {
    const { _id, ...update } = input;
    const plan = await models.Plan.findByIdAndUpdate(_id, update, { new: true })
      .populate({ path: 'location', populate: 'comments' })
      .populate('chat')
      .populate('participants')
      .populate('author')
      .exec();
    return plan;
  } catch (error) {
    console.error('Error while updating plan', error);
    throw error;
  }
});

const deletePlan = authorize(async (_, { _id }, { models, currentUser }) => {
  try {
    const plan = await models.Plan.findOne({
      _id,
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
  },
  Plan: {
    invites: (root, _, { models }) => {
      return models.User.find({ email: { $in: root.invites } }).exec();
    }
  }
};
