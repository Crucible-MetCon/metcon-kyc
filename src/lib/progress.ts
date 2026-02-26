import { Counterparty, AssociatedPerson, Document } from '@prisma/client';
import { DualProgress, SectionProgress, MissingField, CaseStatus } from '@/types/kyc';

type CounterpartyWithPersons = Counterparty & {
  associated_persons: AssociatedPerson[];
};

function hasValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  return true;
}

// ─────────────────────────────────────────────
// MINIMUM REQUIRED FIELDS for "Send to Compliance" button
// Based on KYC DOC 011 Section A (1.1–1.8) + PEP + Consent
// ─────────────────────────────────────────────
export const MINIMUM_REQUIRED: Array<{ key: keyof Counterparty; label: string }> = [
  { key: 'entity_type',              label: 'Entity type (Company / Individual)' },
  { key: 'registered_name',         label: 'Registered name / Full name' },
  { key: 'registration_or_id_number', label: 'Registration / ID / Passport number' },
  { key: 'business_address',        label: 'Business address' },
  { key: 'email_address',           label: 'Email address' },
  { key: 'type_of_business',        label: 'Type of business' },
  { key: 'pep_related',             label: 'PEP declaration (1.15)' },
  { key: 'popia_consent',           label: 'POPIA/FICA consent' },
];

// Phone: either work or cell counts
function hasPhone(cp: Counterparty): boolean {
  return hasValue(cp.business_phone_work) || hasValue(cp.business_phone_cell);
}

// ─────────────────────────────────────────────
// DOCUMENTS CHECKLIST — KYC DOC 011 page 2
// ─────────────────────────────────────────────
export const DOCUMENT_CHECKLIST: Array<{
  doc_type: string;
  label: string;
  required_for: 'all' | 'company' | 'individual' | 'supplier';
}> = [
  { doc_type: 'company_registration',   label: 'Company registration documents (CIPC)', required_for: 'company' },
  { doc_type: 'beneficial_ownership',   label: 'Beneficial ownership certificate/declaration', required_for: 'company' },
  { doc_type: 'group_structure',        label: 'Group structure indicating % shareholding', required_for: 'company' },
  { doc_type: 'shareholder_certificates', label: 'Shareholder certificates and registers', required_for: 'company' },
  { doc_type: 'bbbee_cert',             label: 'B-BBEE affidavit/certificate (if applicable)', required_for: 'all' },
  { doc_type: 'tax_compliance',         label: 'Tax compliance pin / tax registration', required_for: 'all' },
  { doc_type: 'bank_confirmation',      label: 'Bank confirmation letter (≤3 months old)', required_for: 'all' },
  { doc_type: 'address_proof',          label: 'Business address proof', required_for: 'all' },
  { doc_type: 'id_passport',            label: 'IDs/passports for all owners/directors', required_for: 'all' },
  { doc_type: 'license_permit',         label: 'Licenses/permits to trade precious metals (if applicable)', required_for: 'all' },
  { doc_type: 'import_export_permit',   label: 'Import/Export permits (if applicable)', required_for: 'all' },
  { doc_type: 'police_clearance',       label: 'Police clearance certificates (if supplier, ≤12 months)', required_for: 'supplier' },
  { doc_type: 'supply_chain_declaration', label: 'MetCon Supply Chain Declaration (if supplier)', required_for: 'supplier' },
  { doc_type: 'aml_policy',             label: 'AML/CFT policies/procedures document', required_for: 'all' },
];

// ─────────────────────────────────────────────
// All tracked fields for overall progress
// ─────────────────────────────────────────────
interface FieldDef {
  key: keyof Counterparty;
  label: string;
  priority: 1 | 2 | 3;
  section: string;
  companyOnly?: boolean;
  conditionalOn?: { field: keyof Counterparty; value: boolean };
}

const ALL_FIELDS: FieldDef[] = [
  // Section A
  { key: 'entity_type',                label: 'Entity type',                   priority: 1, section: 'Applicant Details' },
  { key: 'registered_name',            label: 'Registered name',               priority: 1, section: 'Applicant Details' },
  { key: 'registration_or_id_number',  label: 'Registration / ID number',      priority: 1, section: 'Applicant Details' },
  { key: 'business_address',           label: 'Business address',              priority: 1, section: 'Applicant Details' },
  { key: 'business_phone_work',        label: 'Business phone (work)',         priority: 1, section: 'Applicant Details' },
  { key: 'email_address',              label: 'Business email',                priority: 1, section: 'Applicant Details' },
  { key: 'type_of_business',           label: 'Type of business',              priority: 1, section: 'Applicant Details' },
  { key: 'contact_person_name',        label: 'Contact person name',           priority: 1, section: 'Applicant Details', companyOnly: true },
  { key: 'contact_person_email',       label: 'Contact person email',          priority: 2, section: 'Applicant Details', companyOnly: true },
  { key: 'fica_org_id',                label: 'FICA Org ID',                   priority: 2, section: 'Applicant Details' },
  { key: 'tax_number',                 label: 'Tax registration number',       priority: 2, section: 'Applicant Details' },
  { key: 'vat_number',                 label: 'VAT registration number',       priority: 2, section: 'Applicant Details' },
  { key: 'vat_category',              label: 'VAT category',                  priority: 3, section: 'Applicant Details' },
  { key: 'pep_related',               label: 'PEP declaration (1.15)',         priority: 1, section: 'Applicant Details' },
  { key: 'pep_relationship_details',  label: 'PEP relationship details',       priority: 1, section: 'Applicant Details',
    conditionalOn: { field: 'pep_related', value: true } },

  // Section D
  { key: 'bank_name',                  label: 'Bank name',                     priority: 1, section: 'Financials' },
  { key: 'account_name',               label: 'Account holder name',           priority: 1, section: 'Financials' },
  { key: 'account_number',             label: 'Account number',                priority: 1, section: 'Financials' },
  { key: 'branch_code',                label: 'Branch code',                   priority: 2, section: 'Financials' },
  { key: 'source_of_funds_description',label: 'Source of funds',               priority: 1, section: 'Financials' },
  { key: 'audit_company_name',         label: 'Audit company name',            priority: 2, section: 'Financials', companyOnly: true },

  // Section E
  { key: 'business_activity_description', label: 'Business activity description', priority: 1, section: 'Business Activity' },
  { key: 'holds_license',              label: 'Holds license/permit',           priority: 1, section: 'Business Activity' },
  { key: 'license_number',             label: 'License number',                priority: 2, section: 'Business Activity',
    conditionalOn: { field: 'holds_license', value: true } },

  // Section G
  { key: 'subject_to_aml_law',         label: 'Subject to AML/CFT law',        priority: 1, section: 'AML / CFT' },
  { key: 'has_aml_conformity_program', label: 'AML conformity program',        priority: 2, section: 'AML / CFT' },
  { key: 'has_anti_bribery_policy',    label: 'Anti-bribery policy',           priority: 1, section: 'AML / CFT' },
  { key: 'provides_aml_training',      label: 'AML training for employees',    priority: 2, section: 'AML / CFT' },

  // Section H
  { key: 'performs_risk_assessment',   label: 'Risk-based assessment',         priority: 1, section: 'Transaction Monitoring' },
  { key: 'suspicious_tx_reporting',    label: 'Suspicious transaction procedures', priority: 1, section: 'Transaction Monitoring' },
  { key: 'payment_method_primary',     label: 'Primary payment method',        priority: 1, section: 'Transaction Monitoring' },

  // Section I
  { key: 'fica_processing_authorised', label: 'FICA processing authorisation', priority: 1, section: 'Declarations' },
  { key: 'popia_consent',              label: 'POPIA consent',                 priority: 1, section: 'Declarations' },
  { key: 'info_true_declaration',      label: 'Information accuracy declaration', priority: 1, section: 'Declarations' },
  { key: 'declaration_signature_name', label: 'Signatory name',                priority: 1, section: 'Declarations' },
  { key: 'declaration_signature_date', label: 'Signature date',                priority: 1, section: 'Declarations' },
];

// ─────────────────────────────────────────────
// Main dual-progress calculator
// ─────────────────────────────────────────────
export function calculateDualProgress(
  counterparty: CounterpartyWithPersons,
  documents: Document[]
): DualProgress {
  const isCompany = counterparty.entity_type === 'Company';

  // ── BAR A: Mandatory Information ──
  const mandatoryMissing: MissingField[] = [];
  let mandatoryFilled = 0;
  let mandatoryTotal = MINIMUM_REQUIRED.length + 1; // +1 for phone

  // Check standard mandatory fields
  for (const { key, label } of MINIMUM_REQUIRED) {
    if (hasValue(counterparty[key])) {
      mandatoryFilled++;
    } else {
      mandatoryMissing.push({ field: key, label, section: 'Applicant Details', priority: 1 });
    }
  }

  // Phone (either work or cell)
  if (hasPhone(counterparty)) {
    mandatoryFilled++;
  } else {
    mandatoryMissing.push({ field: 'business_phone', label: 'Business phone number', section: 'Applicant Details', priority: 1 });
  }

  // Contact person for companies
  if (isCompany) {
    mandatoryTotal++;
    if (hasValue(counterparty.contact_person_name)) {
      mandatoryFilled++;
    } else {
      mandatoryMissing.push({ field: 'contact_person_name', label: 'Contact person name', section: 'Applicant Details', priority: 1 });
    }
  }

  // At least one associated person (director/owner or signatory) for companies
  if (isCompany) {
    mandatoryTotal++;
    const hasAssocPerson = counterparty.associated_persons.some(
      (p) => hasValue(p.person_full_name) && hasValue(p.person_role_type)
    );
    if (hasAssocPerson) {
      mandatoryFilled++;
    } else {
      mandatoryMissing.push({
        field: 'associated_persons',
        label: 'At least one director, owner, or authorised signatory',
        section: 'Directors & Signatories',
        priority: 1,
      });
    }
  }

  const mandatory_percent = mandatoryTotal > 0
    ? Math.round((mandatoryFilled / mandatoryTotal) * 100)
    : 0;

  // can_submit: all mandatory filled + (has doc OR doesn't matter)
  const can_submit = mandatoryMissing.length === 0;

  // ── BAR B: Documents ──
  const uploadedDocTypes = new Set(documents.map((d) => d.doc_type));
  const docs_uploaded = Array.from(uploadedDocTypes);

  // Relevant checklist for entity type
  const relevantDocs = DOCUMENT_CHECKLIST.filter((d) => {
    if (d.required_for === 'all') return true;
    if (d.required_for === 'company' && isCompany) return true;
    if (d.required_for === 'individual' && !isCompany) return true;
    // supplier: treat as "all" for now (can't determine supplier vs customer from entity_type alone)
    return false;
  });

  const docsUploaded = relevantDocs.filter((d) => uploadedDocTypes.has(d.doc_type)).length;
  const docs_percent = relevantDocs.length > 0
    ? Math.round((docsUploaded / relevantDocs.length) * 100)
    : 0;

  const docs_missing = relevantDocs
    .filter((d) => !uploadedDocTypes.has(d.doc_type))
    .map((d) => d.label);

  // ── Overall field progress (for sections display) ──
  const requiredFields = ALL_FIELDS.filter((f) => {
    if (f.companyOnly && !isCompany) return false;
    if (f.conditionalOn) {
      const parentVal = counterparty[f.conditionalOn.field];
      return parentVal === f.conditionalOn.value;
    }
    return true;
  });

  const sectionMap = new Map<string, { filled: number; total: number }>();
  const allMissing: MissingField[] = [];

  for (const fieldDef of requiredFields) {
    const sec = fieldDef.section;
    if (!sectionMap.has(sec)) sectionMap.set(sec, { filled: 0, total: 0 });
    const s = sectionMap.get(sec)!;
    s.total++;
    const val = counterparty[fieldDef.key];
    if (hasValue(val)) {
      s.filled++;
    } else {
      allMissing.push({ field: fieldDef.key, label: fieldDef.label, section: sec, priority: fieldDef.priority });
    }
  }

  // Associated persons section
  const hasAssocPerson = counterparty.associated_persons.some(
    (p) => hasValue(p.person_full_name) && hasValue(p.person_role_type)
  );
  if (isCompany) {
    const secKey = 'Directors & Signatories';
    const s = sectionMap.get(secKey) ?? { filled: 0, total: 0 };
    s.total++;
    if (hasAssocPerson) {
      s.filled++;
    } else {
      allMissing.push({
        field: 'associated_persons',
        label: 'At least one director, owner, or authorised signatory',
        section: secKey,
        priority: 1,
      });
    }
    sectionMap.set(secKey, s);
  }

  const sections: SectionProgress[] = [];
  let totalFilled = 0;
  let totalRequired = 0;

  for (const [label, { filled, total }] of Array.from(sectionMap.entries())) {
    totalFilled += filled;
    totalRequired += total;
    sections.push({ label, filled, total, percent: total > 0 ? Math.round((filled / total) * 100) : 100 });
  }

  const fieldPercent = totalRequired > 0 ? Math.round((totalFilled / totalRequired) * 100) : 0;
  const overall = Math.round((mandatory_percent + docs_percent) / 2);

  let status: CaseStatus;
  if (overall >= 100 && hasAssocPerson) {
    status = 'complete';
  } else if (mandatory_percent >= 95 || counterparty.pep_related === true) {
    status = 'needs_review';
  } else {
    status = 'in_progress';
  }

  allMissing.sort((a, b) => a.priority - b.priority);

  return {
    mandatory_percent,
    docs_percent,
    overall,
    status,
    can_submit,
    mandatory_missing: allMissing.filter((f) => f.priority === 1),
    docs_missing,
    sections,
    hasRequiredPerson: !isCompany || hasAssocPerson,
    docs_uploaded,
  };
}

// ─────────────────────────────────────────────
// Human-readable progress summary for agent context
// ─────────────────────────────────────────────
export function formatProgressForAgent(progress: DualProgress): string {
  const lines = [
    `**Mandatory Information: ${progress.mandatory_percent}%** | **Documents Supplied: ${progress.docs_percent}%**`,
    `Status: ${progress.status.replace(/_/g, ' ')} | Can submit to compliance: ${progress.can_submit ? 'Yes' : 'No'}`,
  ];

  lines.push('\nSection breakdown:');
  for (const s of progress.sections) {
    const icon = s.percent === 100 ? '✓' : s.percent > 0 ? '◑' : '○';
    lines.push(`  ${icon} ${s.label}: ${s.filled}/${s.total}`);
  }

  if (progress.mandatory_missing.length > 0) {
    lines.push(`\nTop missing mandatory fields:`);
    progress.mandatory_missing.slice(0, 5).forEach((f) => {
      lines.push(`  - ${f.label} [${f.section}]`);
    });
  }

  if (progress.docs_missing.length > 0) {
    lines.push(`\nMissing documents (${progress.docs_missing.length}):`);
    progress.docs_missing.slice(0, 4).forEach((d) => lines.push(`  - ${d}`));
  }

  return lines.join('\n');
}

// Legacy alias for old callers
export const calculateProgress = calculateDualProgress;
