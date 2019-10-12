const { PubSub } = require('apollo-server');
const grantOwnerAcces = require('../../utils/authorize');

const pubsub = new PubSub();

const COMMENT_CREATED = 'COMMENT_CREATED';
const COMMENT_UPDATED = 'COMMENT_UPDATED';
const COMMENT_DELETED = 'COMMENT_DELETED';

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
  async (_, { input: { content, pinId } }, { models, currentUser }) => {
    try {
      // create comment
      const comment = await new models.Comment({
        content,
        pin: pinId,
        author: currentUser._id
      }).save();
      // populate comment's fields
      const commentCreated = await models.Comment.populate(comment, [
        { path: 'pin' },
        { path: 'author' }
      ]);

      // update pin by pushing comment._id into comments' array
      await models.Pin.findByIdAndUpdate(
        pinId,
        { $push: { comments: comment._id } },
        { new: true }
      ).exec();

      // publish updated pin
      pubsub.publish(COMMENT_CREATED, { commentCreated });

      return commentCreated;
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
      const commentUpdated = await models.Comment.findOneAndUpdate(
        { _id: commentId, pin: pinId, author: currentUser._id },
        update,
        { new: true }
      )
        .populate('pin')
        .populate('author')
        .exec();

      pubsub.publish(COMMENT_UPDATED, { commentUpdated });

      return commentUpdated;
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
      const commentDeleted = await models.Comment.findOneAndDelete({
        _id: commentId,
        pin: pinId,
        author: currentUser._id
      })
        .populate('pin')
        .populate('author');
      // find pin containing comment and pull comment's id from comments' array
      await models.Pin.findByIdAndUpdate(
        pinId,
        {
          $pull: { comments: { $in: [commentId] } }
        },
        { new: true }
      );

      pubsub.publish(COMMENT_DELETED, { commentDeleted });

      return commentDeleted;
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
  },
  Subscription: {
    commentCreated: {
      subscribe: () => pubsub.asyncIterator(COMMENT_CREATED)
    },
    commentUpdated: {
      subscribe: () => pubsub.asyncIterator(COMMENT_UPDATED)
    },
    commentDeleted: {
      subscribe: () => pubsub.asyncIterator(COMMENT_DELETED)
    }
  }
};
