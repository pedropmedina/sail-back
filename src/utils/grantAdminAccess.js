const { AuthenticationError } = require('apollo-server');

module.exports = cb => (root, args, ctx, info) => {
  const { currentUser } = ctx;
  if (!currentUser) throw new AuthenticationError('You must be logged in!');
  if (!currentUser.admin) throw new AuthenticationError('Denied admin access!');
  return cb(root, args, ctx, info);
};
