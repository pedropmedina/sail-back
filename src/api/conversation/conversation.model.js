const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Message = require('../message/message.model');

const unreadCountSchema = new Schema({
  username: { type: String, required: true },
  count: { type: Number, default: 0 }
});

const conversationSchema = new Schema(
  {
    participants: [{ type: String, required: true }],
    messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    plan: { type: Schema.Types.ObjectId, ref: 'Plan' },
    unreadCount: [unreadCountSchema]
  },
  { timestamps: true }
);

// do a cleanup following the deletion of a conversation
conversationSchema.pre('remove', async function() {
  return await Message.deleteMany({ conversation: this._id }).exec();
});

conversationSchema.pre('save', async function(next) {
  // iterate over participants and prepare unreadCount
  const unreadCount = this.participants.reduce((unreadCount, participant) => {
    unreadCount.push({ username: participant });
    return unreadCount;
  }, []);
  this.unreadCount = unreadCount;
  next();
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
