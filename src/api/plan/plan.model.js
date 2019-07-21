const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Conversation = require('../conversation/conversation.model');
const Request = require('../request/request.model');

const planSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: Schema.Types.ObjectId, ref: 'Pin', required: true },
    date: { type: Schema.Types.Date, required: true },
    invites: [{ type: Schema.Types.ObjectId, ref: 'Request' }],
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    chat: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    media: [String],
    private: { type: Boolean, default: false },
    author: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

const Plan = mongoose.model('Plan', planSchema);

planSchema.pre('remove', async function() {
  await Conversation.findOne({ plan: this._id }).exec();
  return await Request.deleteMany({ plan: this._id }).exec();
});

module.exports = Plan;
