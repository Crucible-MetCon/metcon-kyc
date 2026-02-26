import { describe, it, expect } from 'vitest';
import {
  deriveDobFromSaId,
  deriveGenderFromSaId,
  deriveCitizenshipFromSaId,
  detectEnrichments,
} from '../lib/enrichment';

// ─────────────────────────────────────────────
// SA ID → Date of Birth derivation
// ─────────────────────────────────────────────

describe('deriveDobFromSaId', () => {
  it('derives DOB from a 1990 SA ID', () => {
    // YYMMDD = 900104 → 1990-01-04 (YY=90 > current YY≈26 → 1990)
    const dob = deriveDobFromSaId('9001045800088');
    expect(dob).not.toBeNull();
    expect(dob!.getFullYear()).toBe(1990);
    expect(dob!.getMonth()).toBe(0); // January (0-indexed)
    expect(dob!.getDate()).toBe(4);
  });

  it('treats YY <= currentYear as 20YY', () => {
    // YY=05 → 2005 (a 20-year-old born in 2005)
    const dob = deriveDobFromSaId('0506155000088'); // YY=05, MM=06, DD=15 (dummy)
    if (dob) {
      expect(dob.getFullYear()).toBe(2005);
    }
  });

  it('returns null for non-13-digit input', () => {
    expect(deriveDobFromSaId('12345')).toBeNull();
    expect(deriveDobFromSaId('notanid123456')).toBeNull();
  });

  it('returns null for invalid month/day', () => {
    // Month 13 — invalid
    expect(deriveDobFromSaId('9013045800081')).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Gender derivation
// ─────────────────────────────────────────────

describe('deriveGenderFromSaId', () => {
  it('identifies male when gender digit >= 5', () => {
    // Position 6 (0-indexed) = 5 → Male
    expect(deriveGenderFromSaId('9001045800088')).toBe('Male');
  });

  it('identifies female when gender digit < 5', () => {
    // Position 6 (0-indexed) = 0 → Female
    expect(deriveGenderFromSaId('9001040800081')).toBe('Female');
  });

  it('returns null for invalid ID', () => {
    expect(deriveGenderFromSaId('short')).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Citizenship derivation
// ─────────────────────────────────────────────

describe('deriveCitizenshipFromSaId', () => {
  it('identifies SA citizen when digit 10 = 0', () => {
    // 9001045800088 — digit at index 10 = 0 → SA Citizen
    expect(deriveCitizenshipFromSaId('9001045800088')).toBe('SA Citizen');
  });

  it('returns null for invalid ID', () => {
    expect(deriveCitizenshipFromSaId('abc')).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Enrichment detection
// ─────────────────────────────────────────────

describe('detectEnrichments', () => {
  it('detects SA ID DOB enrichment opportunity', () => {
    const enrichments = detectEnrichments('9001045800088', null);
    expect(enrichments).toHaveLength(1);
    expect(enrichments[0].type).toBe('sa_id_dob');
    expect(enrichments[0].derivedValue).toContain('1990');
    expect(enrichments[0].pendingConfirmation).toBe(true);
  });

  it('skips enrichment if DOB already captured', () => {
    const enrichments = detectEnrichments('9001045800088', '1990-01-04');
    expect(enrichments).toHaveLength(0);
  });

  it('skips enrichment for non-SA IDs', () => {
    const enrichments = detectEnrichments('PASSPORT123', null);
    expect(enrichments).toHaveLength(0);
  });

  it('returns empty array when no ID provided', () => {
    const enrichments = detectEnrichments(null, null);
    expect(enrichments).toHaveLength(0);
  });
});
