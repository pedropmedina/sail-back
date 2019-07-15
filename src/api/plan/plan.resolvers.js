const getPlan = async (_, { planId }, { models }) => {
  try {
    const plan = await models.Plan.finById(planId)
      .populate({ path: 'location', populate: { path: 'comments' } })
      .populate('invites')
      .populate('chat')
      .populate('author')
      .exec();
    return plan;
  } catch (error) {
    console.error('Error while getting plan', error);
    throw error;
  }
};

const createPlan = async (_, { input }, { models, currentUser }) => {
  try {
    let plan = await new models.Plan({ ...input, author: currentUser }).save();
    const opts = [
      { path: 'location', populate: 'comments' },
      { path: 'invites' },
      { path: 'chat' },
      { path: 'author' }
    ];
    plan = await models.Plan.populate(plan, opts);
    return plan;
  } catch (error) {
    console.error('Error while creating plan', error);
    throw error;
  }
};

const updatePlan = async (_, { input }, { models }) => {
  try {
    const { _id, ...update } = input;
    const plan = await models.Plan.findByIdAndUpdate(_id, update, { new: true })
      .populate({ path: 'location', populate: 'comments' })
      .populate('invites')
      .populate('chat')
      .populate('author')
      .exec();
    return plan;
  } catch (error) {
    console.error('Error while updating plan', error);
    throw error;
  }
};

const deletePlan = async (_, { _id }, { models }) => {
  try {
    const plan = await models.Plan.findById(_id).exec();
    await plan.remove();
    return true;
  } catch (error) {
    console.error('Erro while deleting plan', error);
    throw error;
  }
};

module.exports = {
  Query: {
    getPlan
  },
  Mutation: {
    createPlan,
    updatePlan,
    deletePlan
  }
};
