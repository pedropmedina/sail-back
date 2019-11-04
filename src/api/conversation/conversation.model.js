const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Message = require('../message/message.model');

const unreadCountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true },
  count: { type: Number, default: 0 }
});

const conversationSchema = new Schema(
  {
    participants: [
      { type: Schema.Types.ObjectId, ref: 'User', required: true }
    ],
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

conversationSchema.methods.setUnreadCount = function(usersId) {
  const unreadCount = usersId.reduce((unreadCount, userId) => {
    unreadCount.push({ userId });
    return unreadCount;
  }, []);
  this.unreadCount = unreadCount;
  return this;
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
