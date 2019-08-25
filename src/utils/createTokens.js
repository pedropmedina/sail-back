const jwt = require('jsonwebtoken');
const accessSecret = process.env.ACCESS_JWT_SECRET;
const refreshSecret = process.env.REFRESH_JWT_SECRET;

module.exports = userId => {
  const accessToken = jwt.sign({ userId }, accessSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, refreshSecret, { expiresIn: '7 days' }); // prettier-ignore

  return {
    accessToken,
    refreshToken
  };
};
