import { describe, it, expect } from 'vitest';
import { calculateDualProgress } from '../lib/progress';
import type { Counterparty, AssociatedPerson, Document } from '@prisma/client';

// ─────────────────────────────────────────────
// Helper — build a full Counterparty object
// ─────────────────────────────────────────────
function makeCounterparty(
  overrides: Partial<Omit<Counterparty, 'associated_persons'>> = {}
): Counterparty & { associated_persons: AssociatedPerson[] } {
  return {
    id: 'cp1',
    case_id: 'case1',
    entity_type: null,
    registered_name: null,
    registration_or_id_number: null,
    business_address: null,
    business_phone_work: null,
    business_phone_cell: null,
    email_address: null,
    type_of_business: null,
    contact_person_name: null,
    contact_person_tel_work: null,
    contact_person_tel_cell: null,
    contact_person_email: null,
    fica_org_id: null,
    website: null,
    tax_number: null,
    vat_number: null,
    vat_category: null,
    multiple_branches: null,
    branch_count: null,
    pep_related: null,
    pep_relationship_details: null,
    bank_name: null,
    account_name: null,
    account_number: null,
    branch_code: null,
    branch_name: null,
    swift_code: null,
    audit_company_name: null,
    auditor_phone_work: null,
    auditor_phone_cell: null,
    last_audit_date: null,
    source_of_funds_description: null,
    business_type_checkboxes: null,
    business_activity_description: null,
    holds_license: null,
    license_types: null,
    license_number: null,
    license_expiry_date: null,
    has_smelting_facilities: null,
    has_manufacturing_facilities: null,
    produces_retail_products: null,
    customer_metals_json: null,
    metal_forms_json: null,
    precious_metal_association: null,
    association_memberships_json: null,
    supplier_metals_json: null,
    source_material_percentage: null,
    supplier_profile: null,
    source_material_country: null,
    unprocessed_recycled_kg: null,
    jewellers_sweeps_kg: null,
    melted_recycled_kg: null,
    primary_mined_kg: null,
    mine_name: null,
    mine_address: null,
    mining_permit_number: null,
    subject_to_aml_law: null,
    aml_law_name: null,
    aml_regulator: null,
    has_aml_conformity_program: null,
    aml_responsible_person_name: null,
    aml_responsible_person_phone: null,
    aml_responsible_person_email: null,
    has_anti_bribery_policy: null,
    charged_for_anti_bribery: null,
    provides_aml_training: null,
    performs_risk_assessment: null,
    suspicious_tx_reporting: null,
    suspicious_detection_details: null,
    registers_precious_metal_tx: null,
    monitors_unusual_activity: null,
    unusual_activity_details: null,
    structured_tx_procedures: null,
    max_cash_amount: null,
    max_eft_amount: null,
    supplier_bank_pct: null,
    supplier_company_pct: null,
    supplier_individual_pct: null,
    payment_bank_transfer_pct: null,
    payment_cheque_pct: null,
    payment_cash_pct: null,
    payment_method_primary: null,
    payment_last_year_description: null,
    fica_processing_authorised: null,
    popia_consent: null,
    info_true_declaration: null,
    confirms_beneficial_owner_goods: null,
    confirms_legitimate_owners: null,
    confirms_prevent_criminal_goods: null,
    confirms_legislation_compliance: null,
    confirms_no_forced_labour: null,
    confirms_environmental_compliance: null,
    confirms_no_bribery: null,
    commits_to_oecd: null,
    declaration_signature_name: null,
    declaration_signature_position: null,
    declaration_signature_date: null,
    created_at: new Date(),
    updated_at: new Date(),
    associated_persons: [],
    ...overrides,
  } as Counterparty & { associated_persons: AssociatedPerson[] };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('calculateDualProgress — empty counterparty', () => {
  it('returns 0% mandatory for a fully empty counterparty', () => {
    const cp = makeCounterparty();
    const result = calculateDualProgress(cp, []);
    expect(result.mandatory_percent).toBe(0);
    expect(result.status).toBe('in_progress');
    expect(result.can_submit).toBe(false);
  });

  it('returns some % when entity_type is set', () => {
    const cp = makeCounterparty({ entity_type: 'Individual' });
    const result = calculateDualProgress(cp, []);
    expect(result.mandatory_percent).toBeGreaterThan(0);
    expect(result.mandatory_percent).toBeLessThan(20);
  });
});

describe('calculateDualProgress — partial Individual', () => {
  it('reflects partial completion', () => {
    const cp = makeCounterparty({
      entity_type: 'Individual',
      registered_name: 'Jane Smith',
      email_address: 'jane@example.com',
      business_phone_cell: '+27821234567',
      pep_related: false,
    });
    const result = calculateDualProgress(cp, []);
    expect(result.mandatory_percent).toBeGreaterThan(0);
    expect(result.mandatory_percent).toBeLessThan(80);
    expect(result.status).toBe('in_progress');
  });
});

describe('calculateDualProgress — PEP flag triggers conditional field', () => {
  it('adds pep_relationship_details as missing when pep_related=true', () => {
    const cp = makeCounterparty({
      entity_type: 'Individual',
      pep_related: true,
    });
    const result = calculateDualProgress(cp, []);
    const missing = result.mandatory_missing.find((f) => f.field === 'pep_relationship_details');
    expect(missing).toBeDefined();
  });

  it('does not require pep_relationship_details when pep_related=false', () => {
    const cp = makeCounterparty({
      entity_type: 'Individual',
      pep_related: false,
    });
    const result = calculateDualProgress(cp, []);
    const pepDetail = result.mandatory_missing.find((f) => f.field === 'pep_relationship_details');
    expect(pepDetail).toBeUndefined();
  });
});

describe('calculateDualProgress — Company needs associated person', () => {
  it('marks associated_persons as missing for company with no persons', () => {
    const cp = makeCounterparty({
      entity_type: 'Company',
      registered_name: 'Acme Ltd',
    });
    const result = calculateDualProgress(cp, []);
    const missing = result.mandatory_missing.find((f) => f.field === 'associated_persons');
    expect(missing).toBeDefined();
    expect(result.hasRequiredPerson).toBe(false);
  });

  it('satisfies person requirement when a director is added', () => {
    const person: AssociatedPerson = {
      id: 'p1',
      counterparty_id: 'cp1',
      person_full_name: 'John Director',
      person_role_type: 'Director',
      person_nationality: null,
      country_of_incorporation: null,
      person_id_or_passport: null,
      person_address: null,
      ownership_percentage: null,
      person_designation: null,
      person_email: null,
      person_phone: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const cp = makeCounterparty({ entity_type: 'Company' });
    cp.associated_persons = [person];
    const result = calculateDualProgress(cp, []);
    expect(result.hasRequiredPerson).toBe(true);
    const missing = result.mandatory_missing.find((f) => f.field === 'associated_persons');
    expect(missing).toBeUndefined();
  });
});

describe('calculateDualProgress — documents progress bar', () => {
  it('returns higher docs_percent when a doc is uploaded', () => {
    const cp = makeCounterparty({ entity_type: 'Company' });
    const noDocResult = calculateDualProgress(cp, []);
    const withDocResult = calculateDualProgress(cp, [
      { id: 'd1', doc_type: 'id_passport' } as Document,
    ]);
    expect(withDocResult.docs_percent).toBeGreaterThan(noDocResult.docs_percent);
  });

  it('tracks uploaded doc types', () => {
    const cp = makeCounterparty({ entity_type: 'Individual' });
    const result = calculateDualProgress(cp, [
      { id: 'd1', doc_type: 'id_passport' } as Document,
      { id: 'd2', doc_type: 'bank_confirmation' } as Document,
    ]);
    expect(result.docs_uploaded).toContain('id_passport');
    expect(result.docs_uploaded).toContain('bank_confirmation');
  });
});

describe('calculateDualProgress — can_submit flag', () => {
  it('can_submit=false when mandatory fields incomplete', () => {
    const cp = makeCounterparty({ entity_type: 'Individual' });
    const result = calculateDualProgress(cp, []);
    expect(result.can_submit).toBe(false);
  });

  it('can_submit=true when all mandatory fields present for individual', () => {
    const cp = makeCounterparty({
      entity_type: 'Individual',
      registered_name: 'Jane Smith',
      registration_or_id_number: '9001045800088',
      business_address: '123 Main St, Cape Town, 8001',
      email_address: 'jane@example.com',
      business_phone_cell: '+27821234567',
      type_of_business: 'Coins dealer',
      pep_related: false,
      popia_consent: true,
    });
    const result = calculateDualProgress(cp, []);
    expect(result.can_submit).toBe(true);
  });
});
