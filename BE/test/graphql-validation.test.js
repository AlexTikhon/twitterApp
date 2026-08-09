const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildSchema, parse, validate } = require('graphql');

const typeDefs = require('../graphql/schema');
const { createComplexityLimitRule, createDepthLimitRule } = require('../graphql/validation');

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
        posts { _id title content imageUrl }
      }
    }
  `);
  const errors = validate(schema, document, [createComplexityLimitRule(5)]);

  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Query complexity 10 exceeds the maximum of 5/);
});
