const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createAuthBudget } = require('../graphql/auth-budget');
const authResolvers = require('../graphql/resolvers/auth');

const createContext = () => {
  const calls = [];
  return {
    calls,
    authBudget: createAuthBudget(),
    services: {
      auth: {
        login: async (email) => (calls.push(email), { token: 'token' }),
        signup: async (input) => (calls.push(input.email), { _id: 'user-id' })
      }
    }
  };
};

test('a request can perform only one expensive authentication, even if validation is bypassed', async () => {
  const context = createContext();
  const { login, createUser } = authResolvers.RootMutation;

  await login({}, { email: 'first@example.com', password: 'secret' }, context);
  await assert.rejects(login({}, { email: 'second@example.com', password: 'secret' }, context), {
    statusCode: 429
  });
  await assert.rejects(createUser({}, { userInput: { email: 'third@example.com' } }, context), {
    statusCode: 429
  });

  assert.deepEqual(context.calls, ['first@example.com']);
});

test('authentication fails closed when the request has no budget', async () => {
  const context = createContext();
  delete context.authBudget;

  await assert.rejects(
    authResolvers.RootMutation.login({}, { email: 'a@example.com', password: 'secret' }, context)
  );
  assert.deepEqual(context.calls, []);
});
