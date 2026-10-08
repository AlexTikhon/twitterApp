const { createError } = require('../domain/errors');

// Each GraphQL request may run this many password hashes. Validation already limits operations to
// one authentication field; this is the independent guard at the resolver boundary.
const MAX_AUTH_OPERATIONS_PER_REQUEST = 1;

const createAuthBudget = (limit = MAX_AUTH_OPERATIONS_PER_REQUEST) => {
  let remaining = limit;

  return {
    spend() {
      if (remaining <= 0) {
        throw createError('Too many authentication operations in one request.', 429);
      }
      remaining -= 1;
    }
  };
};

const spendAuthBudget = (context) => {
  if (!context.authBudget) {
    throw new Error('GraphQL context is missing an authentication budget.');
  }
  context.authBudget.spend();
};

module.exports = { createAuthBudget, spendAuthBudget };
