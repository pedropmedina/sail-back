const grantOwnerAcces = require('../../utils/grantOwnerAccess');

const getComments = grantOwnerAcces(async (_, __, { models }) => {
  try {
    const comments = await models.Comment.find({})
      .populate('pin')
      .populate('author')
      .exec();
    return comments;
  } catch (error) {
    console.error('Error while querying comments', error);
    throw error;
  }
});

const getComment = grantOwnerAcces(async (_, { commentId }, { models }) => {
  try {
    const comment = await models.Comment.findById(commentId)
      .populate('pin')
      .populate('author')
      .exec();
    return comment;
  } catch (error) {
    console.error(`Error while querying comment of id ${commentId}`, error);
    throw error;
  }
});

const createComment = grantOwnerAcces(
  async (_, { input: { text, pinId } }, { models, currentUser }) => {
    try {
      // create comment
      const comment = await new models.Comment({
        text,
        pin: pinId,
        author: currentUser._id
      }).save();
      // update pin by pushing comment._id into comments' array
      await models.Pin.findOneAndUpdate(
        { _id: pinId, author: currentUser._id },
        { $push: { comments: comment._id } },
        { new: true }
      ).exec();
      // populate comment's fields
      const commentAdded = await models.Comment.populate(
        comment,
        'pin'
      ).populate(comment, 'author');
      return commentAdded;
    } catch (error) {
      console.error('Error creating comment', error);
      throw error;
    }
  }
);

const updateComment = grantOwnerAcces(
  async (
    _,
    { input: { commentId, pinId, ...update } },
    { models, currentUser }
  ) => {
    try {
      const comment = await models.Comment.findOneAndUpdate(
        { _id: commentId, pin: pinId, author: currentUser._id },
        update,
        { new: true }
      )
        .populate('pin')
        .populate('author')
        .exec();
      return comment;
    } catch (error) {
      console.error('Error while updating comment: ', error);
      throw error;
    }
  }
);

const deleteComment = grantOwnerAcces(
  async (_, { input: { commentId, pinId } }, { models, currentUser }) => {
    try {
      // delete matching comment
      const comment = await models.Comment.findOneAndDelete({
        _id: commentId,
        pin: pinId,
        author: currentUser._id
      })
        .populate('pin')
        .populate('author');
      // find pin containing comment and pull comment's id from comments' array
      await models.findByIdAndUpdate(
        pinId,
        {
          $pull: { comments: { $in: [commentId] } }
        },
        { new: true }
      );
      return comment;
    } catch (error) {
      console.error(`Error while deleting comment with id ${commentId}`, error);
      throw error;
    }
  }
);

module.exports = {
  Query: {
    getComments,
    getComment
  },
  Mutation: {
    createComment,
    updateComment,
    deleteComment
  }
};
