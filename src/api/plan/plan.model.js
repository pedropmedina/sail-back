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
    invites: [{ type: String, required: true }],
    participants: [{ type: String, required: true }],
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
// push author into plan's participants' array
planSchema.pre('save', async function() {
  const author = await User.findById(this.author).exec();
  author.myPlans.push(this._id);
  author.inPlans.push(this._id);
  await author.save();

  this.participants.push(author.username);
});

const Plan = mongoose.model('Plan', planSchema);

module.exports = Plan;
