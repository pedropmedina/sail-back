const mongoose = require('mongoose');
const validator = require('validator');
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    name: String,
    username: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: validator.isEmail,
        message: props => `${props.value} is not a valid email!`
      },
      index: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    image: String,
    pins: [{ type: Schema.Types.ObjectId, ref: 'Pin' }],
    admin: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const blacklistedTokenSchema = new Schema({
  token: { type: String, required: true, unique: true }
});

module.exports = {
  User: mongoose.model('User', userSchema),
  BlacklistedToken: mongoose.model('BlacklistedToken', blacklistedTokenSchema)
};
