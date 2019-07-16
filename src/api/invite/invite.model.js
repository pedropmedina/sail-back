const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const STATUSES = ['PENDING', 'ACCEPTED', 'DENIED'];

const inviteSchema = new Schema(
  {
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    status: { type: String, enum: STATUSES, default: 'PENDING' },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

const Invite = mongoose.model('Invite', inviteSchema);

module.exports = Invite;
