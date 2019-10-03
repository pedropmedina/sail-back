module.exports = (req, cookieName) => {
  return req.cookies[cookieName];
};
