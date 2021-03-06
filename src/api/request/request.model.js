const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const STATUSES = ['PENDING', 'ACCEPTED', 'DENIED'];
const REQUEST_TYPE = ['FRIEND', 'INVITE'];

const requestSchema = new Schema(
  {
    to: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: { type: String, enum: STATUSES, default: 'PENDING' },
    reqType: { type: String, enum: REQUEST_TYPE },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: Schema.Types.ObjectId, ref: 'Plan' }
  },
  { timestamps: true }
);

// update author's sentRequests upon removal of request
requestSchema.pre('remove', async function(next) {
  const User = this.model('User');
  return await User.findByIdAndUpdate(this.author, {
    $pull: { sentRequests: this._id }
  });
});

const Request = mongoose.model('Request', requestSchema);

module.exports = Request;
