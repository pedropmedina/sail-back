const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Comment = require('../comment/comment.model');

const pinSchema = new Schema(
  {
    title: { type: String, index: true, required: true, text: true },
    content: { type: String, text: true },
    image: String,
    latitude: Number,
    longitude: Number,
    comments: [{ type: Schema.Types.ObjectId, ref: 'Comment' }],
    author: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

// remove all comments corresponding to pin upon deletion of pin
pinSchema.pre('remove', async function() {
  await Comment.deleteMany({ pin: this._id }).exec();
});

// create pin model
const Pin = mongoose.model('Pin', pinSchema);

module.exports = Pin;
