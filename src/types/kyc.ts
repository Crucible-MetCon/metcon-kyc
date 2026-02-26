// ─────────────────────────────────────────────
// KYC Types — aligned with KYC DOC 011 Version 004_202511
// ─────────────────────────────────────────────

export type EntityType = 'Company' | 'Individual';

export type PersonRoleType =
  | 'Director'
  | 'Member'
  | 'Owner'
  | 'Shareholder'
  | 'UBO'
  | 'Authorised Signatory'
  | 'Other';

export type CaseStatus = 'in_progress' | 'complete' | 'needs_review' | 'submitted_to_compliance';

export type DocumentType =
  | 'company_registration'
  | 'beneficial_ownership'
  | 'group_structure'
  | 'shareholder_certificates'
  | 'bbbee_cert'
  | 'vat_revalidation'
  | 'tax_compliance'
  | 'bank_confirmation'
  | 'address_proof'
  | 'id_passport'
  | 'license_permit'
  | 'import_export_permit'
  | 'police_clearance'
  | 'supply_chain_declaration'
  | 'aml_policy'
  | 'anti_bribery_policy'
  | 'association_proof'
  | 'other';

// ─────────────────────────────────────────────
// Full extraction result aligned with KYC DOC 011
// ─────────────────────────────────────────────

export interface AssociatedPersonInput {
  person_full_name?: string;
  person_role_type?: PersonRoleType;
  person_nationality?: string;
  country_of_incorporation?: string;
  person_id_or_passport?: string;
  person_address?: string;
  ownership_percentage?: number;
  person_designation?: string;
  person_email?: string;
  person_phone?: string;
}

export interface KYCExtractionResult {
  // Section A — Applicant Details
  entity_type?: EntityType;
  registered_name?: string;
  registration_or_id_number?: string;
  business_address?: string;
  business_phone_work?: string;
  business_phone_cell?: string;
  email_address?: string;
  type_of_business?: string;
  contact_person_name?: string;
  contact_person_tel_work?: string;
  contact_person_tel_cell?: string;
  contact_person_email?: string;
  fica_org_id?: string;
  website?: string;
  tax_number?: string;
  vat_number?: string;
  vat_category?: string;
  multiple_branches?: boolean;
  branch_count?: number;
  pep_related?: boolean;
  pep_relationship_details?: string;

  // Section D — Financials
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  branch_code?: string;
  branch_name?: string;
  swift_code?: string;
  audit_company_name?: string;
  auditor_phone_work?: string;
  auditor_phone_cell?: string;
  last_audit_date?: string;
  source_of_funds_description?: string;

  // Section E — Business Activity
  business_type_checkboxes?: string[];
  business_activity_description?: string;
  holds_license?: boolean;
  license_types?: string[];
  license_number?: string;
  license_expiry_date?: string;

  // Section F — Facilities & Materials
  has_smelting_facilities?: boolean;
  has_manufacturing_facilities?: boolean;
  produces_retail_products?: boolean;
  customer_metals?: string[];
  metal_forms?: string[];
  precious_metal_association?: boolean;
  association_memberships?: string[];
  supplier_metals?: string[];
  source_material_percentage?: string;
  supplier_profile?: string;
  source_material_country?: string;
  unprocessed_recycled_kg?: number;
  jewellers_sweeps_kg?: number;
  melted_recycled_kg?: number;
  primary_mined_kg?: number;
  mine_name?: string;
  mine_address?: string;
  mining_permit_number?: string;

  // Section G — AML / CFT
  subject_to_aml_law?: boolean;
  aml_law_name?: string;
  aml_regulator?: string;
  has_aml_conformity_program?: boolean;
  aml_responsible_person_name?: string;
  aml_responsible_person_phone?: string;
  aml_responsible_person_email?: string;
  has_anti_bribery_policy?: boolean;
  charged_for_anti_bribery?: boolean;
  provides_aml_training?: boolean;

  // Section H — Transaction Monitoring
  performs_risk_assessment?: boolean;
  suspicious_tx_reporting?: boolean;
  suspicious_detection_details?: string;
  registers_precious_metal_tx?: boolean;
  monitors_unusual_activity?: boolean;
  unusual_activity_details?: string;
  structured_tx_procedures?: boolean;
  max_cash_amount?: number;
  max_eft_amount?: number;
  supplier_bank_pct?: number;
  supplier_company_pct?: number;
  supplier_individual_pct?: number;
  payment_bank_transfer_pct?: number;
  payment_cheque_pct?: number;
  payment_cash_pct?: number;
  payment_method_primary?: string;
  payment_last_year_description?: string;

  // Section I — Declaration & Consent
  fica_processing_authorised?: boolean;
  popia_consent?: boolean;
  info_true_declaration?: boolean;
  confirms_beneficial_owner_goods?: boolean;
  confirms_legitimate_owners?: boolean;
  confirms_prevent_criminal_goods?: boolean;
  confirms_legislation_compliance?: boolean;
  confirms_no_forced_labour?: boolean;
  confirms_environmental_compliance?: boolean;
  confirms_no_bribery?: boolean;
  commits_to_oecd?: boolean;
  declaration_signature_name?: string;
  declaration_signature_position?: string;
  declaration_signature_date?: string;

  // Associated persons (companies)
  associated_persons?: AssociatedPersonInput[];
}

// ─────────────────────────────────────────────
// Dual progress tracking
// ─────────────────────────────────────────────

export interface SectionProgress {
  label: string;
  filled: number;
  total: number;
  percent: number;
}

export interface DualProgress {
  mandatory_percent: number;   // Progress Bar A — mandatory information
  docs_percent: number;        // Progress Bar B — documents supplied
  overall: number;             // Average for DB storage
  status: CaseStatus;
  can_submit: boolean;         // Minimum required fields met
  mandatory_missing: MissingField[];
  docs_missing: string[];      // Doc type labels missing
  sections: SectionProgress[];
  hasRequiredPerson: boolean;
  docs_uploaded: string[];     // Doc types uploaded
}

export interface MissingField {
  field: string;
  label: string;
  section: string;
  priority: number; // 1 = must-have, 2 = important, 3 = optional
}

// ─────────────────────────────────────────────
// Enrichment
// ─────────────────────────────────────────────

export interface EnrichmentSuggestion {
  type: 'sa_id_dob' | 'company_lookup';
  field: string;
  derivedValue: string;
  confirmationPrompt: string;
  pendingConfirmation: boolean;
}

// ─────────────────────────────────────────────
// API response shapes
// ─────────────────────────────────────────────

export interface MessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: string | null;
  created_at: Date;
}

export interface DocumentData {
  id: string;
  doc_type: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  status: string;
  created_at: Date;
}

export interface CounterpartyData {
  id: string;
  [key: string]: unknown;
}

export interface CaseData {
  id: string;
  token: string;
  status: string;
  mandatory_percent: number;
  docs_percent: number;
  completion_percent: number;
  entity_type: string | null;
  risk_flag: boolean;
  submitted_to_compliance: boolean;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  counterparty: CounterpartyData | null;
  messages: MessageData[];
  documents: DocumentData[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}
