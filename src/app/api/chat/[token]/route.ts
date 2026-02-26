import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractKYCFields, extractFromPastedImage } from '@/lib/extraction';
import { calculateDualProgress } from '@/lib/progress';
import { detectEnrichments } from '@/lib/enrichment';
import { generateStreamingResponse, detectFrustration, detectConfusion } from '@/lib/conversation';
import { validateExtraction, sanitiseExtraction } from '@/lib/validation';
import { KYCExtractionResult } from '@/types/kyc';

export const runtime = 'nodejs';

// POST /api/chat/[token]
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const encoder = new TextEncoder();

  function sseEvent(data: Record<string, unknown>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { message, imageData, imageMimeType } = await req.json() as {
          message: string;
          imageData?: string;
          imageMimeType?: string;
        };

        if (!message?.trim() && !imageData) {
          controller.enqueue(sseEvent({ type: 'error', message: 'Message cannot be empty' }));
          controller.close();
          return;
        }

        // Load case
        const kycCase = await prisma.case.findUnique({
          where: { token: params.token },
          include: {
            counterparty: { include: { associated_persons: true } },
            messages: { orderBy: { created_at: 'asc' } },
            documents: true,
            pending_extractions: { where: { status: 'pending' }, orderBy: { created_at: 'asc' } },
          },
        });

        if (!kycCase || !kycCase.counterparty) {
          controller.enqueue(sseEvent({ type: 'error', message: 'Case not found' }));
          controller.close();
          return;
        }

        // Detect frustration / confusion
        const frustratedUser = detectFrustration(message) || detectConfusion(message);

        // Save user message
        await prisma.message.create({
          data: { case_id: kycCase.id, role: 'user', content: message.trim() },
        });

        // Check pending extractions — handle confirmation/denial
        const pendingExtraction = kycCase.pending_extractions[0] ?? null;
        let pendingExtractionMessage: string | undefined;
        let committedFromDoc = false;

        if (pendingExtraction) {
          const lc = message.trim().toLowerCase();
          const confirmed = /^(yes|confirm|correct|that'?s right|yep|ja|ya|sure|ok|okay|proceed)/.test(lc);
          const denied = /^(no|not|wrong|incorrect|skip|ignore|that'?s not right|nope)/.test(lc);

          if (confirmed) {
            // Commit extracted fields from document
            const docExtracted = JSON.parse(pendingExtraction.extracted_fields_json) as KYCExtractionResult;
            const counterpartyUpdate: Record<string, unknown> = {};
            const scalarFields: (keyof KYCExtractionResult)[] = [
              'entity_type','registered_name','registration_or_id_number','business_address',
              'business_phone_work','business_phone_cell','email_address','type_of_business',
              'contact_person_name','contact_person_tel_work','contact_person_tel_cell','contact_person_email',
              'fica_org_id','website','tax_number','vat_number','vat_category',
              'bank_name','account_name','account_number','branch_code','branch_name','swift_code',
              'source_of_funds_description','business_activity_description','holds_license',
              'license_number','license_expiry_date',
            ];
            for (const k of scalarFields) {
              const v = docExtracted[k];
              if (v !== undefined && v !== null) counterpartyUpdate[k] = v;
            }
            // JSON array fields
            if (docExtracted.business_type_checkboxes?.length)
              counterpartyUpdate.business_type_checkboxes = JSON.stringify(docExtracted.business_type_checkboxes);
            if (docExtracted.license_types?.length)
              counterpartyUpdate.license_types = JSON.stringify(docExtracted.license_types);

            if (Object.keys(counterpartyUpdate).length > 0) {
              await prisma.counterparty.update({
                where: { id: kycCase.counterparty.id },
                data: counterpartyUpdate,
              });
            }

            if (docExtracted.associated_persons?.length) {
              for (const p of docExtracted.associated_persons) {
                await prisma.associatedPerson.create({
                  data: { counterparty_id: kycCase.counterparty.id, ...p },
                });
              }
            }

            await prisma.pendingExtraction.update({
              where: { id: pendingExtraction.id },
              data: { status: 'confirmed' },
            });

            committedFromDoc = true;
          } else if (denied) {
            await prisma.pendingExtraction.update({
              where: { id: pendingExtraction.id },
              data: { status: 'rejected' },
            });
          } else {
            // Still pending — include message in system prompt
            pendingExtractionMessage = pendingExtraction.confirmation_message;
          }
        }

        // Extraction pipeline (from text and/or pasted image)
        controller.enqueue(sseEvent({ type: 'status', message: 'Extracting information…' }));

        let rawExtracted: KYCExtractionResult = {};
        if (!committedFromDoc) {
          const [textExtracted, imgExtracted] = await Promise.all([
            message.trim() ? extractKYCFields(message, kycCase.entity_type) : Promise.resolve({}),
            imageData && imageMimeType
              ? extractFromPastedImage(imageData, imageMimeType, kycCase.entity_type)
              : Promise.resolve({}),
          ]);
          rawExtracted = { ...textExtracted, ...imgExtracted } as KYCExtractionResult;
        }

        const validation = validateExtraction(rawExtracted);
        const extracted = sanitiseExtraction(rawExtracted, validation);

        const enrichments = detectEnrichments(
          extracted.registration_or_id_number ?? kycCase.counterparty.registration_or_id_number,
          null
        );

        // Persist extracted counterparty fields
        const counterpartyUpdate: Record<string, unknown> = {};
        const personExtract = extracted.associated_persons ?? [];

        const scalarFields: (keyof KYCExtractionResult)[] = [
          'entity_type','registered_name','registration_or_id_number','business_address',
          'business_phone_work','business_phone_cell','email_address','type_of_business',
          'contact_person_name','contact_person_tel_work','contact_person_tel_cell','contact_person_email',
          'fica_org_id','website','tax_number','vat_number','vat_category','multiple_branches','branch_count',
          'pep_related','pep_relationship_details',
          'bank_name','account_name','account_number','branch_code','branch_name','swift_code',
          'audit_company_name','auditor_phone_work','auditor_phone_cell','last_audit_date','source_of_funds_description',
          'business_activity_description','holds_license','license_number','license_expiry_date',
          'has_smelting_facilities','has_manufacturing_facilities','produces_retail_products',
          'source_material_percentage','supplier_profile','source_material_country',
          'unprocessed_recycled_kg','jewellers_sweeps_kg','melted_recycled_kg','primary_mined_kg',
          'mine_name','mine_address','mining_permit_number','precious_metal_association',
          'subject_to_aml_law','aml_law_name','aml_regulator','has_aml_conformity_program',
          'aml_responsible_person_name','aml_responsible_person_phone','aml_responsible_person_email',
          'has_anti_bribery_policy','charged_for_anti_bribery','provides_aml_training',
          'performs_risk_assessment','suspicious_tx_reporting','suspicious_detection_details',
          'registers_precious_metal_tx','monitors_unusual_activity','unusual_activity_details',
          'structured_tx_procedures','max_cash_amount','max_eft_amount',
          'supplier_bank_pct','supplier_company_pct','supplier_individual_pct',
          'payment_bank_transfer_pct','payment_cheque_pct','payment_cash_pct',
          'payment_method_primary','payment_last_year_description',
          'fica_processing_authorised','popia_consent','info_true_declaration',
          'confirms_beneficial_owner_goods','confirms_legitimate_owners','confirms_prevent_criminal_goods',
          'confirms_legislation_compliance','confirms_no_forced_labour','confirms_environmental_compliance',
          'confirms_no_bribery','commits_to_oecd',
          'declaration_signature_name','declaration_signature_position','declaration_signature_date',
        ];

        for (const key of scalarFields) {
          const v = extracted[key];
          if (v !== undefined && v !== null) counterpartyUpdate[key] = v;
        }

        // JSON array fields
        if (extracted.business_type_checkboxes?.length)
          counterpartyUpdate.business_type_checkboxes = JSON.stringify(extracted.business_type_checkboxes);
        if (extracted.license_types?.length)
          counterpartyUpdate.license_types = JSON.stringify(extracted.license_types);
        if (extracted.customer_metals?.length)
          counterpartyUpdate.customer_metals_json = JSON.stringify(extracted.customer_metals);
        if (extracted.metal_forms?.length)
          counterpartyUpdate.metal_forms_json = JSON.stringify(extracted.metal_forms);
        if (extracted.association_memberships?.length)
          counterpartyUpdate.association_memberships_json = JSON.stringify(extracted.association_memberships);
        if (extracted.supplier_metals?.length)
          counterpartyUpdate.supplier_metals_json = JSON.stringify(extracted.supplier_metals);

        const caseUpdate: Record<string, unknown> = {};
        if (extracted.entity_type) caseUpdate.entity_type = extracted.entity_type;
        if (extracted.pep_related === true) caseUpdate.risk_flag = true;
        if ((extracted.payment_cash_pct ?? 0) > 50 || (extracted.max_cash_amount ?? 0) > 25000) {
          caseUpdate.risk_flag = true;
        }

        await Promise.all([
          Object.keys(counterpartyUpdate).length > 0
            ? prisma.counterparty.update({ where: { id: kycCase.counterparty.id }, data: counterpartyUpdate })
            : Promise.resolve(),
          ...personExtract.map((p) =>
            prisma.associatedPerson.create({
              data: { counterparty_id: kycCase.counterparty!.id, ...p },
            })
          ),
        ]);

        // Refresh and recalculate progress
        const freshCounterparty = await prisma.counterparty.findUnique({
          where: { id: kycCase.counterparty.id },
          include: { associated_persons: true },
        });

        const freshDocs = await prisma.document.findMany({ where: { case_id: kycCase.id } });
        const progress = calculateDualProgress(freshCounterparty!, freshDocs);

        await prisma.case.update({
          where: { id: kycCase.id },
          data: {
            mandatory_percent: progress.mandatory_percent,
            docs_percent: progress.docs_percent,
            completion_percent: progress.overall,
            status: progress.status,
            ...(Object.keys(caseUpdate).length > 0 ? caseUpdate : {}),
          },
        });

        controller.enqueue(sseEvent({
          type: 'progress',
          mandatoryPercent: progress.mandatory_percent,
          docsPercent: progress.docs_percent,
          completionPercent: progress.overall,
          status: progress.status,
          canSubmit: progress.can_submit,
        }));

        // Conversation pipeline
        type ConversationMessage = { role: 'user' | 'assistant'; content: string | unknown[] };
        const lastUserContent: ConversationMessage['content'] = imageData && imageMimeType
          ? [
              { type: 'image', source: { type: 'base64', media_type: imageMimeType, data: imageData } },
              { type: 'text', text: message.trim() || 'Please review this image and extract any relevant KYC information.' },
            ]
          : message.trim();

        const messageHistory: ConversationMessage[] = [
          ...kycCase.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user' as const, content: lastUserContent },
        ];

        controller.enqueue(sseEvent({ type: 'status', message: 'Generating response…' }));

        const hasPending = !!pendingExtractionMessage;

        const responseStream = await generateStreamingResponse(
          messageHistory,
          extracted.entity_type ?? kycCase.entity_type,
          progress,
          extracted,
          enrichments,
          kycCase.risk_flag || !!caseUpdate.risk_flag,
          params.token,
          frustratedUser,
          hasPending,
          pendingExtractionMessage
        );

        let fullResponseText = '';
        controller.enqueue(sseEvent({ type: 'response_start' }));

        for await (const event of responseStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const chunk = event.delta.text;
            fullResponseText += chunk;
            controller.enqueue(sseEvent({ type: 'delta', text: chunk }));
          }
        }

        const metadata = JSON.stringify({
          extractedFields: extracted,
          validationErrors: validation.errors,
          enrichments,
          progressBefore: kycCase.completion_percent,
          progressAfter: progress.overall,
          committedFromDoc,
        });

        await prisma.message.create({
          data: { case_id: kycCase.id, role: 'assistant', content: fullResponseText, metadata },
        });

        controller.enqueue(sseEvent({
          type: 'done',
          mandatoryPercent: progress.mandatory_percent,
          docsPercent: progress.docs_percent,
          completionPercent: progress.overall,
          status: progress.status,
          canSubmit: progress.can_submit,
          enrichments,
        }));

        controller.close();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        // Avoid logging sensitive data — only log error category
        let userMessage = 'Something went wrong. Please try again.';
        if (msg.includes('ANTHROPIC_AUTH') || msg.includes('invalid x-api-key') || msg.includes('401')) {
          userMessage = '⚠️ API key not configured. Please add your ANTHROPIC_API_KEY to the .env file.';
        } else if (msg.includes('ANTHROPIC_RATE_LIMIT') || msg.includes('429')) {
          userMessage = '⚠️ Rate limit reached. Please wait a moment and try again.';
        } else if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
          userMessage = '⚠️ Could not connect to the AI service. Please check your connection.';
        }

        controller.enqueue(sseEvent({ type: 'error', message: userMessage }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
