const assert = require('node:assert/strict');
const { test } = require('node:test');

const { decodeCursor, encodeCursor } = require('../domain/cursor');

test('cursor codec round-trips an object id through an opaque value', () => {
  const id = '507f1f77bcf86cd799439011';
  const cursor = encodeCursor(id);

  assert.notEqual(cursor, id);
  assert.equal(decodeCursor(cursor), id);
});

test('cursor codec rejects malformed and non-object-id values', () => {
  assert.throws(() => decodeCursor('not+a+cursor'), /Invalid cursor/);
  assert.throws(
    () => decodeCursor(Buffer.from('not-an-id').toString('base64url')),
    /Invalid cursor/
  );
});
