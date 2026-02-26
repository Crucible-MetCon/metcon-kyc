import Anthropic from '@anthropic-ai/sdk';
import { KYCExtractionResult } from '@/types/kyc';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
// Extraction tool schema — full KYC DOC 011 field set
// ─────────────────────────────────────────────

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'extract_kyc_fields',
  description: `Extract structured KYC data from the user's conversational message or document content.
Only extract information that is explicitly stated or very clearly implied.
Do NOT infer, guess, or fabricate values.
If the message is a question, greeting, or contains no KYC data, return an empty object {}.
For boolean fields, only set them if the user clearly affirmed or denied.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      // Section A
      entity_type: { type: 'string', enum: ['Company', 'Individual'] },
      registered_name: { type: 'string', description: 'Registered company name OR individual full legal name (1.1)' },
      registration_or_id_number: { type: 'string', description: 'Company reg number / SA ID / Passport number (1.3)' },
      business_address: { type: 'string', description: 'Full business address incl postal code (1.4)' },
      business_phone_work: { type: 'string', description: 'Business telephone work number (1.5)' },
      business_phone_cell: { type: 'string', description: 'Business cell number (1.5)' },
      email_address: { type: 'string', description: 'Business email address (1.6)' },
      type_of_business: { type: 'string', description: 'Type of business e.g. Jewellers, Coin Dealer (1.7)' },
      contact_person_name: { type: 'string', description: 'Contact person name & surname (1.8)' },
      contact_person_tel_work: { type: 'string', description: 'Contact person work tel (1.8)' },
      contact_person_tel_cell: { type: 'string', description: 'Contact person cell (1.8)' },
      contact_person_email: { type: 'string', description: 'Contact person email (1.8)' },
      fica_org_id: { type: 'string', description: 'FICA Org ID — registered as high-value goods dealer (1.9)' },
      website: { type: 'string', description: 'Website URL (1.10)' },
      tax_number: { type: 'string', description: 'Tax registration number (1.11)' },
      vat_number: { type: 'string', description: 'VAT registration number (1.12)' },
      vat_category: { type: 'string', description: 'VAT tax period category A/B/C/D/E (1.13)' },
      multiple_branches: { type: 'boolean', description: 'Has multiple branches (1.14)' },
      branch_count: { type: 'number', description: 'Number of branches (1.14)' },
      pep_related: { type: 'boolean', description: 'Related to Politically Exposed Person (1.15)' },
      pep_relationship_details: { type: 'string', description: 'PEP relationship details (1.15)' },

      // Section D
      bank_name: { type: 'string', description: 'Bank name' },
      account_name: { type: 'string', description: 'Account holder name' },
      account_number: { type: 'string', description: 'Bank account number' },
      branch_code: { type: 'string', description: 'Branch code' },
      branch_name: { type: 'string', description: 'Branch name' },
      swift_code: { type: 'string', description: 'SWIFT/BIC code' },
      audit_company_name: { type: 'string', description: 'Audit company name' },
      auditor_phone_work: { type: 'string', description: 'Auditor work phone' },
      auditor_phone_cell: { type: 'string', description: 'Auditor cell phone' },
      last_audit_date: { type: 'string', description: 'Date of last audit (YYYY-MM-DD)' },
      source_of_funds_description: { type: 'string', description: 'Source of funding description' },

      // Section E
      business_type_checkboxes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Business type checkboxes: Bank, Jeweller, Precious metals trader/dealer, Coins dealer, Scrap dealer, Mint, Refiner, Industrial, Wholesaler, Other',
      },
      business_activity_description: { type: 'string', description: 'Core business activity description' },
      holds_license: { type: 'boolean', description: 'Holds a license/permit' },
      license_types: {
        type: 'array',
        items: { type: 'string' },
        description: 'License/permit types: Mining, Refining, Beneficiation, Jewellers permit, Second-hand goods certificate, Recyclers certificate, Import license, Export license, Other',
      },
      license_number: { type: 'string', description: 'License/permit number' },
      license_expiry_date: { type: 'string', description: 'License expiry date (YYYY-MM-DD)' },

      // Section F
      has_smelting_facilities: { type: 'boolean' },
      has_manufacturing_facilities: { type: 'boolean' },
      produces_retail_products: { type: 'boolean' },
      customer_metals: { type: 'array', items: { type: 'string' }, description: 'Metals to purchase: Gold, Silver, Platinum, Palladium' },
      metal_forms: { type: 'array', items: { type: 'string' }, description: 'Metal forms: Castings, Granules, Findings, Alloys' },
      precious_metal_association: { type: 'boolean', description: 'Member of precious metal association' },
      association_memberships: { type: 'array', items: { type: 'string' }, description: 'LBMA, RJC, Other' },
      supplier_metals: { type: 'array', items: { type: 'string' }, description: 'Metals to send for refining: Gold, Silver, Platinum, Palladium' },
      source_material_percentage: { type: 'string', description: '% source material' },
      supplier_profile: { type: 'string', enum: ['Bank', 'Company', 'Individual', 'Other'] },
      source_material_country: { type: 'string', description: 'Origin country of source material' },
      unprocessed_recycled_kg: { type: 'number', description: 'Unprocessed recycled metals kg/month' },
      jewellers_sweeps_kg: { type: 'number', description: 'Jewellers sweeps/waste kg/month' },
      melted_recycled_kg: { type: 'number', description: 'Melted recycled metals kg/month' },
      primary_mined_kg: { type: 'number', description: 'Primary mined material kg/month' },
      mine_name: { type: 'string' },
      mine_address: { type: 'string' },
      mining_permit_number: { type: 'string' },

      // Section G
      subject_to_aml_law: { type: 'boolean' },
      aml_law_name: { type: 'string', description: 'Applicable AML/CFT law name' },
      aml_regulator: { type: 'string', description: 'Name of regulator' },
      has_aml_conformity_program: { type: 'boolean' },
      aml_responsible_person_name: { type: 'string' },
      aml_responsible_person_phone: { type: 'string' },
      aml_responsible_person_email: { type: 'string' },
      has_anti_bribery_policy: { type: 'boolean' },
      charged_for_anti_bribery: { type: 'boolean' },
      provides_aml_training: { type: 'boolean' },

      // Section H
      performs_risk_assessment: { type: 'boolean' },
      suspicious_tx_reporting: { type: 'boolean' },
      suspicious_detection_details: { type: 'string' },
      registers_precious_metal_tx: { type: 'boolean' },
      monitors_unusual_activity: { type: 'boolean' },
      unusual_activity_details: { type: 'string' },
      structured_tx_procedures: { type: 'boolean' },
      max_cash_amount: { type: 'number', description: 'Max cash payment amount (ZAR)' },
      max_eft_amount: { type: 'number', description: 'Max EFT amount (ZAR)' },
      supplier_bank_pct: { type: 'number', description: 'Supplier type % Bank (0-100)' },
      supplier_company_pct: { type: 'number', description: 'Supplier type % Company (0-100)' },
      supplier_individual_pct: { type: 'number', description: 'Supplier type % Individual (0-100)' },
      payment_bank_transfer_pct: { type: 'number', description: '% paid via bank transfer' },
      payment_cheque_pct: { type: 'number', description: '% paid via cheque' },
      payment_cash_pct: { type: 'number', description: '% paid in cash' },
      payment_method_primary: { type: 'string', enum: ['Bank Transfer', 'Cash', 'Cheque', 'Other'] },
      payment_last_year_description: { type: 'string', description: 'Usual payment method used last financial year' },

      // Section I
      fica_processing_authorised: { type: 'boolean', description: 'Authorise processing & verification for FICA/POPI' },
      popia_consent: { type: 'boolean' },
      info_true_declaration: { type: 'boolean' },
      confirms_beneficial_owner_goods: { type: 'boolean' },
      confirms_legitimate_owners: { type: 'boolean' },
      confirms_prevent_criminal_goods: { type: 'boolean' },
      confirms_legislation_compliance: { type: 'boolean' },
      confirms_no_forced_labour: { type: 'boolean' },
      confirms_environmental_compliance: { type: 'boolean' },
      confirms_no_bribery: { type: 'boolean' },
      commits_to_oecd: { type: 'boolean' },
      declaration_signature_name: { type: 'string' },
      declaration_signature_position: { type: 'string' },
      declaration_signature_date: { type: 'string', description: 'YYYY-MM-DD' },

      // Associated persons
      associated_persons: {
        type: 'array',
        description: 'Directors, shareholders (5%+), UBOs (5%+ individuals), authorised signatories',
        items: {
          type: 'object',
          properties: {
            person_full_name: { type: 'string' },
            person_role_type: {
              type: 'string',
              enum: ['Director', 'Member', 'Owner', 'Shareholder', 'UBO', 'Authorised Signatory', 'Other'],
            },
            person_nationality: { type: 'string' },
            country_of_incorporation: { type: 'string' },
            person_id_or_passport: { type: 'string' },
            person_address: { type: 'string' },
            ownership_percentage: { type: 'number' },
            person_designation: { type: 'string', description: 'Capacity/Designation for auth signatories' },
            person_email: { type: 'string' },
            person_phone: { type: 'string' },
          },
        },
      },
    },
  },
};

// ─────────────────────────────────────────────
// Extract from user message text
// ─────────────────────────────────────────────
export async function extractKYCFields(
  userMessage: string,
  entityType: string | null
): Promise<KYCExtractionResult> {
  return runExtraction(userMessage, entityType, 'user message');
}

// ─────────────────────────────────────────────
// Extract from uploaded document (base64)
// ─────────────────────────────────────────────
export async function extractFromDocument(
  documentContent: string,
  mimeType: string,
  entityType: string | null,
  documentName: string
): Promise<KYCExtractionResult> {
  try {
    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    let messageContent: Anthropic.MessageParam['content'];

    if (isImage) {
      const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
      messageContent = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: documentContent },
        },
        {
          type: 'text',
          text: `This is a KYC document named "${documentName}". Extract all KYC-relevant information from it. Current entity type: ${entityType ?? 'not yet determined'}.`,
        },
      ];
    } else if (isPdf) {
      messageContent = [
        {
          type: 'document' as never,
          source: { type: 'base64', media_type: 'application/pdf', data: documentContent },
        },
        {
          type: 'text',
          text: `This is a KYC document named "${documentName}". Extract all KYC-relevant information from it. Current entity type: ${entityType ?? 'not yet determined'}.`,
        },
      ] as Anthropic.MessageParam['content'];
    } else {
      return {};
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are a KYC data extraction system for a South African high-value goods dealer compliance system.
Extract structured KYC data from uploaded documents. Only extract explicitly visible information — do NOT infer or fabricate.
Current entity type: ${entityType ?? 'not yet determined'}`,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'extract_kyc_fields' },
      messages: [{ role: 'user', content: messageContent }],
    });

    const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use');
    if (!toolUse) return {};

    const extracted = toolUse.input as KYCExtractionResult;
    if (extracted.associated_persons?.length === 0) delete extracted.associated_persons;
    return extracted;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[extraction/doc] Error:', msg);
    return {};
  }
}

// ─────────────────────────────────────────────
// Extract from a pasted image (screenshot / photo)
// Uses Sonnet for stronger OCR, then maps to KYC fields
// ─────────────────────────────────────────────
export async function extractFromPastedImage(
  imageBase64: string,
  mimeType: string,
  entityType: string | null
): Promise<KYCExtractionResult> {
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!supportedTypes.includes(mimeType)) {
    console.error(`[extraction/paste] Unsupported image type: ${mimeType}`);
    return {};
  }

  try {
    const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You are a KYC data extraction specialist for a South African precious metals and high-value goods compliance system.
The user has pasted an image directly into the chat. Your job is to:
1. Read ALL visible text in the image using OCR — names, numbers, addresses, dates, checkboxes, form fields, etc.
2. Map every piece of readable text to the appropriate KYC field in the tool schema.
3. Extract aggressively — if something is visible and legible, extract it.
4. Do NOT infer or fabricate values that are not clearly visible.
Current entity type: ${entityType ?? 'not yet determined'}`,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'extract_kyc_fields' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            {
              type: 'text',
              text: 'Please read all the text visible in this image and extract every KYC-relevant piece of information you can find.',
            },
          ],
        },
      ],
    });

    const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use');
    if (!toolUse) return {};

    const extracted = toolUse.input as KYCExtractionResult;
    if (extracted.associated_persons?.length === 0) delete extracted.associated_persons;
    return extracted;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[extraction/paste] Error:', msg);
    return {};
  }
}

async function runExtraction(
  content: string,
  entityType: string | null,
  source: string
): Promise<KYCExtractionResult> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: `You are a KYC data extraction system for a South African high-value goods dealer compliance system.
Extract structured KYC data from ${source}. Only extract explicitly stated information — do NOT infer, guess, or fabricate.
Current entity type being onboarded: ${entityType ?? 'not yet determined'}`,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'extract_kyc_fields' },
      messages: [{ role: 'user', content }],
    });

    const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use');
    if (!toolUse) return {};

    const extracted = toolUse.input as KYCExtractionResult;
    if (extracted.associated_persons?.length === 0) delete extracted.associated_persons;
    return extracted;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('401') || msg.includes('authentication') || msg.includes('invalid x-api-key')) {
      throw new Error('ANTHROPIC_AUTH: Invalid or missing API key.');
    }
    if (msg.includes('429') || msg.includes('rate_limit')) {
      throw new Error('ANTHROPIC_RATE_LIMIT: API rate limit reached.');
    }
    console.error('[extraction] Error:', msg);
    return {};
  }
}

// ─────────────────────────────────────────────
// Format for agent context
// ─────────────────────────────────────────────
export function formatExtractedForAgent(extracted: KYCExtractionResult): string {
  const skip = new Set(['associated_persons', 'business_type_checkboxes', 'license_types',
    'customer_metals', 'metal_forms', 'association_memberships', 'supplier_metals']);

  const entries = Object.entries(extracted).filter(([k, v]) => v !== undefined && v !== null && !skip.has(k));

  if (entries.length === 0 && !extracted.associated_persons?.length) {
    return 'No structured fields extracted from last message.';
  }

  const lines = entries.map(([k, v]) => {
    const label = k.replace(/_/g, ' ');
    const display = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
    return `  • ${label}: ${display}`;
  });

  if (extracted.associated_persons?.length) {
    lines.push(`  • Associated persons: ${extracted.associated_persons.length} person(s) provided`);
  }

  return lines.join('\n');
}
