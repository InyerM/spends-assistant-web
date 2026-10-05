import { describe, expect, it } from 'vitest';
import { emailForwardingKeys } from '@/lib/api/queries/email-forwarding.queries';

describe('email forwarding query keys', () => {
  it('separates route state for different signed-in owners', () => {
    expect(emailForwardingKeys.route('owner-a')).not.toEqual(emailForwardingKeys.route('owner-b'));
  });
});
