const mongoose = require('mongoose');
const validator = require('validator');
const Schema = mongoose.Schema;

const Pin = require('../pin/pin.model');

const userSchema = new Schema(
  {
    username: {
      type: String,
      unique: true,
      trim: true,
      index: true,
      text: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
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
    name: { type: String, index: true, text: true },
    about: String,
    address: {
      longitude: Number,
      latitude: Number
    },
    image: String,
    myPlans: [{ type: Schema.Types.ObjectId, ref: 'Plan' }],
    inPlans: [{ type: Schema.Types.ObjectId, ref: 'Plan' }],
    myPins: [{ type: Schema.Types.ObjectId, ref: 'Pin' }],
    likedPins: [{ type: Schema.Types.ObjectId, ref: 'Pin' }],
    friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    sentRequests: [{ type: Schema.Types.ObjectId, ref: 'Request' }],
    receivedRequests: [{ type: Schema.Types.ObjectId, ref: 'Request' }],
    admin: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// middleware in charge of removing corresponding pins to removed user
// use pin.remove to trigger 'pre' hook upon removal of pin and delete all comments corresponding to each pin
userSchema.pre('remove', async function() {
  try {
    const pins = await Pin.find({ author: this._id });
    await Promise.all(pins.map(pin => pin.remove()));
  } catch (error) {
    console.error('Error while deleting user!');
    throw error;
  }
});

// create default username from user's email upon signing up
userSchema.pre('save', function(next) {
  if (this.isNew) {
    const username = this.email.split('@')[0];
    this.username = username;
  }
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
