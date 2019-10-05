const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const STATUSES = ['PENDING', 'ACCEPTED', 'DENIED'];
const REQUEST_TYPE = ['FRIEND', 'INVITE'];

const requestSchema = new Schema(
  {
    to: { type: String, required: true, index: true },
    status: { type: String, enum: STATUSES, default: 'PENDING' },
    reqType: { type: String, enum: REQUEST_TYPE },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: Schema.Types.ObjectId, ref: 'Plan' }
  },
  { timestamps: true }
);

//TODO: update request author's sentRequests array upon creating new request and update "to" user's received requests array as well

const Request = mongoose.model('Request', requestSchema);

module.exports = Request;
