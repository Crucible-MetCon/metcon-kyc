import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidPhone,
  isValidSAId,
  isValidUrl,
  isValidDate,
  isValidPercentage,
  validateExtraction,
  sanitiseExtraction,
} from '../lib/validation';
import type { KYCExtractionResult } from '../types/kyc';

describe('isValidEmail', () => {
  it('accepts standard emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@company.co.za')).toBe(true);
    expect(isValidEmail('admin@prestige-jewels.co.za')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@no-user.com')).toBe(false);
    expect(isValidEmail('missing@tld')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('accepts SA mobile numbers', () => {
    expect(isValidPhone('0821234567')).toBe(true);
    expect(isValidPhone('+27821234567')).toBe(true);
    expect(isValidPhone('082 123 4567')).toBe(true);
    expect(isValidPhone('082-123-4567')).toBe(true);
  });

  it('accepts international numbers', () => {
    expect(isValidPhone('+44 20 7946 0958')).toBe(true);
    expect(isValidPhone('+1 555 123 4567')).toBe(true);
  });

  it('rejects clearly invalid numbers', () => {
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('not a phone')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });
});

describe('isValidSAId', () => {
  it('accepts a valid SA ID number', () => {
    expect(isValidSAId('9001045800082')).toBe(true);
  });

  it('rejects IDs with wrong length', () => {
    expect(isValidSAId('12345')).toBe(false);
    expect(isValidSAId('12345678901234')).toBe(false);
  });

  it('rejects non-numeric IDs', () => {
    expect(isValidSAId('900104580008X')).toBe(false);
  });

  it('rejects IDs with invalid Luhn check digit', () => {
    expect(isValidSAId('9001045800089')).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('accepts valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('www.prestige-jewels.co.za')).toBe(true);
    expect(isValidUrl('http://sub.domain.org/path')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('missing-tld')).toBe(false);
  });
});

describe('isValidDate', () => {
  it('accepts valid dates', () => {
    expect(isValidDate('2025-12-31')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true); // leap year
  });

  it('rejects invalid dates', () => {
    expect(isValidDate('not-a-date')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});

describe('isValidPercentage', () => {
  it('accepts valid percentages', () => {
    expect(isValidPercentage(0)).toBe(true);
    expect(isValidPercentage(50)).toBe(true);
    expect(isValidPercentage(100)).toBe(true);
  });

  it('rejects out-of-range values', () => {
    expect(isValidPercentage(-1)).toBe(false);
    expect(isValidPercentage(101)).toBe(false);
  });
});

describe('validateExtraction', () => {
  it('passes valid extraction', () => {
    const extraction: KYCExtractionResult = {
      entity_type: 'Company',
      email_address: 'info@company.co.za',
      business_phone_work: '+27111234567',
      website: 'https://company.co.za',
      payment_bank_transfer_pct: 75,
    };
    const result = validateExtraction(extraction);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('catches invalid email', () => {
    const extraction: KYCExtractionResult = { email_address: 'bad-email' };
    const result = validateExtraction(extraction);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'email_address')).toBe(true);
  });

  it('generates warning for unusual phone', () => {
    const extraction: KYCExtractionResult = { business_phone_work: '123' };
    const result = validateExtraction(extraction);
    expect(result.warnings.some((w) => w.field === 'business_phone_work')).toBe(true);
  });

  it('validates ownership percentage on associated persons', () => {
    const extraction: KYCExtractionResult = {
      associated_persons: [{ ownership_percentage: 150 }],
    };
    const result = validateExtraction(extraction);
    expect(result.valid).toBe(false);
  });
});

describe('sanitiseExtraction', () => {
  it('removes invalid fields but keeps valid ones', () => {
    const extracted: KYCExtractionResult = {
      email_address: 'bad-email',
      registered_name: 'Acme Ltd',
    };
    const validation = validateExtraction(extracted);
    const sanitised = sanitiseExtraction(extracted, validation);
    expect(sanitised.registered_name).toBe('Acme Ltd');
    expect(sanitised.email_address).toBeUndefined();
  });
});
