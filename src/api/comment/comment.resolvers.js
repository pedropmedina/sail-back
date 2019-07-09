const getComments = async (_, __, { models }) => {
  try {
    const comments = await models.Comment.find({})
      .populate('Pin')
      .exec();
    return comments;
  } catch (error) {
    console.error('Error while querying comments', error);
  }
};

const getComment = async (_, { id }, { models }) => {
  try {
    const comment = await models.Comment.findById(id)
      .populate('Pin')
      .exec();
    return comment;
  } catch (error) {
    console.error(`Error while querying comment of id ${id}`, error);
  }
};

const createComment = async (_, { input }, { models }) => {
  try {
    const comment = await new models.Comment(input).save();
    return comment;
  } catch (error) {
    console.error('Error creating comment', error);
  }
};

const updateComment = async (_, { id, ...update }, { models }) => {
  try {
    const comment = await models.Comment.findByIdAndUpdate(id, update, {
      new: true
    })
      .populate('Pin')
      .exec();
    return comment;
  } catch (error) {
    console.error();
  }
};

const deleteComment = async (_, { id }, { models }) => {
  try {
    const comment = await models.Comment.findByIdAndDelete(id).exec();
    return comment;
  } catch (error) {
    console.error(`Error while deleting comment with id ${id}`, error);
  }
};

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
