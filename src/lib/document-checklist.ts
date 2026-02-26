// ─────────────────────────────────────────────
// Shared document checklist — client-safe (no Prisma imports)
// Source of truth for required KYC documents per KYC DOC 011 page 2
// ─────────────────────────────────────────────

export interface ChecklistItem {
  doc_type: string;
  label: string;
  required_for: 'all' | 'company' | 'individual' | 'supplier';
}

export const DOCUMENT_CHECKLIST: ChecklistItem[] = [
  { doc_type: 'company_registration',     label: 'Company registration documents (CIPC)', required_for: 'company' },
  { doc_type: 'beneficial_ownership',     label: 'Beneficial ownership certificate/declaration', required_for: 'company' },
  { doc_type: 'group_structure',          label: 'Group structure indicating % shareholding', required_for: 'company' },
  { doc_type: 'shareholder_certificates', label: 'Shareholder certificates and registers', required_for: 'company' },
  { doc_type: 'bbbee_cert',              label: 'B-BBEE affidavit/certificate (if applicable)', required_for: 'all' },
  { doc_type: 'tax_compliance',          label: 'Tax compliance pin / tax registration', required_for: 'all' },
  { doc_type: 'bank_confirmation',       label: 'Bank confirmation letter (≤3 months old)', required_for: 'all' },
  { doc_type: 'address_proof',           label: 'Business address proof', required_for: 'all' },
  { doc_type: 'id_passport',            label: 'IDs/passports for all owners/directors', required_for: 'all' },
  { doc_type: 'license_permit',          label: 'Licenses/permits to trade precious metals (if applicable)', required_for: 'all' },
  { doc_type: 'import_export_permit',    label: 'Import/Export permits (if applicable)', required_for: 'all' },
  { doc_type: 'police_clearance',        label: 'Police clearance certificates (if supplier, ≤12 months)', required_for: 'supplier' },
  { doc_type: 'supply_chain_declaration', label: 'MetCon Supply Chain Declaration (if supplier)', required_for: 'supplier' },
  { doc_type: 'aml_policy',             label: 'AML/CFT policies/procedures document', required_for: 'all' },
];

/** Human-readable labels for every doc_type (including those not on the checklist) */
export const DOC_TYPE_LABELS: Record<string, string> = {
  company_registration:     'Company Registration Documents (CIPC)',
  beneficial_ownership:     'Beneficial Ownership Certificate/Declaration',
  group_structure:          'Group Structure (% shareholding)',
  shareholder_certificates: 'Shareholder Certificates & Registers',
  bbbee_cert:               'B-BBEE Affidavit/Certificate',
  vat_revalidation:         'VAT Domestic Reverse Charge Revalidation Letter',
  tax_compliance:           'Tax Compliance Pin / Tax Registration Certificate',
  bank_confirmation:        'Bank Confirmation Letter (≤3 months)',
  address_proof:            'Business Address Proof',
  id_passport:              'ID / Passport Copy',
  license_permit:           'License/Permit to Trade Precious Metals',
  import_export_permit:     'Import/Export Permit',
  police_clearance:         'Police Clearance Certificate (≤12 months)',
  supply_chain_declaration: 'MetCon Supply Chain Declaration',
  aml_policy:               'AML/CFT Policy Document',
  anti_bribery_policy:      'Anti-Bribery Policy Document',
  association_proof:        'Precious Metal Association Membership Proof',
  other:                    'Other Document',
};

/** Filter the checklist to docs relevant for a given entity type */
export function getRelevantDocs(entityType: string | null): ChecklistItem[] {
  if (!entityType) return DOCUMENT_CHECKLIST; // show all when unknown
  const isCompany = entityType === 'Company';
  return DOCUMENT_CHECKLIST.filter((d) => {
    if (d.required_for === 'all') return true;
    if (d.required_for === 'company' && isCompany) return true;
    if (d.required_for === 'individual' && !isCompany) return true;
    return false;
  });
}
