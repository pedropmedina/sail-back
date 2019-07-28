const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Message = require('../message/message.model');

const conversationSchema = new Schema(
  {
    participants: [{ type: String, required: true }],
    messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    messagesKeyedByUsername: Schema.Types.Mixed,
    author: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

// construct messagesKeyedByUsername field allowing participants to isolate
// their own copy of messages that can be manipulated as wished
conversationSchema.methods.keyMessagesByUser = function(authorUsername) {
  this.participants.push(authorUsername);
  this.messagesKeyedByUsername = this.participants.reduce(
    (messages, username) => {
      messages[username] = [];
      return messages;
    },
    {}
  );
  return this;
};

conversationSchema.pre('remove', async function() {
  // delete messages corresponding to conversation
  return await Message.deleteMany({ conversation: this._id }).exec();
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
