const assert = require('node:assert/strict');
const { test } = require('node:test');

const { decodeCursor, encodeCursor } = require('../domain/cursor');

test('cursor codec round-trips the compound timeline position through an opaque value', () => {
  const id = '507f1f77bcf86cd799439011';
  const createdAt = new Date('2026-08-09T12:00:00.000Z');
  const cursor = encodeCursor({ id, createdAt });

  assert.notEqual(cursor, id);
  assert.deepEqual(decodeCursor(cursor), { id, createdAt });
});

test('cursor codec rejects malformed and non-object-id values', () => {
  assert.throws(() => decodeCursor('not+a+cursor'), /Invalid cursor/);
  assert.throws(
    () =>
      decodeCursor(Buffer.from(JSON.stringify(['not-a-date', 'not-an-id'])).toString('base64url')),
    /Invalid cursor/
  );
  assert.throws(
    () => decodeCursor(Buffer.from('legacy-id-only').toString('base64url')),
    /Invalid cursor/
  );
});
