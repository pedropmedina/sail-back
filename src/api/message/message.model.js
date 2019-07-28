const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Conversation = require('../conversation/conversation.model');
const { User } = require('../user/user.model');

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

messageSchema.pre('save', async function() {
  const conversation = await Conversation.findById(this.conversation).exec();
  conversation.messages.push(this._id);
  for (let participantId of this.participants) {
    const user = await User.findById(participantId).exec();
    conversation.messagesKeyedByUsername[user.username].push(this._id);
  }
  await conversation.save();
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
