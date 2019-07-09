const mongoose = require('mongoose');

const MONGODB_URI =
  process.env.NODE_ENV === 'dev'
    ? process.env.MONGODB_URI_DEV
    : process.env.MONGODB_URI_PROD;

const db = mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useCreateIndex: true })
  .then(() => console.log('db connected'))
  .catch(err => console.log('Error while connecting to db', err));

module.exports = db;