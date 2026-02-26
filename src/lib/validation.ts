import { KYCExtractionResult, ValidationResult, ValidationError } from '@/types/kyc';

// ─────────────────────────────────────────────
// Individual field validators
// ─────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  // Accept SA numbers (+27..., 0...) and international formats
  const cleaned = phone.replace(/[\s\-().]/g, '');
  return /^(\+?27|0)[0-9]{9}$/.test(cleaned) || /^\+[1-9][0-9]{6,14}$/.test(cleaned);
}

export function isValidSAId(id: string): boolean {
  const cleaned = id.replace(/\s/g, '');
  if (!/^\d{13}$/.test(cleaned)) return false;

  // Luhn checksum validation
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    let digit = parseInt(cleaned[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cleaned[12], 10);
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.includes('.');
  } catch {
    return false;
  }
}

export function isValidDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

export function isValidPercentage(val: number): boolean {
  return val >= 0 && val <= 100;
}

// ─────────────────────────────────────────────
// Full extraction result validator
// ─────────────────────────────────────────────

export function validateExtraction(extracted: KYCExtractionResult): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (extracted.email_address && !isValidEmail(extracted.email_address)) {
    errors.push({ field: 'email_address', message: 'Invalid email format' });
  }

  if (extracted.contact_person_email && !isValidEmail(extracted.contact_person_email)) {
    errors.push({ field: 'contact_person_email', message: 'Invalid email format for contact person' });
  }

  if (extracted.business_phone_work && !isValidPhone(extracted.business_phone_work)) {
    warnings.push({ field: 'business_phone_work', message: 'Work phone number format looks unusual — please verify' });
  }

  if (extracted.business_phone_cell && !isValidPhone(extracted.business_phone_cell)) {
    warnings.push({ field: 'business_phone_cell', message: 'Cell number format looks unusual — please verify' });
  }

  if (extracted.contact_person_tel_cell && !isValidPhone(extracted.contact_person_tel_cell)) {
    warnings.push({ field: 'contact_person_tel_cell', message: 'Contact cell format looks unusual' });
  }

  if (extracted.website && !isValidUrl(extracted.website)) {
    warnings.push({ field: 'website', message: 'Website URL format looks unusual' });
  }

  if (extracted.payment_cash_pct !== undefined) {
    if (!isValidPercentage(extracted.payment_cash_pct)) {
      errors.push({ field: 'payment_cash_pct', message: 'Cash payment percentage must be 0–100' });
    }
  }

  // Validate ownership percentages on associated persons
  if (extracted.associated_persons) {
    extracted.associated_persons.forEach((p, i) => {
      if (p.ownership_percentage !== undefined && !isValidPercentage(p.ownership_percentage)) {
        errors.push({ field: `associated_persons[${i}].ownership_percentage`, message: 'Ownership % must be 0–100' });
      }
    });
  }

  if (extracted.license_expiry_date && !isValidDate(extracted.license_expiry_date)) {
    warnings.push({ field: 'license_expiry_date', message: 'License expiry date format unclear' });
  }

  if (extracted.declaration_signature_date && !isValidDate(extracted.declaration_signature_date)) {
    warnings.push({ field: 'declaration_signature_date', message: 'Declaration date format unclear' });
  }

  // Validate associated persons
  if (extracted.associated_persons) {
    extracted.associated_persons.forEach((p, i) => {
      if (p.ownership_percentage !== undefined && !isValidPercentage(p.ownership_percentage)) {
        errors.push({ field: `associated_persons[${i}].ownership_percentage`, message: 'Ownership % must be 0–100' });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─────────────────────────────────────────────
// Sanitise extracted data (remove invalid fields)
// ─────────────────────────────────────────────

export function sanitiseExtraction(
  extracted: KYCExtractionResult,
  validation: ValidationResult
): KYCExtractionResult {
  const sanitised = { ...extracted };
  const errorFields = validation.errors.map((e) => e.field);

  for (const field of errorFields) {
    if (field in sanitised) {
      delete (sanitised as Record<string, unknown>)[field];
    }
  }

  return sanitised;
}
