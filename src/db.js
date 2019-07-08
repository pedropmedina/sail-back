const mongoose = require('mongoose');

const MONGODB_URI =
  process.env.NODE_ENV === 'dev'
    ? process.env.MONGODB_URI_DEV
    : process.env.MONGODB_URI_PROD;

mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true })
  .then(() => console.log('db connected'))
  .catch(err => console.log('Error while connecting to db', err));
