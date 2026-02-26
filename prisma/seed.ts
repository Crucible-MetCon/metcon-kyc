/**
 * Demo seed — creates two demo cases aligned with KYC DOC 011 schema.
 * Case 1: Fully-populated company (every field, all 18 document types)
 * Case 2: Empty individual (blank slate for chat testing)
 * Run: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import { WELCOME_MESSAGE } from '../src/lib/conversation';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data…\n');

  // Remove existing demo cases
  await prisma.case.deleteMany({
    where: { token: { in: ['demo-company-kyc-001', 'demo-individual-kyc-001'] } },
  });

  // ─── Case 1: FULLY POPULATED company ───────────────────────────────────────
  // Every counterparty field is filled in; all 18 document types are present.

  const companyCase = await prisma.case.create({
    data: {
      token: 'demo-company-kyc-001',
      status: 'needs_review',
      mandatory_percent: 100,
      docs_percent: 94,
      completion_percent: 97,
      entity_type: 'Company',
      risk_flag: false,
      submitted_to_compliance: false,

      counterparty: {
        create: {
          // ── Section A: Applicant Details ──
          entity_type: 'Company',
          registered_name: 'Goldsmith Jewellers (Pty) Ltd',
          registration_or_id_number: '2018/045321/07',
          business_address: '12 Diamond Street, Sandton, Johannesburg, 2196',
          business_phone_work: '+27 11 555 0100',
          business_phone_cell: '+27 82 555 0100',
          email_address: 'info@goldsmithjewellers.co.za',
          type_of_business: 'Jewellers / Precious Metals Dealer',
          contact_person_name: 'Sarah Goldstein',
          contact_person_tel_work: '+27 11 555 0101',
          contact_person_tel_cell: '+27 82 555 0101',
          contact_person_email: 'sarah.goldstein@goldsmithjewellers.co.za',
          fica_org_id: 'FICA-GJ-00419',
          website: 'https://goldsmithjewellers.co.za',
          tax_number: '9876543210',
          vat_number: '4720123456',
          vat_category: 'B',
          multiple_branches: true,
          branch_count: 3,
          pep_related: false,
          pep_relationship_details: null,

          // ── Section D: Financials ──
          bank_name: 'Standard Bank',
          account_name: 'Goldsmith Jewellers (Pty) Ltd',
          account_number: '012345678',
          branch_code: '051001',
          branch_name: 'Sandton City',
          swift_code: 'SBZAZAJJ',
          audit_company_name: 'Deloitte & Touche South Africa',
          auditor_phone_work: '+27 11 806 5000',
          auditor_phone_cell: '+27 83 123 4567',
          last_audit_date: '2024-09-30',
          source_of_funds_description:
            'Revenue derived from retail and wholesale jewellery sales, custom design commissions, and trade in certified precious metals. Approximately 70% retail, 20% wholesale, 10% custom work.',

          // ── Section E: Business Activity ──
          business_type_checkboxes: JSON.stringify([
            'Jeweller',
            'Precious metals trader/dealer',
            'Manufacturer / fabricator of precious metals',
          ]),
          business_activity_description:
            'Goldsmith Jewellers (Pty) Ltd is a vertically integrated precious metals retailer and wholesaler. The company designs, manufactures, and sells fine jewellery, trades certified gold and platinum, and provides custom refining services for the jewellery trade.',
          holds_license: true,
          license_types: JSON.stringify(['Jewellers permit', 'Precious metals dealer licence']),
          license_number: 'JP/2021/00234',
          license_expiry_date: '2026-12-31',

          // ── Section F: Facilities & Materials ──
          has_smelting_facilities: true,
          has_manufacturing_facilities: true,
          produces_retail_products: true,
          customer_metals_json: JSON.stringify({ gold: true, silver: true, platinum: true, palladium: false }),
          metal_forms_json: JSON.stringify(['Castings', 'Granules', 'Findings', 'Alloys', 'Sheet & Wire']),
          precious_metal_association: true,
          association_memberships_json: JSON.stringify(['RJC', 'LBMA', 'SAPJA']),
          supplier_metals_json: JSON.stringify({ gold: true, silver: true, platinum: false, palladium: false }),
          source_material_percentage: '60',
          supplier_profile: 'Company',
          source_material_country: 'South Africa',
          unprocessed_recycled_kg: 12.5,
          jewellers_sweeps_kg: 5.0,
          melted_recycled_kg: 3.2,
          primary_mined_kg: 0.0,
          mine_name: null,
          mine_address: null,
          mining_permit_number: null,

          // ── Section G: AML / CFT & Anti-Bribery ──
          subject_to_aml_law: true,
          aml_law_name: 'Financial Intelligence Centre Act, 38 of 2001 (FICA)',
          aml_regulator: 'Financial Intelligence Centre (FIC)',
          has_aml_conformity_program: true,
          aml_responsible_person_name: 'Rachel Cohen',
          aml_responsible_person_phone: '+27 82 555 0202',
          aml_responsible_person_email: 'rachel.cohen@goldsmithjewellers.co.za',
          has_anti_bribery_policy: true,
          charged_for_anti_bribery: false,
          provides_aml_training: true,

          // ── Section H: Transaction Monitoring ──
          performs_risk_assessment: true,
          suspicious_tx_reporting: true,
          suspicious_detection_details:
            'Transactions are screened through our AML software (Refinitiv World-Check) on a daily basis. Alerts are reviewed by the Compliance Officer within 24 hours. Any STR is lodged with the FIC within 15 days of detection.',
          registers_precious_metal_tx: true,
          monitors_unusual_activity: true,
          unusual_activity_details:
            'Unusual activity flags include: cash transactions exceeding R 25 000, structuring patterns, new customers purchasing > R 50 000 in first interaction, and cross-border transfers without supporting trade documentation.',
          structured_tx_procedures: true,
          max_cash_amount: 24999,
          max_eft_amount: 5000000,
          supplier_bank_pct: 55,
          supplier_company_pct: 35,
          supplier_individual_pct: 10,
          payment_bank_transfer_pct: 70,
          payment_cheque_pct: 5,
          payment_cash_pct: 25,
          payment_method_primary: 'Bank Transfer',
          payment_last_year_description:
            'In the prior financial year, approximately 70% of payments were received via EFT, 25% in cash (within the R 25 000 limit), and 5% by cheque. All cash receipts are banked the same business day.',

          // ── Section I: Declaration & Consent ──
          fica_processing_authorised: true,
          popia_consent: true,
          info_true_declaration: true,
          confirms_beneficial_owner_goods: true,
          confirms_legitimate_owners: true,
          confirms_prevent_criminal_goods: true,
          confirms_legislation_compliance: true,
          confirms_no_forced_labour: true,
          confirms_environmental_compliance: true,
          confirms_no_bribery: true,
          commits_to_oecd: true,
          declaration_signature_name: 'David Goldstein',
          declaration_signature_position: 'Managing Director',
          declaration_signature_date: '2025-01-15',

          // ── Associated Persons ──
          associated_persons: {
            create: [
              {
                person_full_name: 'David Goldstein',
                person_role_type: 'Director',
                person_nationality: 'South African',
                country_of_incorporation: 'South Africa',
                person_id_or_passport: '7803155042088',
                person_address: '45 Oak Avenue, Sandton, Johannesburg, 2196',
                ownership_percentage: 60,
                person_designation: 'Managing Director',
                person_email: 'david@goldsmithjewellers.co.za',
                person_phone: '+27 82 555 0200',
              },
              {
                person_full_name: 'Rachel Cohen',
                person_role_type: 'Director',
                person_nationality: 'South African',
                country_of_incorporation: 'South Africa',
                person_id_or_passport: '8205280123456',
                person_address: '8 Pine Road, Rosebank, Johannesburg, 2196',
                ownership_percentage: 40,
                person_designation: 'Finance Director',
                person_email: 'rachel@goldsmithjewellers.co.za',
                person_phone: '+27 82 555 0202',
              },
              {
                person_full_name: 'Goldstein Family Trust',
                person_role_type: 'Shareholder',
                country_of_incorporation: 'South Africa',
                person_id_or_passport: 'IT 5892/2015',
                person_address: '45 Oak Avenue, Sandton, Johannesburg, 2196',
                ownership_percentage: 60,
              },
              {
                person_full_name: 'Cohen Investments (Pty) Ltd',
                person_role_type: 'Shareholder',
                country_of_incorporation: 'South Africa',
                person_id_or_passport: '2010/098765/07',
                person_address: '8 Pine Road, Rosebank, Johannesburg, 2196',
                ownership_percentage: 40,
              },
              {
                person_full_name: 'David Goldstein',
                person_role_type: 'UBO',
                person_nationality: 'South African',
                person_id_or_passport: '7803155042088',
                person_address: '45 Oak Avenue, Sandton, Johannesburg, 2196',
                ownership_percentage: 60,
              },
              {
                person_full_name: 'Sarah Goldstein',
                person_role_type: 'Authorised Signatory',
                person_nationality: 'South African',
                person_id_or_passport: '9104120098762',
                person_address: '45 Oak Avenue, Sandton, Johannesburg, 2196',
                person_designation: 'Operations Manager',
                person_email: 'sarah.goldstein@goldsmithjewellers.co.za',
                person_phone: '+27 82 555 0101',
              },
            ],
          },
        },
      },

      // ── Documents (all 18 types) ──
      documents: {
        create: [
          {
            doc_type: 'company_registration',
            original_name: 'GoldsmithJewellers_CIPC_Registration_2018.pdf',
            storage_path: 'uploads/demo/company_registration.pdf',
            file_size: 245760,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'beneficial_ownership',
            original_name: 'GoldsmithJewellers_BeneficialOwnership_Certificate.pdf',
            storage_path: 'uploads/demo/beneficial_ownership.pdf',
            file_size: 189440,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'group_structure',
            original_name: 'GoldsmithJewellers_GroupStructure_Diagram.pdf',
            storage_path: 'uploads/demo/group_structure.pdf',
            file_size: 312320,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'shareholder_certificates',
            original_name: 'GoldsmithJewellers_ShareCertificates_2024.pdf',
            storage_path: 'uploads/demo/shareholder_certificates.pdf',
            file_size: 204800,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'bbbee_cert',
            original_name: 'GoldsmithJewellers_BBBEE_Level3_Certificate_2025.pdf',
            storage_path: 'uploads/demo/bbbee_cert.pdf',
            file_size: 167936,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'vat_revalidation',
            original_name: 'GoldsmithJewellers_VAT_DRC_Revalidation.pdf',
            storage_path: 'uploads/demo/vat_revalidation.pdf',
            file_size: 143360,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'tax_compliance',
            original_name: 'GoldsmithJewellers_TaxCompliance_Pin_2025.pdf',
            storage_path: 'uploads/demo/tax_compliance.pdf',
            file_size: 98304,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'bank_confirmation',
            original_name: 'StandardBank_BankConfirmation_Letter_Jan2025.pdf',
            storage_path: 'uploads/demo/bank_confirmation.pdf',
            file_size: 122880,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'address_proof',
            original_name: 'GoldsmithJewellers_MunicipalAccount_Jan2025.pdf',
            storage_path: 'uploads/demo/address_proof.pdf',
            file_size: 135168,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'id_passport',
            original_name: 'DavidGoldstein_ID_Copy_Certified.pdf',
            storage_path: 'uploads/demo/id_passport_david.pdf',
            file_size: 81920,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'id_passport',
            original_name: 'RachelCohen_ID_Copy_Certified.pdf',
            storage_path: 'uploads/demo/id_passport_rachel.pdf',
            file_size: 79872,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'license_permit',
            original_name: 'JewellersPermit_JP_2021_00234.pdf',
            storage_path: 'uploads/demo/license_permit.pdf',
            file_size: 156672,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'import_export_permit',
            original_name: 'GoldsmithJewellers_ImportPermit_PlatinumGroup.pdf',
            storage_path: 'uploads/demo/import_export_permit.pdf',
            file_size: 172032,
            mime_type: 'application/pdf',
            status: 'received',
          },
          {
            doc_type: 'police_clearance',
            original_name: 'DavidGoldstein_PoliceClearance_2024.pdf',
            storage_path: 'uploads/demo/police_clearance.pdf',
            file_size: 94208,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'supply_chain_declaration',
            original_name: 'GoldsmithJewellers_SupplyChain_Declaration_Signed.pdf',
            storage_path: 'uploads/demo/supply_chain_declaration.pdf',
            file_size: 114688,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'aml_policy',
            original_name: 'GoldsmithJewellers_AML_CFT_Policy_v3_2024.pdf',
            storage_path: 'uploads/demo/aml_policy.pdf',
            file_size: 389120,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'anti_bribery_policy',
            original_name: 'GoldsmithJewellers_AntiBribery_Policy_2024.pdf',
            storage_path: 'uploads/demo/anti_bribery_policy.pdf',
            file_size: 286720,
            mime_type: 'application/pdf',
            status: 'verified',
          },
          {
            doc_type: 'association_proof',
            original_name: 'RJC_MembershipCertificate_2025.pdf',
            storage_path: 'uploads/demo/association_proof.pdf',
            file_size: 131072,
            mime_type: 'application/pdf',
            status: 'verified',
          },
        ],
      },

      messages: {
        create: [
          { role: 'assistant', content: WELCOME_MESSAGE },
          {
            role: 'user',
            content:
              'We are Goldsmith Jewellers (Pty) Ltd, registration 2018/045321/07, based at 12 Diamond Street, Sandton.',
          },
          {
            role: 'assistant',
            content:
              "Welcome, **Goldsmith Jewellers (Pty) Ltd** (2018/045321/07)! I have recorded your Sandton address.\n\nYour KYC submission is nearly complete — **97% overall** with all mandatory fields captured and 17 of 18 documents received. The only item outstanding is confirmation on the import/export permit status. Could you confirm whether the platinum group metals import permit (uploaded 15 Jan) is still current, or should we replace it?",
          },
        ],
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyNum = (companyCase as any).case_number as number | undefined;
  console.log(`Company demo case ready  — KYC-${companyNum ? String(companyNum).padStart(4, '0') : '????'}: http://localhost:3000/chat/demo-company-kyc-001`);

  // ─── Case 2: Fresh INDIVIDUAL case ─────────────────────────────────────────

  const individualCase = await prisma.case.create({
    data: {
      token: 'demo-individual-kyc-001',
      status: 'in_progress',
      mandatory_percent: 0,
      docs_percent: 0,
      completion_percent: 0,
      entity_type: null,
      risk_flag: false,
      counterparty: { create: {} },
      messages: {
        create: [{ role: 'assistant', content: WELCOME_MESSAGE }],
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const individualNum = (individualCase as any).case_number as number | undefined;
  console.log(`Individual demo case ready — KYC-${individualNum ? String(individualNum).padStart(4, '0') : '????'}: http://localhost:3000/chat/demo-individual-kyc-001`);
  console.log('\nSeed complete!');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
