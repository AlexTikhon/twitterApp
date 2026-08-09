const { requireAuthenticatedUser } = require('./shared');

module.exports = {
  RootQuery: {
    status: (_parent, _args, context) =>
      context.services.profile.getStatus(requireAuthenticatedUser(context.req))
  },
  RootMutation: {
    updateStatus: (_parent, { status }, context) =>
      context.services.profile.updateStatus(requireAuthenticatedUser(context.req), status)
  }
};
