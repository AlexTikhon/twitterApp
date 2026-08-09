import { describe, expect, it } from 'vitest';

import { email, length, required } from './validators';

describe('form validators', () => {
  it('treats whitespace-only values as missing', () => {
    expect(required('   ')).toBe(false);
    expect(required(' value ')).toBe(true);
  });

  it('enforces trimmed minimum and maximum lengths', () => {
    const validator = length({ min: 2, max: 4 });

    expect(validator(' a ')).toBe(false);
    expect(validator(' ab ')).toBe(true);
    expect(validator('abcde')).toBe(false);
  });

  it('accepts complete email values and rejects surrounding garbage', () => {
    expect(email('person@example.com')).toBe(true);
    expect(email('prefix person@example.com suffix')).toBe(false);
    expect(email('missing-domain@')).toBe(false);
  });
});
