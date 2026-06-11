# CaseBuddy AI — Master TODO & Roadmap
> Last updated: 2026-06-10 | Managed by Superagent

---

## 🔴 PRIORITY 1 — AI Agent Personas (Core Identity)

### 1.1 Restore Maya — Case Intake Agent
- [x] Rename "Alex" back to "Maya" in `src/pages/IntakePage.tsx`
- [x] Add Maya's full persona header (avatar, name, title, personality blurb)
- [x] Update page title to reflect Maya's brand
- [x] Update `aiParalegal` backend function system prompt with Maya persona
- [x] Style Maya's chat bubble with signature violet/purple color

### 1.2 Assign Named Personas to Every Module
| Agent | Module | File | Status |
|-------|--------|------|--------|
| **Maya** | Case Intake | `IntakePage.tsx` | ⚠️ Renamed to Alex — restore |
| **Lex** | Legal Research Hub | `LegalResearchHub.tsx` | ⬜ Not assigned |
| **Doc** | Document Lab + Discovery | `DocumentLab.tsx`, `DiscoveryMiner.tsx` | ⬜ Not assigned |
| **Rex** | Trial Coach + Trial Center | `TrialCenter.tsx` | ⬜ Not assigned |
| **Sol** | Deadlines & SOL Tracker | `DeadlinesAndSol.tsx` | ⬜ Not assigned |
| **Sierra** | Legal Secretary | `LegalSecretary.tsx` | ⬜ Not assigned |
| **Jules** | Jury Simulator | `JurySimulator.tsx` | ⬜ Page missing |
| **Max** | E-Filing & Records | `EFiling.tsx` | ⬜ Not assigned |

- [x] Create `src/agents/personas.ts` — central config for all agent names, colors, avatars, descriptions
- [x] Build reusable `<AgentHeader />` component used across all pages
- [x] Update each module page to import and display its assigned agent

### 1.3 Meet the Team — Dashboard Section
- [x] Add "Meet the Team" section to `Dashboard.tsx`
- [x] Display all 8 agents as cards (name, role, avatar, specialty)
- [x] Each card links to the agent's module
- [x] Add agent availability status indicators

---

## 🔴 PRIORITY 2 — Missing Pages

### 2.1 Witness Prep Page (`/witnesses`) — Agent: Rex
- [x] Create `src/pages/WitnessPrep.tsx`
- [x] Add route in `App.tsx`
- [x] Add to sidebar nav under "Trial Prep"
- [ ] Features:
  - [ ] Input witness name, role, relationship to case
  - [ ] AI generates direct examination questions
  - [ ] AI generates cross-examination questions
  - [ ] Impeachment strategy + credibility assessment
  - [ ] Export questions as printable outline

### 2.2 Jury Simulator Page (`/jury`) — Agent: Jules
- [x] Create `src/pages/JurySimulator.tsx`
- [x] Add route in `App.tsx`
- [x] Add to sidebar nav under "Trial Prep"
- [ ] Features:
  - [ ] 6 AI jurors with distinct personalities (skeptic, empath, analytical, conservative, liberal, undecided)
  - [ ] Present opening statement → get per-juror reactions
  - [ ] Persuasion meter per juror (0–100)
  - [ ] Juror deliberation simulation
  - [ ] Verdict probability tracker
  - [ ] Closing argument feedback

---

## 🟠 PRIORITY 3 — API Integrations

### 3.1 CourtListener API (Free — Real Case Law)
- [ ] Sign up: https://www.courtlistener.com/
- [ ] Add `REACT_APP_COURTLISTENER_API_KEY` to Vercel env
- [ ] Create backend function `courtlistenerSearch`
- [ ] Integrate into `LegalResearchHub.tsx` (Lex)
- [ ] Real case law search, opinions, PACER dockets, citations

### 3.2 PACER API (Federal Court Records)
- [ ] Register: https://pacer.uscourts.gov/register-account
- [ ] Add `PACER_USERNAME` + `PACER_PASSWORD` to env
- [ ] Create backend function `pacerSearch`
- [ ] Federal case lookup, docket retrieval, document access
- [ ] Integrate into Legal Research + E-Filing modules

### 3.3 Stripe (SaaS Billing) 💰
- [ ] Create account: https://stripe.com
- [ ] Add `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` to env
- [ ] Create backend functions: `createCheckoutSession`, `stripeWebhook`
- [ ] Pricing tiers:
  - **Pro Se Plan** — $29/mo (individual, all modules)
  - **Law Firm Starter** — $149/mo (up to 3 users)
  - **Law Firm Pro** — $399/mo (unlimited users + white-label)
- [ ] Build `/pricing` page
- [ ] Add subscription gate to premium features
- [ ] Add billing portal in settings

### 3.4 Twilio (SMS + Deadline Alerts)
- [ ] Create account: https://twilio.com
- [ ] Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` to env
- [ ] Create backend function `sendSmsAlert`
- [ ] Integrate into `DeadlinesAndSol.tsx` (Sol)
- [ ] SMS reminders: 48hr, 24hr, 2hr before deadlines
- [ ] Court date alerts + new lead notifications for firms

### 3.5 DocuSign API (E-Signatures)
- [ ] Create dev account: https://developers.docusign.com
- [ ] Add `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_SECRET`, `DOCUSIGN_ACCOUNT_ID` to env
- [ ] Create backend function `createDocuSignEnvelope`
- [ ] Integrate into `DocumentLab.tsx` and `EFiling.tsx`
- [ ] Send demand letters, retainer agreements, settlement offers for signature
- [ ] Track signature status in real-time

### 3.6 Deepgram (Voice Transcription) ✅ API Key Saved
- [ ] Add `REACT_APP_DEEPGRAM_API_KEY` to Vercel env vars
- [ ] Create backend function `transcribeAudio`
- [ ] Add voice input (mic button) to Maya's intake chat
- [ ] Add deposition transcription tool to `DocumentLab.tsx`
- [ ] Add hearing notes recorder to `TrialCenter.tsx`
- [ ] Speaker diarization for multi-party recordings

### 3.7 SendGrid (Transactional Email)
- [ ] Create account: https://sendgrid.com
- [ ] Add `SENDGRID_API_KEY` to env
- [ ] Create backend function `sendEmail`
- [ ] Case intake summary emailed to client after Maya's interview
- [ ] Deadline alerts via email (Sol)
- [ ] New lead email notification (Sierra)
- [ ] Weekly case status digest

### 3.8 Cal.com API (Consultation Booking)
- [ ] Sign up: https://cal.com (open source)
- [ ] Add `CAL_API_KEY` to env
- [ ] Create backend function `createBooking`
- [ ] Integrate into `LegalSecretary.tsx` (Sierra)
- [ ] Auto-book consultations directly from AI chat widget
- [ ] Sync with Google Calendar

### 3.9 Lob API (Certified Physical Mail)
- [ ] Create account: https://lob.com
- [ ] Add `LOB_API_KEY` to env
- [ ] Create backend function `sendCertifiedMail`
- [ ] Integrate into `DocumentLab.tsx`
- [ ] Send demand letters via USPS certified mail from app
- [ ] Track delivery + legal proof of service

### 3.10 Tyler Technologies eFile API (Direct Court Filing)
- [ ] Research supported states: https://www.tylertech.com
- [ ] Apply for API access
- [ ] Create backend function `eFileDocument`
- [ ] Integrate into `EFiling.tsx` (Max)
- [ ] Direct filing to court without leaving CaseBuddy

### 3.11 Westlaw / Casetext (Premium Legal Research)
- [ ] Contact Thomson Reuters: https://legal.thomsonreuters.com
- [ ] Or Casetext/CoCounsel: https://casetext.com
- [ ] Lock behind Law Firm Pro plan only
- [ ] Integrate into Lex's Legal Research Hub

### 3.12 Google Maps / Places API (Courthouse Finder)
- [ ] Add `REACT_APP_GOOGLE_MAPS_KEY` to env
- [ ] Courthouse locator + nearby process servers, court reporters, notaries
- [ ] Integrate into E-Filing and Case Manager

---

## 🟡 PRIORITY 4 — Feature Enhancements

### 4.1 Voice Input Everywhere (Deepgram)
- [ ] Mic button on Maya's intake chat
- [ ] Voice input on all AI chat interfaces
- [ ] Real-time transcription as user speaks

### 4.2 PDF Export
- [ ] Install `react-pdf` or `jsPDF`
- [ ] Export intake summaries, document analysis, witness prep questions, case timelines

### 4.3 Case File System (Supabase)
- [ ] Wire Supabase to store: cases, documents, deadlines, contacts, intake summaries
- [ ] Link all modules to active case context
- [ ] Case switcher in sidebar

### 4.4 White-Label Mode (Law Firm Sales)
- [ ] Platform-wide firm name + color theme customization
- [ ] Custom domain support
- [ ] Firm logo upload
- [ ] Remove CaseBuddy branding in white-label mode

### 4.5 Mobile PWA Polish
- [ ] Offline mode for case notes
- [ ] Push notifications for deadlines
- [ ] Mobile-optimized layouts for all pages

---

## 🔵 PRIORITY 5 — Growth & Sales

### 5.1 Pricing Page
- [ ] Create `src/pages/Pricing.tsx` at route `/pricing`
- [ ] Three tiers with feature comparison table
- [ ] Stripe Checkout integration

### 5.2 Onboarding Flow
- [ ] First-time user welcome modal
- [ ] "Start with Maya" CTA on dashboard
- [ ] Guided product tour

### 5.3 Analytics
- [ ] Add PostHog or Mixpanel
- [ ] Track: most-used modules, intake completion rate, doc uploads, trial sessions
- [ ] Admin dashboard for firm usage stats

### 5.4 SEO & Marketing
- [ ] Complete `SeoPages.tsx` — landing pages per practice area + state
- [ ] Submit sitemap to Google
- [ ] Add LegalService structured data schema

---

## ✅ COMPLETED
- [x] Initial app deployed to Vercel
- [x] 14 pages built and routed
- [x] Base44 backend functions: aiParalegal, analyzeDocument, discoveryMiner, trialCoach
- [x] Supabase connected
- [x] PWA manifest + service worker
- [x] AI Legal Secretary with embed code
- [x] Deepgram API key saved

---

## 📋 NOTES
- Backend functions: https://superagent-344f8b2b.base44.app/functions/
- Live app: https://casebuddy-ai-trial-prep.vercel.app
- GitHub: https://github.com/patriotnewsactivism/Casebuddy-AI-Trial-Prep
- AI model: Gemini 2.5 Flash (upgrade to Pro for Law Firm tier)
- All API keys → Vercel environment variables only, never commit to repo
