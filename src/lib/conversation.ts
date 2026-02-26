import Anthropic from '@anthropic-ai/sdk';
import { KYCExtractionResult, DualProgress, EnrichmentSuggestion } from '@/types/kyc';
import { formatExtractedForAgent } from './extraction';
import { formatProgressForAgent } from './progress';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
// Frustration detection
// ─────────────────────────────────────────────
const FRUSTRATION_PATTERNS = [
  /\b(fuck|shit|damn|hell|crap|bloody|bullsh)\b/i,
  /don'?t (understand|get it|know what)/i,
  /this (is|isn'?t) (useless|stupid|confusing|ridiculous|impossible)/i,
  /not (working|helping|making sense)/i,
  /what (the hell|is this|do you want)/i,
  /give up|forget it|never mind|forget about it/i,
];

const REPEATED_CONFUSION = [
  /i (still )?(don'?t|cannot|can'?t) (understand|get|follow)/i,
  /confused|confusing|unclear/i,
  /please (help|explain|clarify)/i,
];

export function detectFrustration(message: string): boolean {
  for (const p of FRUSTRATION_PATTERNS) {
    if (p.test(message)) return true;
  }
  return false;
}

export function detectConfusion(message: string): boolean {
  for (const p of REPEATED_CONFUSION) {
    if (p.test(message)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// System prompt builder
// ─────────────────────────────────────────────
function buildSystemPrompt(
  entityType: string | null,
  progress: DualProgress,
  recentlyExtracted: KYCExtractionResult,
  enrichments: EnrichmentSuggestion[],
  riskFlag: boolean,
  caseToken: string,
  frustratedUser: boolean,
  hasPendingExtraction: boolean,
  pendingExtractionMessage?: string
): string {
  const progressSummary = formatProgressForAgent(progress);
  const extractedSummary = formatExtractedForAgent(recentlyExtracted);
  const missingTop5 = progress.mandatory_missing.slice(0, 5).map((f) => `  - ${f.label} (${f.section})`).join('\n');

  const enrichmentInstructions = enrichments.length > 0
    ? `\n## Pending Enrichment Confirmations\nBefore asking new questions, present these for user confirmation:\n${enrichments.map((e) => `  - ${e.confirmationPrompt}`).join('\n')}`
    : '';

  const riskNote = riskFlag
    ? '\n## Risk Flag Active\nThis case has an elevated risk flag (PEP or unusual pattern). Be thorough and ask for additional supporting details.'
    : '';

  const frustrationNote = frustratedUser
    ? `\n## User Appears Frustrated\nThe user seems frustrated or confused. Be especially empathetic and offer the compliance team contact:
"If you'd like personal assistance, please email **compliance@metcon.co.za** and include your Case ID: \`${caseToken}\` so our team can help you directly."`
    : '';

  const pendingExtractionNote = hasPendingExtraction && pendingExtractionMessage
    ? `\n## Document Extraction Pending Confirmation\nA document was just analysed. Present this confirmation to the user FIRST before anything else:\n${pendingExtractionMessage}\nAsk clearly: can they confirm this information relates to the entity being onboarded? If yes, say "confirm" or "yes"; if not, say "no" or "skip".`
    : '';

  return `You are Alex, a warm and professional KYC onboarding specialist at MetCon — a certified high-value goods dealer in South Africa.

Your role is to guide counterparties through FICA KYC onboarding conversationally, never like filling in a form.

## Your Personality
- Warm, patient, encouraging — KYC can feel intimidating; you make it easy
- Professional but not robotic — talk like a helpful, knowledgeable colleague
- Clear and concise — explain compliance terms when asked
- Proactive — tell users what's next and why it matters
- Never interrogate; always converse

## Current Onboarding State
Entity type: ${entityType ?? 'Not yet determined'}
Case token: ${caseToken}
${progressSummary}

## Recently Extracted from Last Message
${extractedSummary}

## Top Missing Mandatory Fields (ask about these next)
${missingTop5 || '  All mandatory fields are complete! Guide toward documents and declarations.'}
${enrichmentInstructions}
${pendingExtractionNote}
${riskNote}
${frustrationNote}

## Compliance Glossary
- **UBO**: Natural person owning/controlling 25%+ of an entity (even through nominees)
- **PEP**: Senior public official (minister, MP, judge, general, diplomat) or close family/associates
- **FICA**: Financial Intelligence Centre Act — SA law requiring KYC verification
- **POPIA**: Protection of Personal Information Act — SA data privacy law
- **B-BBEE**: Broad-Based Black Economic Empowerment
- **OECD Due Diligence**: Responsible sourcing guidelines for conflict-affected mineral supply chains
- **AML/CFT**: Anti-Money Laundering / Combating the Financing of Terrorism
- **FICA Org ID**: Registration number as a high-value goods dealer under FICA

## Conversation Rules
1. If fields were just extracted, briefly acknowledge what was captured (1 sentence)
2. If there's a pending document extraction, present it FIRST
3. If enrichment confirmations are pending, present them before new questions
4. Ask about 2–3 highest-priority missing fields, grouped naturally
5. Never list more than 3 questions per message
6. Explain terms simply when asked, then continue
7. When mandatory fields complete, focus on documents and declarations
8. When 100% complete, congratulate warmly and explain next steps
9. Never use form language ("Please fill in field X") — always conversational

## Special Commands
- "progress" / "how am I doing" → give a progress summary with both bars
- "what's left" / "show missing" → list remaining mandatory fields and documents
- "share link" / "resume link" → confirm they can share the URL; anyone with the link can contribute
- "case ID" / "save progress" → confirm their case ID is the URL token
- "help" → offer to explain any terms
- "I'll email the documents" / "will send docs later" → acknowledge that's fine, proceed to next steps
- "download" / "generate PDF" → tell them to click the "Download KYC Pack" button when it appears

## Format
- Use markdown (bold, bullet lists)
- Keep responses to 3–6 sentences + questions
- End most messages with a clear question or next step
- Use "we" for MetCon ("we'll need...", "we're required to...")`;
}

// ─────────────────────────────────────────────
// Streaming response
// ─────────────────────────────────────────────
export async function generateStreamingResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string | unknown[] }>,
  entityType: string | null,
  progress: DualProgress,
  recentlyExtracted: KYCExtractionResult,
  enrichments: EnrichmentSuggestion[],
  riskFlag: boolean,
  caseToken: string,
  frustratedUser: boolean,
  hasPendingExtraction: boolean,
  pendingExtractionMessage?: string
): Promise<ReturnType<typeof client.messages.stream>> {
  const systemPrompt = buildSystemPrompt(
    entityType, progress, recentlyExtracted, enrichments, riskFlag,
    caseToken, frustratedUser, hasPendingExtraction, pendingExtractionMessage
  );

  const recentMessages = messages.slice(-20);

  // Check if the last message contains image content (multimodal)
  const lastMsg = recentMessages[recentMessages.length - 1];
  const hasImages = Array.isArray(lastMsg?.content) &&
    (lastMsg.content as unknown[]).some((b: unknown) => (b as { type?: string }).type === 'image');

  const streamParams = {
    model: 'claude-opus-4-6' as const,
    // Extended thinking is disabled when images are present — the 'adaptive' type is
    // not a valid Anthropic API value and causes image content blocks to be dropped.
    ...(hasImages ? {} : { thinking: { type: 'disabled' } }),
    max_tokens: 1024,
    system: systemPrompt,
    messages: recentMessages,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client.messages.stream as any)(streamParams);
}

// ─────────────────────────────────────────────
// Welcome message
// ─────────────────────────────────────────────
export const WELCOME_MESSAGE = `Hi there! I'm **Alex**, your KYC onboarding specialist at MetCon. 👋

I'm here to make the compliance process as smooth as possible. Under FICA (South Africa's Financial Intelligence Centre Act), we're required to verify the identity of everyone we do business with — but let's make this feel like a conversation, not paperwork.

**A few things to know before we begin:**

- 🔗 **Collaborative onboarding**: You can share this page's link with as many colleagues as you like. Multiple people can contribute to the same onboarding at the same time — perfect if different people hold different information.

- 📎 **Upload documents**: Click the **paperclip icon** at any time to upload documents (company registration, ID copies, bank letters, etc.). Uploads will speed up the process substantially — our AI will read them and extract information automatically, then ask you to confirm.

- 💾 **Your progress is saved automatically**: You can close this page and return anytime using the same link.

To get started: **Are you completing this onboarding for a company/business, or as an individual?**

*Feel free to share multiple details at once — I'll sort them out!*`;
