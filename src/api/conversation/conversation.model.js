const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const { User } = require('../user/user.model');
const Message = require('../message/message.model');

const conversationSchema = new Schema(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    messagesKeyedByUsername: Schema.Types.Mixed,
    author: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

// prepare messagesKeyedByUsername to represent an array of messages by participant's username
// this isolates messages by user allowing user to delete messages as pleased without altering other user's conversation
conversationSchema.pre('save', function(next) {
  if (this.isNew) {
    this.messagesKeyedByUsername = this.participants.reduce(
      async (participants, participantId) => {
        const user = await User.findById(participantId).exec();
        participants[user.username] = [];
        return participants;
      },
      {}
    );
  }
  next();
});

conversationSchema.pre('remove', async function() {
  // delete messages corresponding to conversation
  return await Message.deleteMany({ conversation: this._id }).exec();
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
