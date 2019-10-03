const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Conversation = require('../conversation/conversation.model');
const Request = require('../request/request.model');
const { User } = require('../user/user.model');
const areFriends = require('../../utils/areFriends');

const planSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: Schema.Types.ObjectId, ref: 'Pin', required: true },
    date: { type: Schema.Types.Date, required: true },
    invites: [{ type: String, required: true }],
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    chat: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    media: [String],
    private: { type: Boolean, default: false },
    author: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

planSchema.index({ title: 'text', description: 'text' });

planSchema.pre('remove', async function() {
  await Conversation.findOneAndDelete({ plan: this._id }).exec();
  return await Request.deleteMany({ plan: this._id }).exec();
});

// create a request for each user in the invites array
planSchema.pre('save', async function() {
  // push plan's id into author's myPlans and inPlans arrays
  const author = await User.findById(this.author).exec();
  author.myPlans.push(this._id);
  author.inPlans.push(this._id);
  await author.save();

  // push author into plan's participants' array
  this.participants.push(this.author);

  for (let inviteeEmail of this.invites) {
    // check if invitee is friend
    const invitee = await User.findOne({ email: inviteeEmail }).exec();
    const isFriend = areFriends(
      invitee.friends,
      author.friends,
      this.author,
      invitee._id
    );

    // instantiate new request and persist in db
    if (isFriend) {
      const req = await new Request({
        to: inviteeEmail,
        reqType: 'INVITE',
        plan: this._id,
        author: this.author
      }).save();
      // find each user to whom request has been made and push request into receivedRequest array
      invitee.receivedRequests.push(req._id);
      await invitee.save();

      // push and save request into author's sentRequests array
      author.sentRequests.push(req._id);
      await author.save();
    }
  }
});

const Plan = mongoose.model('Plan', planSchema);

module.exports = Plan;
