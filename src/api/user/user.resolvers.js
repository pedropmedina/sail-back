const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const getUsers = () => {};
const getUser = () => {};
const signupUser = () => {};
const loginUser = () => {};
const logoutUser = () => {};
const updateUser = () => {};
const deleteUser = () => {};

module.exports = {
  Query: {
    getUsers,
    getUser
  },
  Mutation: {
    signupUser,
    loginUser,
    logoutUser,
    updateUser,
    deleteUser
  }
};
