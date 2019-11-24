module.exports = (
  res,
  name,
  token,
  options = {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: true,
    sameSite: 'None'
  }
) => {
  res.cookie(name, token, options);
};
