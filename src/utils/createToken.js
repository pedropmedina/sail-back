const jwt = require('jsonwebtoken');
const accessSecret = process.env.ACCESS_JWT_SECRET;
const refreshSecret = process.env.REFRESH_JWT_SECRET;

module.exports = (payload, type) => {
  const tokenTypes = {
    access: { secret: accessSecret, options: { expiresIn: '15s' } },
    refresh: { secret: refreshSecret, options: { expiresIn: '7 days' } }
  };
  return jwt.sign(payload, tokenTypes[type].secret, tokenTypes[type].options);
};
