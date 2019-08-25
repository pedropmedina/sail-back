const setCookies = (res, { accessToken, refreshToken }) => {
  res.cookie('access-token', accessToken, { maxAge: 15 * 60 * 1000 });
  res.cookie('refresh-token', refreshToken, { maxAge: 7 * 24 * 60 * 60 * 1000 }); // prettier-ignore
};

const getCookies = req => {
  const accessToken = req.cookies['access-token'];
  const refreshToken = req.cookies['refresh-token'];
  return { accessToken, refreshToken };
};

module.exports = {
  setCookies,
  getCookies
};
