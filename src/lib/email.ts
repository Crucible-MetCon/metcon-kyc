import nodemailer from 'nodemailer';
import { DualProgress } from '@/types/kyc';

const COMPLIANCE_EMAIL = process.env.COMPLIANCE_EMAIL ?? 'grant.crosse@metcon.co.za';
const APP_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

// ─────────────────────────────────────────────
// Create transporter from env vars
// Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env
// ─────────────────────────────────────────────
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user ?? 'noreply@metcon.co.za';

  if (!host || !user || !pass) {
    throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env');
  }

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
    from,
  };
}

// ─────────────────────────────────────────────
// Build email content
// ─────────────────────────────────────────────
interface EmailParams {
  caseId: string;
  token: string;
  registeredName: string;
  entityType: string;
  registrationNumber: string;
  progress: DualProgress;
  uploadedDocuments: Array<{ doc_type: string; original_name: string; file_size: number }>;
  documentAttachments?: Array<{ filename: string; path: string }>;
}

function buildEmailHtml(params: EmailParams): string {
  const caseUrl = `${APP_BASE_URL}/chat/${params.token}`;

  const completedFields = params.progress.mandatory_missing.length === 0
    ? ['All mandatory fields completed ✓']
    : [];

  const outstandingFields = params.progress.mandatory_missing.map((f) => f.label);

  const docsCompleted = params.uploadedDocuments.map((d) =>
    `${d.doc_type.replace(/_/g, ' ')}: ${d.original_name} (${(d.file_size / 1024).toFixed(1)} KB)`
  );

  const docsMissing = params.progress.docs_missing;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #1f2937; background: #f9fafb; margin: 0; padding: 0; }
    .container { max-width: 680px; margin: 24px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1a1a2e; color: #fff; padding: 28px 32px; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 6px 0 0; color: #9ca3af; font-size: 14px; }
    .body { padding: 28px 32px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
    .meta-item { background: #f3f4f6; border-radius: 8px; padding: 10px 14px; }
    .meta-item .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-item .value { font-size: 15px; font-weight: 600; color: #111827; margin-top: 2px; }
    .progress-row { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
    .progress-bar { flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 4px; }
    .progress-fill-a { background: #2563eb; }
    .progress-fill-b { background: #059669; }
    ul { margin: 4px 0; padding-left: 20px; }
    li { font-size: 13px; color: #374151; margin-bottom: 3px; }
    li.ok::marker { content: "✓ "; color: #059669; }
    li.missing::marker { content: "○ "; color: #d97706; }
    .cta { text-align: center; margin-top: 28px; }
    .cta a { background: #1a1a2e; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; }
    .footer { padding: 18px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>MetCon KYC Onboarding Pack</h1>
    <p>Submitted to Compliance Team · ${new Date().toLocaleDateString('en-ZA', { dateStyle: 'long' })}</p>
  </div>
  <div class="body">

    <div class="meta">
      <div class="meta-item">
        <div class="label">Case ID</div>
        <div class="value" style="font-size:12px;font-family:monospace">${params.caseId}</div>
      </div>
      <div class="meta-item">
        <div class="label">Entity Type</div>
        <div class="value">${params.entityType}</div>
      </div>
      <div class="meta-item">
        <div class="label">Registered Name</div>
        <div class="value">${params.registeredName || '(not provided)'}</div>
      </div>
      <div class="meta-item">
        <div class="label">Registration / ID Number</div>
        <div class="value">${params.registrationNumber || '(not provided)'}</div>
      </div>
    </div>

    <div class="section">
      <h2>Completion Overview</h2>
      <div class="progress-row">
        <span style="font-size:13px;width:180px">Mandatory Information</span>
        <div class="progress-bar"><div class="progress-fill progress-fill-a" style="width:${params.progress.mandatory_percent}%"></div></div>
        <span style="font-size:13px;font-weight:600;color:#2563eb">${params.progress.mandatory_percent}%</span>
      </div>
      <div class="progress-row">
        <span style="font-size:13px;width:180px">Documents Supplied</span>
        <div class="progress-bar"><div class="progress-fill progress-fill-b" style="width:${params.progress.docs_percent}%"></div></div>
        <span style="font-size:13px;font-weight:600;color:#059669">${params.progress.docs_percent}%</span>
      </div>
    </div>

    <div class="section">
      <h2>Mandatory Information — Completed vs Outstanding</h2>
      <p style="font-size:13px;color:#6b7280;margin:0 0 8px">
        <span class="badge badge-green">Completed</span>
      </p>
      <ul>
        ${completedFields.map((f) => `<li class="ok">${f}</li>`).join('')}
        ${outstandingFields.length === 0 && completedFields.length === 0 ? '<li class="ok">All mandatory fields provided</li>' : ''}
      </ul>
      ${outstandingFields.length > 0 ? `
      <p style="font-size:13px;color:#6b7280;margin:10px 0 8px">
        <span class="badge badge-amber">Outstanding</span>
      </p>
      <ul>
        ${outstandingFields.map((f) => `<li class="missing">${f}</li>`).join('')}
      </ul>` : ''}
    </div>

    <div class="section">
      <h2>Documents Checklist</h2>
      ${docsCompleted.length > 0 ? `
      <p style="font-size:13px;color:#6b7280;margin:0 0 8px"><span class="badge badge-green">Uploaded</span></p>
      <ul>
        ${docsCompleted.map((d) => `<li class="ok">${d}</li>`).join('')}
      </ul>` : '<p style="font-size:13px;color:#6b7280">No documents uploaded yet.</p>'}
      ${docsMissing.length > 0 ? `
      <p style="font-size:13px;color:#6b7280;margin:10px 0 8px"><span class="badge badge-amber">Missing / Outstanding</span></p>
      <ul>
        ${docsMissing.map((d) => `<li class="missing">${d}</li>`).join('')}
      </ul>` : ''}
    </div>

    <div class="cta">
      <a href="${caseUrl}">View Full Case in App →</a>
      <p style="font-size:12px;color:#9ca3af;margin-top:10px">The compliance team can view all collected data and continue adding information via this link.</p>
    </div>

  </div>
  <div class="footer">
    MetCon · FICA-Compliant KYC System · Case submitted ${new Date().toISOString()}
  </div>
</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// Send compliance email
// ─────────────────────────────────────────────
export async function sendComplianceEmail(params: EmailParams): Promise<void> {
  const { transporter, from } = createTransporter();

  const subject = `[KYC Onboarding] ${params.registeredName || 'New Case'} — Case ${params.caseId.slice(0, 8)}… (${params.progress.mandatory_percent}% mandatory / ${params.progress.docs_percent}% docs)`;

  await transporter.sendMail({
    from,
    to: COMPLIANCE_EMAIL,
    subject,
    html: buildEmailHtml(params),
    attachments: params.documentAttachments ?? [],
  });
}
