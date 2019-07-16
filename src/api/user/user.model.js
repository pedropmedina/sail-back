const mongoose = require('mongoose');
const validator = require('validator');
const Schema = mongoose.Schema;

const Pin = require('../pin/pin.model');

const userSchema = new Schema(
  {
    username: { type: String, unique: true, trim: true, index: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: validator.isEmail,
        message: props => `${props.value} is not a valid email!`
      }
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    name: String,
    address: {
      street1: String,
      street2: String,
      city: String,
      state: String,
      zip: String
    },
    image: String,
    plans: [{ type: Schema.Types.ObjectId, ref: 'Plan' }],
    pins: [{ type: Schema.Types.ObjectId, ref: 'Pin' }],
    likedPins: [{ type: Schema.Types.ObjectId, ref: 'Pin' }],
    friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    admin: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const blacklistedTokenSchema = new Schema({
  token: { type: String, required: true, unique: true }
});

const User = mongoose.model('User', userSchema);
const BlacklistedToken = mongoose.model(
  'BlacklistedToken',
  blacklistedTokenSchema
);

// middleware in charge of removing corresponding pins to removed user
// use pin.remove to trigger 'pre' hook upon removal of pin and delete all comments corresponding to each pin
userSchema.pre('remove', async function() {
  try {
    const pins = await Pin.find({ author: this._id });
    return await Promise.all(pins.map(pin => pin.remove()));
  } catch (error) {
    console.error('Error while deleting user!');
  }
});

userSchema.pre('save', function(next) {
  if (this.isNew) {
    const username = this.email.split('@')[0];
    this.username = username;
    console.log('saved for the first time!!!!');
  }
  next();
});

module.exports = {
  User,
  BlacklistedToken
};
