const mongoose = require('mongoose');

const db = mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false
  })
  .then(() => console.log('🗄  db is connected'))
  .catch(err => console.log('Error while connecting to db', err));

module.exports = db;
