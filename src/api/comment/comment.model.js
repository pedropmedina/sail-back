const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const commentSchema = new Schema(
  {
    text: { type: String, required: true },
    pin: { type: Schema.Types.ObjectId, ref: 'Pin', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Comment', commentSchema);
