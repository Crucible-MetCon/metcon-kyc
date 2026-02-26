# Agentic KYC Onboarding — Prestige Jewels

A conversational KYC onboarding system for a South African high-value goods (jewellery) dealer, compliant with FICA requirements. Collect all required KYC data through a friendly chat interface powered by Claude.

---

## Architecture & Why

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 14** App Router | Full-stack in one repo; SSR for initial data load; API routes co-located |
| UI | **React + Tailwind CSS** | Utility-first styling, minimal setup |
| Database | **SQLite + Prisma** | Zero-config for local PoC; swap `provider = "postgresql"` for production |
| LLM (extraction) | **claude-haiku-4-5** + forced `tool_use` | Fast, cheap, guaranteed structured JSON — no text parsing needed |
| LLM (conversation) | **claude-opus-4-6** + adaptive thinking | Best quality for the conversational agent users interact with |
| File storage | **Local filesystem** (`./uploads/`) | Simple for PoC; swap to S3/R2 by changing the upload route |
| Auth | **UUID case token in URL** | Enables multi-participant by sharing the URL — no login required for PoC |
| Streaming | **Server-Sent Events** | Instant response display; works with Next.js edge-compatible streams |

### Two-Call Pipeline (per user message)

```
User message
    │
    ▼
[1] claude-haiku-4-5 (tool_use forced)
    → extract_kyc_fields → structured JSON
    │
    ▼
Validate → Sanitise → Save to DB → Recalculate progress
    │
    ▼
[2] claude-opus-4-6 (streaming, adaptive thinking)
    → Friendly conversational response (streamed via SSE)
    │
    ▼
Save assistant message → Return to client
```

---

## Local Setup

### Prerequisites
- Node.js 18+
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

### Steps

```bash
# 1. Clone / enter directory
cd kyc-onboarding

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 4. Set up database
npm run db:push       # creates ./dev.db with all tables

# 5. (Optional) Load demo data
npm run db:seed

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | Your Anthropic API key |
| `DATABASE_URL` | Yes | SQLite: `file:./dev.db` · Postgres: `postgresql://...` |
| `UPLOAD_DIR` | Yes | Directory for uploaded files (default: `./uploads`) |
| `NEXT_PUBLIC_BASE_URL` | No | Base URL for sharing links (default: `http://localhost:3000`) |

---

## How Progress Is Calculated

Progress is field-count based, computed deterministically (no LLM involved):

1. A **required field list** is derived based on `entity_type`:
   - **Individual**: 29 required fields across 7 sections
   - **Company**: 32 required fields (adds contact person + at least 1 associated person)

2. **Conditional fields** are added dynamically:
   - `pep_relationship_details` — required only if `pep_related = true`
   - `aml_law_name` — required only if `subject_to_aml_law = true`

3. **Section weights** are equal per field; overall = `filled / total × 100`

4. **Document bonus**: +5% when at least one document has been uploaded

5. **Status**:
   - `complete` — 100% (all fields filled + at least one associated person for companies)
   - `needs_review` — ≥ 95% OR `risk_flag = true` (PEP, high cash)
   - `in_progress` — default

---

## Document Uploads

Documents are stored at `UPLOAD_DIR/{case_id}/{timestamp}-{filename}`.

- Accepted formats: PDF, JPEG, PNG, WebP, HEIC
- Maximum size: 50 MB per file
- Metadata (type, size, MIME, status) is stored in the `Document` table
- Storage path is not included in exports (for security)
- **Production upgrade**: replace the `fs.writeFile` in `src/app/api/upload/[token]/route.ts` with an S3/R2 `PutObjectCommand` and store the object key in `storage_path`

---

## Multi-Participant Support

Any person with the case URL (`/chat/{token}`) can view and contribute to the same case. The token is the sole access control mechanism for the PoC.

To share: click **Share link** in the top-right → URL is copied to clipboard.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/cases` | Create new case, returns `{ token }` |
| `GET` | `/api/cases/[token]` | Get full case with messages + counterparty |
| `GET` | `/api/cases/[token]/export` | Export case as JSON (compliance review) |
| `POST` | `/api/chat/[token]` | Send message, returns SSE stream |
| `POST` | `/api/upload/[token]` | Upload document (multipart form) |
| `GET` | `/api/upload/[token]` | List documents for a case |

---

## Running Tests

```bash
npm test              # run once
npm run test:watch    # watch mode
```

Tests cover:
- **Validation**: email, phone, SA ID (Luhn), percentage ranges
- **Enrichment**: SA ID → DOB derivation, century logic, gender/citizenship
- **Progress**: field counting, conditional fields, company vs individual, document bonus

---

## Production Checklist

- [ ] Switch `prisma/schema.prisma` `provider` to `"postgresql"`
- [ ] Add proper authentication (NextAuth, Clerk, or JWT)
- [ ] Replace local file storage with S3/R2
- [ ] Add rate limiting on the chat endpoint
- [ ] Enable HTTPS / TLS everywhere
- [ ] Set `NODE_ENV=production` and use secrets manager for `ANTHROPIC_API_KEY`
- [ ] Add audit logging (who accessed which case, when)
- [ ] Consider adding a compliance officer review dashboard

---

## Project Structure

```
kyc-onboarding/
├── prisma/
│   ├── schema.prisma          # Database schema (SQLite / PostgreSQL)
│   └── seed.ts               # Demo data
├── src/
│   ├── types/kyc.ts          # All TypeScript types
│   ├── lib/
│   │   ├── prisma.ts         # Prisma client singleton
│   │   ├── extraction.ts     # Claude tool_use extraction pipeline
│   │   ├── conversation.ts   # Claude streaming conversation
│   │   ├── progress.ts       # Deterministic progress calculation
│   │   ├── enrichment.ts     # SA ID → DOB derivation
│   │   └── validation.ts     # Field validators
│   ├── app/
│   │   ├── page.tsx          # Landing page
│   │   ├── chat/[token]/     # Chat UI (server + client)
│   │   └── api/              # REST + SSE endpoints
│   ├── components/
│   │   ├── ChatInterface.tsx # Main chat UI (client)
│   │   ├── MessageBubble.tsx # Message rendering
│   │   ├── ProgressBar.tsx   # Progress display
│   │   └── FileUpload.tsx    # Document upload panel
│   └── __tests__/            # Vitest unit tests
└── uploads/                  # Local document storage (gitignored)
```
