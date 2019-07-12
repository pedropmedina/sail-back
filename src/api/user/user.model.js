const mongoose = require('mongoose');
const validator = require('validator');
const Schema = mongoose.Schema;

const Pin = require('../pin/pin.model');

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
    likes: [{ type: Schema.Types.ObjectId, ref: 'Pin' }],
    admin: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const blacklistedTokenSchema = new Schema({
  token: { type: String, required: true, unique: true }
});

// middleware in charge of removing corresponding pins to removed user
// use pin.remove to trigger 'pre' hook upon removal of pin and delete all comments corresponding to each pin
userSchema.pre('remove', async function() {
  try {
    const pins = await Pin.find({ author: this._id });
    await Promise.all(pins.map(pin => pin.remove()));
  } catch (error) {
    console.error('Error while deleting user!');
  }
});

module.exports = {
  User: mongoose.model('User', userSchema),
  BlacklistedToken: mongoose.model('BlacklistedToken', blacklistedTokenSchema)
};
