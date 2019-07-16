const authorize = require('../../utils/authorize');
const grantAdminAccess = require('../../utils/grantAdminAccess');

const getInvites = grantAdminAccess(async (_, __, { models }) => {
  try {
    return await models.Invite.find({})
      .populate('plan')
      .populate('author')
      .exec();
  } catch (error) {
    console.error('Error while getting invites', error);
    throw error;
  }
});

const getInvite = authorize(async (_, { inviteId }, { models }) => {
  try {
    return await models.Invite.findById(inviteId)
      .populate('plans')
      .populate('author')
      .exec();
  } catch (error) {
    console.error('Error while getting invite ', error);
    throw error;
  }
});

const createInvite = authorize(
  async (_, { input }, { models, currentUser }) => {
    try {
      const invite = await new models.Invite({
        ...input,
        author: currentUser._id
      }).save();
      return await models
        .Invite()
        .populate(invite, [{ path: 'plan' }, { path: 'author' }]);
    } catch (error) {
      console.error('Error while creating invite ', error);
      throw error;
    }
  }
);

const updateInvite = authorize(
  async (_, { input: { inviteId, ...update } }, { models }) => {
    try {
      return await models.Invite.findByIdAndUpdate(inviteId, update, {
        new: true
      })
        .populate('plan')
        .populate('author')
        .exec();
    } catch (error) {
      console.error('Error while updating invite ', error);
      throw error;
    }
  }
);

const deleteInvite = authorize(async (_, { inviteId }, { models }) => {
  try {
    return await models.Invite.findByIdAndDelete(inviteId).exec();
  } catch (error) {
    console.error('Error while deleting invite ', error);
    throw error;
  }
});

module.exports = {
  Query: {
    getInvites,
    getInvite
  },
  Mutation: {
    createInvite,
    updateInvite,
    deleteInvite
  }
};
