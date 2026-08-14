const { requireAuthenticatedUser } = require('./shared');

module.exports = {
  RootQuery: {
    user: (_parent, { id }, context) => {
      requireAuthenticatedUser(context.req);
      return context.services.profile.getUser(id);
    },
    status: (_parent, _args, context) =>
      context.services.profile.getStatus(requireAuthenticatedUser(context.req))
  },
  RootMutation: {
    updateStatus: (_parent, { status }, context) =>
      context.services.profile.updateStatus(requireAuthenticatedUser(context.req), status)
  }
};
