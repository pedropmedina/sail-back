const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Conversation = require('../conversation/conversation.model');
const Request = require('../request/request.model');
const User = require('../user/user.model');
// const areFriends = require('../../utils/areFriends');

const planSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: Schema.Types.ObjectId, ref: 'Pin', required: true },
    date: { type: Schema.Types.Date, required: true },
    invites: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    chat: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    media: [String],
    private: { type: Boolean, default: false },
    author: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

planSchema.index({ title: 'text', description: 'text' });

// clean up following the deletion of plan
planSchema.pre('remove', async function() {
  const conversation = await Conversation.findOne({ plan: this._id }).exec();
  await conversation.remove();
  return await Request.deleteMany({ plan: this._id }).exec();
});

// push plan's id into author's myPlans and inPlans arrays
planSchema.pre('save', async function(next) {
  if (this.isNew) {
    const author = await User.findById(this.author).exec();
    author.myPlans.push(this._id);
    author.inPlans.push(this._id);
    await author.save();

    this.participants.push(author._id);
  }
  next();
});

const Plan = mongoose.model('Plan', planSchema);

module.exports = Plan;
