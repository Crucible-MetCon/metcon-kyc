'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminNav from '../../AdminNav';
import { StatusBadge, STATUS_OPTIONS } from '../../StatusDropdown';

// ─── Serialised types (Dates become strings via JSON.stringify in page.tsx) ────
interface Person {
  id: string;
  person_full_name: string | null;
  person_role_type: string | null;
  person_nationality: string | null;
  country_of_incorporation: string | null;
  person_id_or_passport: string | null;
  person_address: string | null;
  ownership_percentage: number | null;
  person_designation: string | null;
  person_email: string | null;
  person_phone: string | null;
}

interface Doc {
  id: string;
  doc_type: string;
  original_name: string;
  file_size: number;
  status: string;
  created_at: string;
}

interface Cp {
  entity_type: string | null;
  registered_name: string | null;
  registration_or_id_number: string | null;
  business_address: string | null;
  business_phone_work: string | null;
  business_phone_cell: string | null;
  email_address: string | null;
  type_of_business: string | null;
  contact_person_name: string | null;
  contact_person_tel_work: string | null;
  contact_person_tel_cell: string | null;
  contact_person_email: string | null;
  fica_org_id: string | null;
  website: string | null;
  tax_number: string | null;
  vat_number: string | null;
  vat_category: string | null;
  multiple_branches: boolean | null;
  branch_count: number | null;
  pep_related: boolean | null;
  pep_relationship_details: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  branch_code: string | null;
  branch_name: string | null;
  swift_code: string | null;
  audit_company_name: string | null;
  auditor_phone_work: string | null;
  auditor_phone_cell: string | null;
  last_audit_date: string | null;
  source_of_funds_description: string | null;
  business_type_checkboxes: string | null;
  business_activity_description: string | null;
  holds_license: boolean | null;
  license_types: string | null;
  license_number: string | null;
  license_expiry_date: string | null;
  subject_to_aml_law: boolean | null;
  aml_law_name: string | null;
  aml_regulator: string | null;
  has_aml_conformity_program: boolean | null;
  aml_responsible_person_name: string | null;
  aml_responsible_person_phone: string | null;
  aml_responsible_person_email: string | null;
  has_anti_bribery_policy: boolean | null;
  charged_for_anti_bribery: boolean | null;
  provides_aml_training: boolean | null;
  performs_risk_assessment: boolean | null;
  suspicious_tx_reporting: boolean | null;
  suspicious_detection_details: string | null;
  registers_precious_metal_tx: boolean | null;
  monitors_unusual_activity: boolean | null;
  unusual_activity_details: string | null;
  structured_tx_procedures: boolean | null;
  max_cash_amount: number | null;
  max_eft_amount: number | null;
  supplier_bank_pct: number | null;
  supplier_company_pct: number | null;
  supplier_individual_pct: number | null;
  payment_bank_transfer_pct: number | null;
  payment_cheque_pct: number | null;
  payment_cash_pct: number | null;
  source_material_percentage: string | null;
  supplier_profile: string | null;
  source_material_country: string | null;
  fica_processing_authorised: boolean | null;
  popia_consent: boolean | null;
  info_true_declaration: boolean | null;
  confirms_beneficial_owner_goods: boolean | null;
  confirms_prevent_criminal_goods: boolean | null;
  confirms_no_forced_labour: boolean | null;
  confirms_environmental_compliance: boolean | null;
  confirms_no_bribery: boolean | null;
  commits_to_oecd: boolean | null;
  declaration_signature_name: string | null;
  declaration_signature_position: string | null;
  declaration_signature_date: string | null;
  associated_persons: Person[];
}

export interface SerializedCase {
  id: string;
  case_number: number;
  token: string;
  status: string;
  risk_flag: boolean;
  mandatory_percent: number;
  docs_percent: number;
  completion_percent: number;
  entity_type: string | null;
  submitted_to_compliance: boolean;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  counterparty: Cp | null;
  documents: Doc[];
  messages: { id: string }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function parseJsonList(s: string | null | undefined): string {
  if (!s) return '';
  try { return JSON.parse(s).join(', '); } catch { return s; }
}

function display(x: unknown): string {
  if (x === null || x === undefined || x === '') return '—';
  if (typeof x === 'boolean') return x ? 'Yes' : 'No';
  return String(x);
}

const DOC_LABELS: Record<string, string> = {
  company_registration:    'Company Registration',
  beneficial_ownership:    'Beneficial Ownership Certificate',
  group_structure:         'Group Structure',
  shareholder_certificates:'Shareholder Certificates',
  bbbee_cert:              'B-BBEE Certificate',
  vat_revalidation:        'VAT DRC Revalidation',
  tax_compliance:          'Tax Compliance Pin',
  bank_confirmation:       'Bank Confirmation Letter',
  address_proof:           'Address Proof',
  id_passport:             'ID / Passport',
  license_permit:          'License / Permit',
  import_export_permit:    'Import / Export Permit',
  police_clearance:        'Police Clearance',
  supply_chain_declaration:'Supply Chain Declaration',
  aml_policy:              'AML/CFT Policy',
  anti_bribery_policy:     'Anti-Bribery Policy',
  association_proof:       'Association Membership Proof',
  other:                   'Other Document',
};

// ─── Shared input styles ───────────────────────────────────────────────────────
const inputCls = 'w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
const selectCls = 'border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

// ─── Layout helpers ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      <div className="bg-gray-800 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function SubSection({ title }: { title: string }) {
  return (
    <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
      {title}
    </div>
  );
}

// StatusBadge imported from ../../StatusDropdown

// ─── Main component ────────────────────────────────────────────────────────────
export default function CaseEditForm({ kycCase }: { kycCase: SerializedCase }) {
  const router = useRouter();
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const cp = kycCase.counterparty;

  // Case-level editable state
  const [caseStatus, setCaseStatus] = useState(kycCase.status);
  const [riskFlag,   setRiskFlag]   = useState(kycCase.risk_flag);

  // Counterparty form state — everything stored as string | null except booleans and numbers
  const [f, setF] = useState({
    entity_type:                  cp?.entity_type               ?? null,
    registered_name:              cp?.registered_name           ?? null,
    registration_or_id_number:    cp?.registration_or_id_number ?? null,
    business_address:             cp?.business_address          ?? null,
    business_phone_work:          cp?.business_phone_work       ?? null,
    business_phone_cell:          cp?.business_phone_cell       ?? null,
    email_address:                cp?.email_address             ?? null,
    type_of_business:             cp?.type_of_business          ?? null,
    contact_person_name:          cp?.contact_person_name       ?? null,
    contact_person_tel_work:      cp?.contact_person_tel_work   ?? null,
    contact_person_tel_cell:      cp?.contact_person_tel_cell   ?? null,
    contact_person_email:         cp?.contact_person_email      ?? null,
    fica_org_id:                  cp?.fica_org_id               ?? null,
    website:                      cp?.website                   ?? null,
    tax_number:                   cp?.tax_number                ?? null,
    vat_number:                   cp?.vat_number                ?? null,
    vat_category:                 cp?.vat_category              ?? null,
    multiple_branches:            cp?.multiple_branches         ?? null,
    branch_count:                 cp?.branch_count              ?? null,
    pep_related:                  cp?.pep_related               ?? null,
    pep_relationship_details:     cp?.pep_relationship_details  ?? null,
    bank_name:                    cp?.bank_name                 ?? null,
    account_name:                 cp?.account_name              ?? null,
    account_number:               cp?.account_number            ?? null,
    branch_code:                  cp?.branch_code               ?? null,
    branch_name:                  cp?.branch_name               ?? null,
    swift_code:                   cp?.swift_code                ?? null,
    audit_company_name:           cp?.audit_company_name        ?? null,
    auditor_phone_work:           cp?.auditor_phone_work        ?? null,
    auditor_phone_cell:           cp?.auditor_phone_cell        ?? null,
    last_audit_date:              cp?.last_audit_date           ?? null,
    source_of_funds_description:  cp?.source_of_funds_description ?? null,
    business_type_checkboxes:     parseJsonList(cp?.business_type_checkboxes),
    business_activity_description:cp?.business_activity_description ?? null,
    holds_license:                cp?.holds_license             ?? null,
    license_types:                parseJsonList(cp?.license_types),
    license_number:               cp?.license_number            ?? null,
    license_expiry_date:          cp?.license_expiry_date       ?? null,
    subject_to_aml_law:           cp?.subject_to_aml_law        ?? null,
    aml_law_name:                 cp?.aml_law_name              ?? null,
    aml_regulator:                cp?.aml_regulator             ?? null,
    has_aml_conformity_program:   cp?.has_aml_conformity_program ?? null,
    aml_responsible_person_name:  cp?.aml_responsible_person_name  ?? null,
    aml_responsible_person_phone: cp?.aml_responsible_person_phone ?? null,
    aml_responsible_person_email: cp?.aml_responsible_person_email ?? null,
    has_anti_bribery_policy:      cp?.has_anti_bribery_policy   ?? null,
    charged_for_anti_bribery:     cp?.charged_for_anti_bribery  ?? null,
    provides_aml_training:        cp?.provides_aml_training     ?? null,
    performs_risk_assessment:     cp?.performs_risk_assessment  ?? null,
    suspicious_tx_reporting:      cp?.suspicious_tx_reporting   ?? null,
    suspicious_detection_details: cp?.suspicious_detection_details ?? null,
    registers_precious_metal_tx:  cp?.registers_precious_metal_tx  ?? null,
    monitors_unusual_activity:    cp?.monitors_unusual_activity    ?? null,
    unusual_activity_details:     cp?.unusual_activity_details     ?? null,
    structured_tx_procedures:     cp?.structured_tx_procedures     ?? null,
    max_cash_amount:              cp?.max_cash_amount              ?? null,
    max_eft_amount:               cp?.max_eft_amount               ?? null,
    supplier_bank_pct:            cp?.supplier_bank_pct            ?? null,
    supplier_company_pct:         cp?.supplier_company_pct         ?? null,
    supplier_individual_pct:      cp?.supplier_individual_pct      ?? null,
    payment_bank_transfer_pct:    cp?.payment_bank_transfer_pct    ?? null,
    payment_cheque_pct:           cp?.payment_cheque_pct           ?? null,
    payment_cash_pct:             cp?.payment_cash_pct             ?? null,
    source_material_percentage:   cp?.source_material_percentage   ?? null,
    supplier_profile:             cp?.supplier_profile             ?? null,
    source_material_country:      cp?.source_material_country      ?? null,
    fica_processing_authorised:   cp?.fica_processing_authorised   ?? null,
    popia_consent:                cp?.popia_consent                ?? null,
    info_true_declaration:        cp?.info_true_declaration        ?? null,
    confirms_beneficial_owner_goods:  cp?.confirms_beneficial_owner_goods  ?? null,
    confirms_prevent_criminal_goods:  cp?.confirms_prevent_criminal_goods  ?? null,
    confirms_no_forced_labour:        cp?.confirms_no_forced_labour        ?? null,
    confirms_environmental_compliance:cp?.confirms_environmental_compliance ?? null,
    confirms_no_bribery:              cp?.confirms_no_bribery              ?? null,
    commits_to_oecd:                  cp?.commits_to_oecd                  ?? null,
    declaration_signature_name:       cp?.declaration_signature_name       ?? null,
    declaration_signature_position:   cp?.declaration_signature_position   ?? null,
    declaration_signature_date:       cp?.declaration_signature_date       ?? null,
  });

  type FormKey = keyof typeof f;

  function set(key: FormKey, value: unknown) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  // ─── Input renderers ─────────────────────────────────────────────────────────
  function txt(key: FormKey, placeholder = '') {
    const val = (f[key] as string) ?? '';
    if (!editing) return <span className={val ? 'text-gray-900' : 'text-gray-400'}>{val || '—'}</span>;
    return (
      <input
        type="text"
        value={val}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value || null)}
        className={inputCls}
      />
    );
  }

  function area(key: FormKey, rows = 3) {
    const val = (f[key] as string) ?? '';
    if (!editing) return <span className={val ? 'text-gray-900 whitespace-pre-wrap' : 'text-gray-400'}>{val || '—'}</span>;
    return (
      <textarea
        value={val}
        rows={rows}
        onChange={(e) => set(key, e.target.value || null)}
        className={inputCls + ' resize-y'}
      />
    );
  }

  function num(key: FormKey) {
    const val = f[key] as number | null;
    if (!editing) return <span className={val != null ? 'text-gray-900' : 'text-gray-400'}>{val != null ? val : '—'}</span>;
    return (
      <input
        type="number"
        value={val ?? ''}
        onChange={(e) => set(key, e.target.value === '' ? null : Number(e.target.value))}
        className={inputCls + ' w-40'}
      />
    );
  }

  function bool(key: FormKey) {
    const val = f[key] as boolean | null;
    const raw = val === true ? 'true' : val === false ? 'false' : '';
    if (!editing) return <span className={val != null ? 'text-gray-900' : 'text-gray-400'}>{display(val)}</span>;
    return (
      <select
        value={raw}
        onChange={(e) => set(key, e.target.value === '' ? null : e.target.value === 'true')}
        className={selectCls}
      >
        <option value="">— Not specified</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  // ─── Row wrapper ─────────────────────────────────────────────────────────────
  function Row({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: 'red' | 'green' }) {
    const border = highlight === 'red' && !editing ? 'border-l-2 border-red-400' : highlight === 'green' && !editing ? 'border-l-2 border-green-400' : '';
    return (
      <div className={`grid grid-cols-[220px_1fr] items-start gap-3 px-4 py-2.5 text-sm ${border}`}>
        <span className="text-gray-500 font-medium pt-0.5 shrink-0">{label}</span>
        <div>{children}</div>
      </div>
    );
  }

  // ─── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/cases/${kycCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseData: { status: caseStatus, risk_flag: riskFlag },
          counterparty: cp ? f : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? d.error ?? 'Save failed');
      }
      setSuccess(true);
      setEditing(false);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    // Reset form to original values
    setF({
      entity_type:                  cp?.entity_type               ?? null,
      registered_name:              cp?.registered_name           ?? null,
      registration_or_id_number:    cp?.registration_or_id_number ?? null,
      business_address:             cp?.business_address          ?? null,
      business_phone_work:          cp?.business_phone_work       ?? null,
      business_phone_cell:          cp?.business_phone_cell       ?? null,
      email_address:                cp?.email_address             ?? null,
      type_of_business:             cp?.type_of_business          ?? null,
      contact_person_name:          cp?.contact_person_name       ?? null,
      contact_person_tel_work:      cp?.contact_person_tel_work   ?? null,
      contact_person_tel_cell:      cp?.contact_person_tel_cell   ?? null,
      contact_person_email:         cp?.contact_person_email      ?? null,
      fica_org_id:                  cp?.fica_org_id               ?? null,
      website:                      cp?.website                   ?? null,
      tax_number:                   cp?.tax_number                ?? null,
      vat_number:                   cp?.vat_number                ?? null,
      vat_category:                 cp?.vat_category              ?? null,
      multiple_branches:            cp?.multiple_branches         ?? null,
      branch_count:                 cp?.branch_count              ?? null,
      pep_related:                  cp?.pep_related               ?? null,
      pep_relationship_details:     cp?.pep_relationship_details  ?? null,
      bank_name:                    cp?.bank_name                 ?? null,
      account_name:                 cp?.account_name              ?? null,
      account_number:               cp?.account_number            ?? null,
      branch_code:                  cp?.branch_code               ?? null,
      branch_name:                  cp?.branch_name               ?? null,
      swift_code:                   cp?.swift_code                ?? null,
      audit_company_name:           cp?.audit_company_name        ?? null,
      auditor_phone_work:           cp?.auditor_phone_work        ?? null,
      auditor_phone_cell:           cp?.auditor_phone_cell        ?? null,
      last_audit_date:              cp?.last_audit_date           ?? null,
      source_of_funds_description:  cp?.source_of_funds_description ?? null,
      business_type_checkboxes:     parseJsonList(cp?.business_type_checkboxes),
      business_activity_description:cp?.business_activity_description ?? null,
      holds_license:                cp?.holds_license             ?? null,
      license_types:                parseJsonList(cp?.license_types),
      license_number:               cp?.license_number            ?? null,
      license_expiry_date:          cp?.license_expiry_date       ?? null,
      subject_to_aml_law:           cp?.subject_to_aml_law        ?? null,
      aml_law_name:                 cp?.aml_law_name              ?? null,
      aml_regulator:                cp?.aml_regulator             ?? null,
      has_aml_conformity_program:   cp?.has_aml_conformity_program ?? null,
      aml_responsible_person_name:  cp?.aml_responsible_person_name  ?? null,
      aml_responsible_person_phone: cp?.aml_responsible_person_phone ?? null,
      aml_responsible_person_email: cp?.aml_responsible_person_email ?? null,
      has_anti_bribery_policy:      cp?.has_anti_bribery_policy   ?? null,
      charged_for_anti_bribery:     cp?.charged_for_anti_bribery  ?? null,
      provides_aml_training:        cp?.provides_aml_training     ?? null,
      performs_risk_assessment:     cp?.performs_risk_assessment  ?? null,
      suspicious_tx_reporting:      cp?.suspicious_tx_reporting   ?? null,
      suspicious_detection_details: cp?.suspicious_detection_details ?? null,
      registers_precious_metal_tx:  cp?.registers_precious_metal_tx  ?? null,
      monitors_unusual_activity:    cp?.monitors_unusual_activity    ?? null,
      unusual_activity_details:     cp?.unusual_activity_details     ?? null,
      structured_tx_procedures:     cp?.structured_tx_procedures     ?? null,
      max_cash_amount:              cp?.max_cash_amount              ?? null,
      max_eft_amount:               cp?.max_eft_amount               ?? null,
      supplier_bank_pct:            cp?.supplier_bank_pct            ?? null,
      supplier_company_pct:         cp?.supplier_company_pct         ?? null,
      supplier_individual_pct:      cp?.supplier_individual_pct      ?? null,
      payment_bank_transfer_pct:    cp?.payment_bank_transfer_pct    ?? null,
      payment_cheque_pct:           cp?.payment_cheque_pct           ?? null,
      payment_cash_pct:             cp?.payment_cash_pct             ?? null,
      source_material_percentage:   cp?.source_material_percentage   ?? null,
      supplier_profile:             cp?.supplier_profile             ?? null,
      source_material_country:      cp?.source_material_country      ?? null,
      fica_processing_authorised:   cp?.fica_processing_authorised   ?? null,
      popia_consent:                cp?.popia_consent                ?? null,
      info_true_declaration:        cp?.info_true_declaration        ?? null,
      confirms_beneficial_owner_goods:  cp?.confirms_beneficial_owner_goods  ?? null,
      confirms_prevent_criminal_goods:  cp?.confirms_prevent_criminal_goods  ?? null,
      confirms_no_forced_labour:        cp?.confirms_no_forced_labour        ?? null,
      confirms_environmental_compliance:cp?.confirms_environmental_compliance ?? null,
      confirms_no_bribery:              cp?.confirms_no_bribery              ?? null,
      commits_to_oecd:                  cp?.commits_to_oecd                  ?? null,
      declaration_signature_name:       cp?.declaration_signature_name       ?? null,
      declaration_signature_position:   cp?.declaration_signature_position   ?? null,
      declaration_signature_date:       cp?.declaration_signature_date       ?? null,
    });
    setCaseStatus(kycCase.status);
    setRiskFlag(kycCase.risk_flag);
    setEditing(false);
    setError('');
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/cases/${kycCase.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? d.error ?? 'Delete failed');
      }
      router.push('/admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      setDeleting(false);
      setConfirmDel(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <AdminNav />

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <Link href="/admin" className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
              ← All Cases
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-1 flex items-center gap-3">
              {(editing ? (f.registered_name as string) : cp?.registered_name) || (
                <span className="italic text-gray-400 font-normal">Unnamed Entity</span>
              )}
              {(editing ? riskFlag : kycCase.risk_flag) && (
                <span className="text-red-500 text-lg">⚑ Risk Flag</span>
              )}
            </h1>
            <div className="flex items-center gap-3 mt-1.5">
              <StatusBadge status={editing ? caseStatus : kycCase.status} />
              <span className="text-xs font-semibold text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded">
                KYC-{String(kycCase.case_number).padStart(4, '0')}
              </span>
              <span className="text-xs text-gray-400">
                Created {new Date(kycCase.created_at).toLocaleDateString('en-ZA')}
              </span>
            </div>
          </div>

          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            {!editing && (
              <>
                <a href={`/chat/${kycCase.token}`} target="_blank" rel="noreferrer"
                   className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
                  Open Chat ↗
                </a>
                <a href={`/api/pdf/${kycCase.token}`} target="_blank" rel="noreferrer"
                   className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors">
                  ↓ PDF
                </a>
                <a href={`/api/admin/export?id=${kycCase.id}&format=csv`}
                   className="px-3 py-1.5 text-sm bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                  ↓ CSV
                </a>
                <button onClick={() => setEditing(true)}
                   className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-400 transition-colors font-medium">
                  ✎ Edit
                </button>
                <button onClick={() => setConfirmDel(true)}
                   className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors font-medium">
                  Delete
                </button>
              </>
            )}
            {editing && (
              <>
                <button onClick={handleCancel} disabled={saving}
                   className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                   className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors font-semibold disabled:opacity-60 flex items-center gap-2">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Status / error banners ── */}
        {success && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl">
            Changes saved successfully.
          </div>
        )}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl">
            {error}
          </div>
        )}

        {/* ── Delete confirmation ── */}
        {confirmDel && (
          <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-xl flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-800">Permanently delete this case?</p>
              <p className="text-xs text-red-600 mt-0.5">
                This will remove all KYC data, documents, messages, and associated persons. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setConfirmDel(false)}
                disabled={deleting}
                className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold disabled:opacity-60 flex items-center gap-2"
              >
                {deleting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        )}

        {/* ── Edit-mode: case-level fields ── */}
        {editing && (
          <Section title="Case Settings">
            <Row label="Status">
              <select value={caseStatus} onChange={(e) => setCaseStatus(e.target.value)} className={selectCls}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Row>
            <Row label="Risk Flag">
              <select value={riskFlag ? 'true' : 'false'} onChange={(e) => setRiskFlag(e.target.value === 'true')} className={selectCls}>
                <option value="false">No</option>
                <option value="true">Yes — Risk Flagged</option>
              </select>
            </Row>
          </Section>
        )}

        {/* ── Progress summary (view mode only) ── */}
        {!editing && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Mandatory Info', value: `${kycCase.mandatory_percent}%`,   color: kycCase.mandatory_percent  >= 80 ? 'text-green-700' : 'text-amber-600' },
              { label: 'Documents',      value: `${kycCase.docs_percent}%`,        color: kycCase.docs_percent       >= 80 ? 'text-green-700' : 'text-amber-600' },
              { label: 'Overall',        value: `${kycCase.completion_percent}%`,  color: kycCase.completion_percent >= 80 ? 'text-green-700' : 'text-amber-600' },
              { label: 'Messages',       value: String(kycCase.messages.length),   color: 'text-gray-700' },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {cp ? (
          <>
            {/* ── Section 1: Applicant Details ── */}
            <Section title="Section A — 1. Applicant Details">
              <Row label="1.1  Registered Name">{txt('registered_name')}</Row>
              <Row label="1.2  Type of Entity">
                {editing ? (
                  <select value={(f.entity_type as string) ?? ''} onChange={(e) => set('entity_type', e.target.value || null)} className={selectCls}>
                    <option value="">— Not specified</option>
                    <option value="Company">Company</option>
                    <option value="Individual">Individual</option>
                  </select>
                ) : txt('entity_type')}
              </Row>
              <Row label="1.3  Registration / ID No.">{txt('registration_or_id_number')}</Row>
              <Row label="1.4  Business Address">{area('business_address', 2)}</Row>
              <Row label="1.5  Tel (Work)">{txt('business_phone_work', '+27 …')}</Row>
              <Row label="      Tel (Cell)">{txt('business_phone_cell', '+27 …')}</Row>
              <Row label="1.6  Business Email">{txt('email_address', 'name@company.co.za')}</Row>
              <Row label="1.7  Type of Business">{txt('type_of_business', 'e.g. Jewellers, Coin Dealer')}</Row>
              <Row label="1.8  Contact Person">{txt('contact_person_name')}</Row>
              <Row label="      Contact Tel Work">{txt('contact_person_tel_work')}</Row>
              <Row label="      Contact Tel Cell">{txt('contact_person_tel_cell')}</Row>
              <Row label="      Contact Email">{txt('contact_person_email')}</Row>
              <Row label="1.9  FICA Org ID">{txt('fica_org_id')}</Row>
              <Row label="1.10 Website">{txt('website', 'https://')}</Row>
              <Row label="1.11 Tax Registration No.">{txt('tax_number')}</Row>
              <Row label="1.12 VAT Registration No.">{txt('vat_number')}</Row>
              <Row label="1.13 VAT Category">
                {editing ? (
                  <select value={(f.vat_category as string) ?? ''} onChange={(e) => set('vat_category', e.target.value || null)} className={selectCls}>
                    <option value="">— Not specified</option>
                    {['A','B','C','D','E'].map((c) => <option key={c} value={c}>Category {c}</option>)}
                  </select>
                ) : txt('vat_category')}
              </Row>
              <Row label="1.14 Multiple Branches">{bool('multiple_branches')}</Row>
              {(editing || f.multiple_branches === true) && (
                <Row label="      Number of Branches">{num('branch_count')}</Row>
              )}
              <Row label="1.15 PEP Related">{bool('pep_related')}</Row>
              {(editing || f.pep_related === true) && (
                <Row label="      PEP Relationship Details">{txt('pep_relationship_details')}</Row>
              )}
            </Section>

            {/* ── Section 2: Associated Persons (view only) ── */}
            <Section title="Section A — 2. Directors, Owners, Authorised Signatories">
              {cp.associated_persons.length === 0 ? (
                <div className="px-4 py-6 text-sm text-red-500 font-medium text-center">No associated persons on record.</div>
              ) : (
                cp.associated_persons.map((p) => (
                  <div key={p.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-900">{p.person_full_name ?? 'Unknown'}</span>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{p.person_role_type ?? 'Unknown role'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                      {p.person_nationality     && <span><strong>Nationality:</strong> {p.person_nationality}</span>}
                      {p.country_of_incorporation && <span><strong>Country:</strong> {p.country_of_incorporation}</span>}
                      {p.person_id_or_passport  && <span><strong>ID / Passport:</strong> {p.person_id_or_passport}</span>}
                      {p.person_address         && <span><strong>Address:</strong> {p.person_address}</span>}
                      {p.ownership_percentage != null && <span><strong>Ownership:</strong> {p.ownership_percentage}%</span>}
                      {p.person_designation     && <span><strong>Designation:</strong> {p.person_designation}</span>}
                      {p.person_email           && <span><strong>Email:</strong> {p.person_email}</span>}
                      {p.person_phone           && <span><strong>Phone:</strong> {p.person_phone}</span>}
                    </div>
                  </div>
                ))
              )}
              {editing && (
                <div className="px-4 py-2.5 bg-amber-50 text-xs text-amber-700 border-t border-amber-100">
                  Associated persons can only be edited through the chat conversation.
                </div>
              )}
            </Section>

            {/* ── Section 3: Financials ── */}
            <Section title="Section A — 3. Financials">
              <SubSection title="3.1 Banking Details" />
              <Row label="Bank Name">{txt('bank_name')}</Row>
              <Row label="Account Name">{txt('account_name')}</Row>
              <Row label="Account Number">{txt('account_number')}</Row>
              <Row label="Branch Code">{txt('branch_code')}</Row>
              <Row label="Branch Name">{txt('branch_name')}</Row>
              <Row label="SWIFT Code">{txt('swift_code')}</Row>
              <SubSection title="3.2 Auditor Details" />
              <Row label="Audit Company">{txt('audit_company_name')}</Row>
              <Row label="Auditor Tel (Work)">{txt('auditor_phone_work')}</Row>
              <Row label="Auditor Tel (Cell)">{txt('auditor_phone_cell')}</Row>
              <Row label="Last Audit Date">{txt('last_audit_date', 'DD/MM/YYYY')}</Row>
              <SubSection title="3.3 Source of Funding" />
              <Row label="Source of Funds">{area('source_of_funds_description', 2)}</Row>
            </Section>

            {/* ── Section 4: Business Activity ── */}
            <Section title="Section A — 4. Business Activity">
              <Row label="Type(s) of Business">
                {editing
                  ? <input type="text" value={(f.business_type_checkboxes as string) ?? ''} onChange={(e) => set('business_type_checkboxes', e.target.value)} placeholder="e.g. Jeweller, Bank, Refiner" className={inputCls} />
                  : <span className="text-gray-900">{(f.business_type_checkboxes as string) || '—'}</span>
                }
              </Row>
              <Row label="Business Activity Description">{area('business_activity_description', 2)}</Row>
              <Row label="Holds License / Permit">{bool('holds_license')}</Row>
              <Row label="License Types">
                {editing
                  ? <input type="text" value={(f.license_types as string) ?? ''} onChange={(e) => set('license_types', e.target.value)} placeholder="e.g. Jewellers permit, Mining license" className={inputCls} />
                  : <span className="text-gray-900">{(f.license_types as string) || '—'}</span>
                }
              </Row>
              <Row label="License Number">{txt('license_number')}</Row>
              <Row label="License Expiry Date">{txt('license_expiry_date', 'DD/MM/YYYY')}</Row>
            </Section>

            {/* ── Section 7: AML / CFT & Anti-Bribery ── */}
            <Section title="Section 7 — AML / CFT & Anti-Bribery">
              <SubSection title="7. AML / CFT" />
              <Row label="Subject to AML/CFT Law">{bool('subject_to_aml_law')}</Row>
              <Row label="AML Law Name">{txt('aml_law_name')}</Row>
              <Row label="Regulator">{txt('aml_regulator')}</Row>
              <Row label="AML Conformity Program">{bool('has_aml_conformity_program')}</Row>
              <Row label="Compliance Officer Name">{txt('aml_responsible_person_name')}</Row>
              <Row label="Compliance Officer Phone">{txt('aml_responsible_person_phone')}</Row>
              <Row label="Compliance Officer Email">{txt('aml_responsible_person_email')}</Row>
              <SubSection title="8. Anti-Bribery" />
              <Row label="Anti-Bribery Policy">{bool('has_anti_bribery_policy')}</Row>
              <Row label="Charged for Anti-Bribery">{bool('charged_for_anti_bribery')}</Row>
              <Row label="Provides AML Training">{bool('provides_aml_training')}</Row>
            </Section>

            {/* ── Section 9: Transaction Monitoring ── */}
            <Section title="Section 9 — Transaction Monitoring">
              <Row label="Risk-Based Assessment">{bool('performs_risk_assessment')}</Row>
              <Row label="Suspicious Tx Reporting">{bool('suspicious_tx_reporting')}</Row>
              <Row label="Suspicious Tx Details">{area('suspicious_detection_details', 2)}</Row>
              <Row label="Registers Precious Metal Tx">{bool('registers_precious_metal_tx')}</Row>
              <Row label="Monitors Unusual Activity">{bool('monitors_unusual_activity')}</Row>
              <Row label="Unusual Activity Details">{area('unusual_activity_details', 2)}</Row>
              <Row label="Structured Tx Procedures">{bool('structured_tx_procedures')}</Row>
              <Row label="Max Cash Amount (ZAR)">{num('max_cash_amount')}</Row>
              <Row label="Max EFT Amount (ZAR)">{num('max_eft_amount')}</Row>
              <SubSection title="Purchase Source Breakdown" />
              <Row label="Bank %">{num('supplier_bank_pct')}</Row>
              <Row label="Company %">{num('supplier_company_pct')}</Row>
              <Row label="Individual %">{num('supplier_individual_pct')}</Row>
              <SubSection title="Payment Method Breakdown" />
              <Row label="Bank Transfers %">{num('payment_bank_transfer_pct')}</Row>
              <Row label="Cheques %">{num('payment_cheque_pct')}</Row>
              <Row label="Cash %">{num('payment_cash_pct')}</Row>
            </Section>

            {/* ── Section D: Declaration ── */}
            <Section title="Section D — Declaration & Consent">
              <Row label="Information True & Accurate"         highlight={!cp.info_true_declaration ? 'red' : 'green'}>{bool('info_true_declaration')}</Row>
              <Row label="FICA Processing Authorised"          highlight={!cp.fica_processing_authorised ? 'red' : 'green'}>{bool('fica_processing_authorised')}</Row>
              <Row label="POPIA Consent"                       highlight={!cp.popia_consent ? 'red' : 'green'}>{bool('popia_consent')}</Row>
              <Row label="Beneficial Owner of Goods">{bool('confirms_beneficial_owner_goods')}</Row>
              <Row label="Prevents Criminal Goods">{bool('confirms_prevent_criminal_goods')}</Row>
              <Row label="No Forced Labour">{bool('confirms_no_forced_labour')}</Row>
              <Row label="Environmental Compliance">{bool('confirms_environmental_compliance')}</Row>
              <Row label="No Bribery">{bool('confirms_no_bribery')}</Row>
              <Row label="OECD Commitment">{bool('commits_to_oecd')}</Row>
              <SubSection title="Signatory" />
              <Row label="Signatory Name">{txt('declaration_signature_name')}</Row>
              <Row label="Signatory Position">{txt('declaration_signature_position')}</Row>
              <Row label="Signature Date">{txt('declaration_signature_date', 'DD/MM/YYYY')}</Row>
            </Section>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-10 text-center text-gray-400">
            No KYC data collected yet. The counterparty has not started the onboarding conversation.
          </div>
        )}

        {/* ── Documents ── */}
        <Section title={`Documents (${kycCase.documents.length})`}>
          {kycCase.documents.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-400 text-center">No documents uploaded yet.</div>
          ) : (
            kycCase.documents.map((doc) => (
              <div key={doc.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 text-sm">
                <div>
                  <div className="font-medium text-gray-900">{doc.original_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {DOC_LABELS[doc.doc_type] ?? doc.doc_type} · {(doc.file_size / 1024).toFixed(1)} KB ·{' '}
                    {new Date(doc.created_at).toLocaleDateString('en-ZA')}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    doc.status === 'verified' ? 'bg-green-100 text-green-700' :
                    doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'}`}>
                    {doc.status}
                  </span>
                  <a
                    href={`/api/admin/documents/${doc.id}`}
                    download={doc.original_name}
                    className="px-2 py-0.5 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                  >
                    ↓ Download
                  </a>
                </div>
              </div>
            ))
          )}
        </Section>

        {/* ── Case Metadata ── */}
        <Section title="Case Metadata">
          <Row label="Case Number"><span className="font-mono font-semibold text-gray-900">KYC-{String(kycCase.case_number).padStart(4, '0')}</span></Row>
          <Row label="Internal ID"><span className="font-mono text-xs text-gray-400">{kycCase.id}</span></Row>
          <Row label="Token"><span className="font-mono text-xs text-gray-400">{kycCase.token}</span></Row>
          <Row label="Risk Flag"      highlight={kycCase.risk_flag ? 'red' : undefined}><span>{kycCase.risk_flag ? 'YES — Risk Flagged' : 'No'}</span></Row>
          <Row label="Submitted to Compliance"><span>{kycCase.submitted_to_compliance ? `Yes${kycCase.submitted_at ? ' — ' + new Date(kycCase.submitted_at).toLocaleDateString('en-ZA') : ''}` : 'No'}</span></Row>
          <Row label="Created"><span className="text-xs text-gray-600">{new Date(kycCase.created_at).toLocaleString('en-ZA')}</span></Row>
          <Row label="Updated"><span className="text-xs text-gray-600">{new Date(kycCase.updated_at).toLocaleString('en-ZA')}</span></Row>
        </Section>

        {/* ── Sticky save bar (edit mode) ── */}
        {editing && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-6 py-3 flex items-center justify-between z-50">
            <span className="text-sm text-gray-500">
              Editing <span className="font-mono font-semibold text-gray-700">KYC-{String(kycCase.case_number).padStart(4, '0')}</span> — unsaved changes
            </span>
            <div className="flex gap-2">
              <button onClick={handleCancel} disabled={saving}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors font-semibold disabled:opacity-60 flex items-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
