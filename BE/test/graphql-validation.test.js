const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildSchema, parse, validate } = require('graphql');

const typeDefs = require('../graphql/schema');
const {
  createComplexityLimitRule,
  createDepthLimitRule,
  createValidationRules
} = require('../graphql/validation');

const schema = buildSchema(typeDefs);

test('GraphQL depth rule rejects deeply nested selections', () => {
  const document = parse(`
    query DeepPosts {
      posts(first: 1) {
        posts {
          creator {
            name
          }
        }
      }
    }
  `);
  const errors = validate(schema, document, [createDepthLimitRule(3)]);

  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Query depth 4 exceeds the maximum of 3/);
});

test('GraphQL complexity rule rejects oversized selection sets', () => {
  const document = parse(`
    query ComplexPosts {
      posts(first: 1) {
        totalItems
        pageInfo { endCursor hasNextPage }
        posts { _id content imageUrl createdAt updatedAt }
      }
    }
  `);
  const errors = validate(schema, document, [createComplexityLimitRule(5)]);

  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Query complexity 11 exceeds the maximum of 5/);
});

const LOGIN_FIELD = 'login(email: "a@example.com", password: "secret-password") { token }';
const validateWithDefaults = (query) =>
  validate(schema, parse(query), createValidationRules({ maxDepth: 8, maxComplexity: 200 }));

test('GraphQL validation rejects batches of aliased authentication fields', () => {
  const aliases = Array.from({ length: 100 }, (_value, index) => `a${index}: ${LOGIN_FIELD}`);
  const errors = validateWithDefaults(`mutation { ${aliases.join('\n')} }`);

  assert.ok(errors.some((error) => /at most one authentication/i.test(error.message)));
});

test('GraphQL validation counts authentication fields reached through fragments', () => {
  const errors = validateWithDefaults(`
    mutation Batch { first: ${LOGIN_FIELD} ...More ... on RootMutation { third: ${LOGIN_FIELD} } }
    fragment More on RootMutation { second: createUser(userInput: { email: "a@b.c", name: "n", password: "p" }) { _id } }
  `);

  assert.ok(errors.some((error) => /at most one authentication/i.test(error.message)));
});

test('GraphQL validation allows a single authentication field next to ordinary fields', () => {
  assert.deepEqual(validateWithDefaults(`mutation { ${LOGIN_FIELD} }`), []);
  assert.deepEqual(validateWithDefaults('query { status { status } }'), []);
});

test('GraphQL complexity rule charges authentication fields as expensive operations', () => {
  const errors = validate(schema, parse(`mutation { ${LOGIN_FIELD} }`), [
    createComplexityLimitRule(50)
  ]);

  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Query complexity \d+ exceeds the maximum of 50/);
});

test('GraphQL validation stays bounded for exponentially expanding fragments', () => {
  const depth = 40;
  const fragments = Array.from(
    { length: depth },
    (_value, index) => `fragment f${index} on RootQuery { ...f${index + 1} ...f${index + 1} }`
  );
  const document = parse(
    `query { ...f0 } ${fragments.join('\n')} fragment f${depth} on RootQuery { status { status } }`
  );
  const rules = createValidationRules({ maxDepth: 8, maxComplexity: 200 });

  const startedAt = performance.now();
  const errors = validate(schema, document, rules.slice(0, 3));

  assert.ok(performance.now() - startedAt < 1000, 'validation must not expand every fragment path');
  assert.ok(errors.length > 0);
});
