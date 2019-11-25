const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// const Conversation = require('../conversation/conversation.model');
// const Request = require('../request/request.model');
// const User = require('../user/user.model');
// const areFriends = require('../../utils/areFriends');

const planSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: Schema.Types.ObjectId, ref: 'Pin', required: true },
    date: { type: Schema.Types.Date, required: true },
    invites: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    participants: [
      { type: Schema.Types.ObjectId, ref: 'User', required: true }
    ],
    chat: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    media: [String],
    private: { type: Boolean, default: false },
    author: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

planSchema.index({ title: 'text', description: 'text' });

// push plan's id into author's myPlans and inPlans arrays
planSchema.pre('save', async function(next) {
  if (this.isNew) {
    const User = this.model('User');
    const author = await User.findById(this.author).exec();
    author.myPlans.push(this._id);
    author.inPlans.push(this._id);
    await author.save();

    this.participants.push(author._id);
  }
  next();
});

// remove all requests corresponding to plan
// remove chat corresponding to plan
// update participants' inPlans and myPlans
planSchema.pre('remove', async function(next) {
  const Request = this.model('Request');
  const requests = await Request.find({ plan: { $in: [this._id] } });
  await Promise.all([requests.map(request => request.remove())]);

  const Chat = this.model('Conversation');
  const chat = await Chat.findById(this.chat).exec();
  await chat.remove(); // will remove all messages associated with it

  const User = this.model('User');
  return await User.updateMany(
    { _id: { $in: this.participants } },
    { $pull: { inPlans: this._id, myPlans: this._id } }
  );
});

const Plan = mongoose.model('Plan', planSchema);

module.exports = Plan;
