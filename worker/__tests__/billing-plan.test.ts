import { describe, expect, it } from 'vitest';
import { proProductId } from '../index';

describe('which Pro product a checkout is for', () => {
  it('is the yearly product only when one is set up and a year is asked for', () => {
    const both = { POLAR_PRODUCT_ID: 'monthly', POLAR_YEARLY_PRODUCT_ID: 'yearly' };
    expect(proProductId(both, 'year')).toBe('yearly');
    expect(proProductId(both, 'month')).toBe('monthly');
    expect(proProductId(both, undefined)).toBe('monthly');
    expect(proProductId(both, 'decade')).toBe('monthly');
    // No yearly product yet: a year asked for is still a working checkout.
    expect(proProductId({ POLAR_PRODUCT_ID: 'monthly' }, 'year')).toBe('monthly');
  });
});
