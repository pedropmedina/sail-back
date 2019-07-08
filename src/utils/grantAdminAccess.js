const { AuthenticationError } = require('apollo-server');

module.exports = cb => (root, args, ctx, info) => {
  const { currentUser } = ctx;
  if (currentUser.admin)
    throw new AuthenticationError('You must have admin access!');
  cb(root, args, ctx, info);
};
