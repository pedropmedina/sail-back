const getComments = async (_, __, { Comment }) => {
  try {
    const comments = await Comment.find({})
      .populate('Pin')
      .exec();
    return comments;
  } catch (error) {
    console.error('Error while querying comments', error);
  }
};

const getComment = async (_, { id }, { Comment }) => {
  try {
    const comment = await Comment.findById(id)
      .populate('Pin')
      .exec();
    return comment;
  } catch (error) {
    console.error(`Error while querying comment of id ${id}`, error);
  }
};

const createComment = async (_, { input }, { Comment }) => {
  try {
    const comment = await new Comment(input).save();
    return comment;
  } catch (error) {
    console.error('Error creating comment', error);
  }
};

const updateComment = async (_, { id, ...update }, { Comment }) => {
  try {
    const comment = await Comment.findByIdAndUpdate(id, update, { new: true })
      .populate('Pin')
      .exec();
    return comment;
  } catch (error) {
    console.error();
  }
};

const deleteComment = async (_, { id }, { Comment }) => {
  try {
    const comment = await Comment.findByIdAndDelete(id).exec();
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
