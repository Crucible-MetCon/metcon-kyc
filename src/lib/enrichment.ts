import { EnrichmentSuggestion } from '@/types/kyc';

// ─────────────────────────────────────────────
// SA ID Number → Date of Birth Derivation
// ─────────────────────────────────────────────

export function deriveDobFromSaId(idNumber: string): Date | null {
  const cleaned = idNumber.replace(/\s/g, '');
  if (!/^\d{13}$/.test(cleaned)) return null;

  const yy = parseInt(cleaned.substring(0, 2), 10);
  const mm = parseInt(cleaned.substring(2, 4), 10);
  const dd = parseInt(cleaned.substring(4, 6), 10);

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  // Century logic: if 20YY is in the future, treat as 19YY
  const currentYY = new Date().getFullYear() % 100;
  const fullYear = yy <= currentYY ? 2000 + yy : 1900 + yy;

  const dob = new Date(fullYear, mm - 1, dd);
  if (isNaN(dob.getTime())) return null;

  return dob;
}

export function formatDob(date: Date): string {
  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────
// Detect enrichment opportunities in extracted data
// ─────────────────────────────────────────────

export function detectEnrichments(
  idNumber: string | undefined | null,
  currentDob: string | undefined | null
): EnrichmentSuggestion[] {
  const suggestions: EnrichmentSuggestion[] = [];

  if (idNumber && !currentDob) {
    const cleaned = idNumber.replace(/\s/g, '');
    if (/^\d{13}$/.test(cleaned)) {
      const dob = deriveDobFromSaId(cleaned);
      if (dob) {
        const formatted = formatDob(dob);
        suggestions.push({
          type: 'sa_id_dob',
          field: 'date_of_birth',
          derivedValue: formatted,
          confirmationPrompt: `Based on the ID number provided, I can see your date of birth would be **${formatted}**. Can you confirm this is correct? (Just say yes or no)`,
          pendingConfirmation: true,
        });
      }
    }
  }

  return suggestions;
}

// ─────────────────────────────────────────────
// SA ID gender derivation (bonus info)
// ─────────────────────────────────────────────

export function deriveGenderFromSaId(idNumber: string): 'Male' | 'Female' | null {
  const cleaned = idNumber.replace(/\s/g, '');
  if (!/^\d{13}$/.test(cleaned)) return null;

  const genderDigit = parseInt(cleaned[6], 10);
  return genderDigit >= 5 ? 'Male' : 'Female';
}

// ─────────────────────────────────────────────
// SA ID citizenship derivation
// ─────────────────────────────────────────────

export function deriveCitizenshipFromSaId(idNumber: string): 'SA Citizen' | 'Permanent Resident' | null {
  const cleaned = idNumber.replace(/\s/g, '');
  if (!/^\d{13}$/.test(cleaned)) return null;

  const citizenDigit = parseInt(cleaned[10], 10);
  return citizenDigit === 0 ? 'SA Citizen' : 'Permanent Resident';
}
