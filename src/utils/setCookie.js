module.exports = (res, name, token, options = { httpOnly: true }) => {
  res.cookie(name, token, options);
};
