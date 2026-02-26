# Demo Script — Agentic KYC Onboarding

A step-by-step walkthrough to demo the system end-to-end.

---

## Setup (do this first)

```bash
cd kyc-onboarding
# Ensure ANTHROPIC_API_KEY is set in .env
npm install && npm run db:push && npm run db:seed
npm run dev
```

Open: http://localhost:3000

---

## Demo 1 — Company Onboarding (Resume a partially complete case)

### Step 1: Navigate to the pre-seeded company case

Open: **http://localhost:3000/chat/demo-company-kyc-001**

You'll see a partially complete conversation (42%) showing Acme Jewellers (Pty) Ltd.

### Step 2: Ask about progress

Type:
```
what's left?
```

Alex will list the remaining missing fields clearly.

### Step 3: Paste multiple details at once

Type this all at once (demonstrates free-text multi-field input):
```
We are subject to FICA. We have an anti-bribery policy, we do conduct risk assessments,
and we report suspicious transactions. We don't do any cash transactions — 100% bank transfer.
```

Watch Alex extract all 4 AML fields simultaneously and acknowledge each one.

### Step 4: Explain a compliance term

Type:
```
What is an UBO?
```

Alex explains without losing context, then asks the next relevant question.

### Step 5: Complete supply chain declaration

Type:
```
We commit to the OECD guidelines and confirm no child labour, no armed groups, and no money
laundering in our supply chain. Signed by Michael Acme, Director, today 2025-01-20.
```

### Step 6: Complete consents

Type:
```
We consent to POPIA and declare all information is true and accurate.
Signed Michael Acme, Director, 2025-01-20.
```

Watch progress jump to near 100%.

### Step 7: Upload a document

Click the **paperclip icon**, select any PDF or image, choose "Company Registration Documents", upload.

Alex will confirm receipt in the chat.

### Step 8: Export case data

Click **Export** in the top-right. A JSON file downloads with all the structured KYC data — ready for compliance review.

### Step 9: Share the link

Click **Share link** → URL is copied. Open it in a second browser window to demonstrate multi-participant access.

---

## Demo 2 — Individual Onboarding (fresh start)

### Step 1: Start new session

Go to: http://localhost:3000 → Click **Start KYC**

### Step 2: Identify as individual

Type:
```
I'm an individual. My name is John Dlamini.
```

### Step 3: Provide SA ID (demonstrates enrichment)

Type:
```
My SA ID number is 9001045800088. I live at 45 Beach Road, Blouberg, Cape Town, 7441.
My email is john.dlamini@email.com and my cell is 082 345 6789.
```

Alex will:
1. Extract name, ID, address, email, phone in one go
2. Detect the SA ID → DOB enrichment opportunity
3. Ask: "Based on your ID number, your date of birth would be **4 January 1990**. Can you confirm this is correct?"

Type: `Yes, that's correct.`

### Step 4: PEP status

Type:
```
No, I am not a politically exposed person.
```

### Step 5: Banking details

Type:
```
I bank with FNB, account name John Dlamini, account number 62345678901, branch code 250655.
My source of funds is my salary as a gemologist at Cape Gems (Pty) Ltd.
```

### Step 6: Business activity

Type:
```
I buy and sell individual gemstones and pre-owned jewellery. I hold a second-hand goods dealer
license, number SHGD-2024-0045, expiring 2026-03-31.
```

### Step 7: Complete remaining sections

Type:
```
Yes I'm subject to FICA as a dealer. I have an anti-bribery policy, I do risk assessments,
and I report suspicious transactions. I primarily use bank transfer, maybe 5% cash.
```

Then supply chain:
```
I commit to OECD guidelines and confirm no child labour, armed groups, or money laundering
in my supply chain. John Dlamini, Owner, 2025-01-20.
```

Then consents:
```
I consent to POPIA and declare all information is true. John Dlamini, Owner, 2025-01-20.
```

Watch the progress bar hit **100%** and Alex congratulate you!

---

## Key Talking Points

| Feature | Where to show it |
|---|---|
| Multi-field extraction from free text | Demo 1 Step 3, Demo 2 Step 3 |
| Explain compliance terms on demand | Demo 1 Step 4 |
| SA ID → DOB enrichment with confirmation | Demo 2 Step 3 |
| Progress tracking | After each message; "what's left?" |
| Multi-participant (share link) | Demo 1 Step 9 |
| Document upload | Demo 1 Step 7 |
| Structured JSON export | Demo 1 Step 8 |
| Streaming responses | Watch text appear word-by-word |
