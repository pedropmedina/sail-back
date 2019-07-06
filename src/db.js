const mongoose = require('mongoose');

mongoose
  .connect('mongodb://localhost:27017/plat', { useNewUrlParser: true })
  .then(() => console.log('db connected'))
  .catch(err => console.log('Error while connecting to db', err));
