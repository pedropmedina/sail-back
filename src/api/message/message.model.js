const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true
    },
    content: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

// // add message to corresponding conversation
// // markModified path is required to persist changes made to mixed types in mongoose
// messageSchema.methods.addMessageToConversation = async function(Conversation) {
//   const conversation = await Conversation.findById(this.conversation).exec();
//   conversation.messages.push(this._id);
//   for (let username of conversation.participants) {
//     conversation.keyedMessagesByUser[username].push(this._id);
//     conversation.markModified(`keyedMessagesByUser.${username}`);
//   }
//   return await conversation.save();
// };

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
