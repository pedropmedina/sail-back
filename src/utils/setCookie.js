module.exports = (
  res,
  name,
  token,
  options = { httpOnly: true, secure: false, sameSite: 'None' }
) => {
  res.cookie(name, token, options);
};
