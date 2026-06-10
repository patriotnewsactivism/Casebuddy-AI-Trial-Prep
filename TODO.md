# CaseBuddy AI — Master TODO & Roadmap
> Last updated: 2026-06-10 | Managed by Superagent

---

## 🔴 PRIORITY 1 — AI Agent Personas (Core Identity)

### 1.1 Restore Maya — Case Intake Agent
- [ ] Rename "Alex" back to "Maya" in `src/pages/IntakePage.tsx`
- [ ] Add Maya's full persona header (avatar, name, title, personality blurb)
- [ ] Update page title from "AI Client Intake" to reflect Maya's brand
- [ ] Add Maya persona to `aiParalegal` backend function system prompt
- [ ] Style Maya's chat bubble with her signature color (violet/purple)

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

- [ ] Create shared `src/agents/personas.ts` — central config for all agent names, colors, avatars, descriptions
- [ ] Build reusable `<AgentHeader />` component used across all pages
- [ ] Update each module page to import and display its assigned agent

### 1.3 Meet the Team — Dashboard Section
- [ ] Add "Meet the Team" section to `Dashboard.tsx`
- [ ] Display all 8 agents as cards (name, role, avatar, specialty)
- [ ] Each card links to the agent's module
- [ ] Add agent status indicators (Available / Busy / etc.)

---

## 🔴 PRIORITY 2 — Missing Pages

### 2.1 Witness Prep Page (`/witnesses`) — Agent: Rex
- [ ] Create `src/pages/WitnessPrep.tsx`
- [ ] Add route in `App.tsx`
- [ ] Add to sidebar nav under "Trial Prep"
- [ ] Features:
  - [ ] Input witness name, role, relationship to case
  - [ ] AI generates direct examination questions
  - [ ] AI generates cross-examination questions
  - [ ] Impeachment strategy based on likely weaknesses
  - [ ] Witness credibility assessment
  - [ ] Export questions as PDF/printable outline

### 2.2 Jury Simulator Page (`/jury`) — Agent: Jules
- [ ] Create `src/pages/JurySimulator.tsx`
- [ ] Add route in `App.tsx`
- [ ] Add to sidebar nav under "Trial Prep"
- [ ] Features:
  - [ ] 6 AI jurors with distinct personalities (skeptic, empath, analytical, conservative, liberal, undecided)
  - [ ] Present opening statement → get juror reactions
  - [ ] Persuasion meter per juror (0–100)
  - [ ] Juror deliberation simulation
  - [ ] Verdict probability tracker
  - [ ] Closing argument feedback

---

## 🟠 PRIORITY 3 — API Integrations

### 3.1 CourtListener API (Free — Legal Research)
- [ ] Sign up at https://www.courtlistener.com/
- [ ] Add `REACT_APP_COURTLISTENER_API_KEY` to `.env`
- [ ] Create backend function `courtlistenerSearch`
- [ ] Integrate into `LegalResearchHub.tsx` (Lex's module)
- [ ] Features: case law search, opinion lookup, PACER dockets, citation analysis
- [ ] Add "Real Case Law" badge to search results

### 3.2 PACER API (Federal Court Records)
- [ ] Register at https://pacer.uscourts.gov/register-account
- [ ] Add `PACER_USERNAME` + `PACER_PASSWORD` to env
- [ ] Create backend function `pacerSearch`
- [ ] Integrate into Legal Research + E-Filing modules
- [ ] Federal case lookup, docket retrieval, document access

### 3.3 Stripe (SaaS Billing)
- [ ] Create Stripe account at https://stripe.com
- [ ] Add `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` to env
- [ ] Create backend function `createCheckoutSession`
- [ ] Create backend function `stripeWebhook`
- [ ] Define pricing tiers:
  - **Pro Se Plan** — $29/mo (individual, all modules)
  - **Law Firm Starter** — $149/mo (up to 3 users)
  - **Law Firm Pro** — $399/mo (unlimited users + white-label)
- [ ] Build `/pricing` page
- [ ] Add subscription gate to premium features
- [ ] Add billing portal link in settings

### 3.4 Twilio (SMS + Voice Alerts)
- [ ] Create Twilio account at https://twilio.com
- [ ] Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` to env
- [ ] Create backend function `sendSmsAlert`
- [ ] Integrate into `DeadlinesAndSol.tsx` (Sol's module)
- [ ] Features:
  - [ ] SMS reminders for upcoming deadlines (48hr, 24hr, 2hr)
  - [ ] Court date alerts
  - [ ] New lead notifications for law firms
  - [ ] Opt-in/opt-out management

### 3.5 DocuSign API (E-Signatures)
- [ ] Create DocuSign developer account at https://developers.docusign.com
- [ ] Add `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_SECRET`, `DOCUSIGN_ACCOUNT_ID` to env
- [ ] Create backend function `createDocuSignEnvelope`
- [ ] Integrate into `DocumentLab.tsx` and `EFiling.tsx`
- [ ] Features:
  - [ ] Send demand letters for signature
  - [ ] Retainer agreement signing
  - [ ] Settlement offer signatures
  - [ ] Track signature status in real-time

### 3.6 Deepgram (Voice Transcription) ✅ API Key Saved
- [ ] Add `REACT_APP_DEEPGRAM_API_KEY` to Vercel env vars
- [ ] Create backend function `transcribeAudio`
- [ ] Add voice input to Maya's intake (speak instead of type)
- [ ] Add deposition transcription tool to `DocumentLab.tsx`
- [ ] Add hearing notes recorder to `TrialCenter.tsx`
- [ ] Speaker diarization for multi-party recordings
- [ ] Confidence scores + timestamps in output

### 3.7 SendGrid (Transactional Email)
- [ ] Create SendGrid account at https://sendgrid.com
- [ ] Add `SENDGRID_API_KEY` to env
- [ ] Create backend function `sendEmail`
- [ ] Use cases:
  - [ ] Case intake summary emailed to client after Maya's interview
  - [ ] Deadline alerts via email (Sol)
  - [ ] New lead email notification (Sierra)
  - [ ] Document analysis reports emailed to attorney
  - [ ] Weekly case status digest

### 3.8 Calendly / Cal.com API (Consultation Booking)
- [ ] Sign up at https://cal.com (open source, self-hostable) or https://calendly.com
- [ ] Add `CALENDLY_API_KEY` or `CAL_API_KEY` to env
- [ ] Create backend function `createBooking`
- [ ] Integrate into `LegalSecretary.tsx` (Sierra's module)
- [ ] Auto-book consultations from AI chat widget
- [ ] Sync with Google Calendar

### 3.9 Lob API (Physical Mail)
- [ ] Create Lob account at https://lob.com
- [ ] Add `LOB_API_KEY` to env
- [ ] Create backend function `sendCertifiedMail`
- [ ] Integrate into `DocumentLab.tsx`
- [ ] Features:
  - [ ] Send demand letters via USPS certified mail from app
  - [ ] Track delivery status
  - [ ] Legal proof of service via certified mail

### 3.10 Tyler Technologies eFile API (Court E-Filing)
- [ ] Research supported state courts at https://www.tylertech.com
- [ ] Apply for API access
- [ ] Create backend function `eFileDocument`
- [ ] Integrate into `EFiling.tsx` (Max's module)
- [ ] Direct court filing from CaseBuddy without external portal

### 3.11 Westlaw / Casetext API (Premium Legal Research)
- [ ] Contact Thomson Reuters for API access: https://legal.thomsonreuters.com/en/products/westlaw
- [ ] Or Casetext/CoCounsel: https://casetext.com
- [ ] Add as premium tier feature (Law Firm Pro plan only)
- [ ] Integrate into Lex's Legal Research Hub

### 3.12 Google Maps / Places API (Courthouse Finder)
- [ ] Add `REACT_APP_GOOGLE_MAPS_KEY` to env
- [ ] Add courthouse/court locator feature
- [ ] Find nearby process servers, court reporters, notaries
- [ ] Integrate into E-Filing and Case Manager

---

## 🟡 PRIORITY 4 — Feature Enhancements

### 4.1 Voice Input Everywhere (Deepgram)
- [ ] Add mic button to Maya's intake chat
- [ ] Add voice input to all AI chat interfaces
- [ ] Real-time transcription as user speaks

### 4.2 PDF Export
- [ ] Install `react-pdf` or `jsPDF`
- [ ] Export intake summaries as PDF
- [ ] Export document analysis reports as PDF
- [ ] Export witness prep questions as printable outline
- [ ] Export case timeline as PDF

### 4.3 Case File System (Supabase)
- [ ] Wire up Supabase properly to store:
  - [ ] Cases (parties, type, jurisdiction, status)
  - [ ] Documents (uploads, analysis results)
  - [ ] Deadlines (court dates, filing windows)
  - [ ] Contacts (witnesses, opposing counsel, judges)
  - [ ] Intake summaries (Maya's output)
- [ ] Link all modules to the active case context
- [ ] Case switcher in the sidebar

### 4.4 White-Label Mode (for Law Firm Sales)
- [ ] Firm name customization (currently in LegalSecretary config — expand platform-wide)
- [ ] Custom color theme per firm
- [ ] Custom domain support
- [ ] Firm logo upload
- [ ] Remove CaseBuddy branding in white-label mode

### 4.5 Mobile PWA Polish
- [ ] Review `sw.js` service worker
- [ ] Offline mode for case notes
- [ ] Push notifications for deadlines (via Twilio/browser)
- [ ] Mobile-optimized layouts for all pages

---

## 🔵 PRIORITY 5 — Growth & Sales

### 5.1 Pricing Page
- [ ] Create `src/pages/Pricing.tsx`
- [ ] Add route `/pricing`
- [ ] Three tiers: Pro Se ($29), Firm Starter ($149), Firm Pro ($399)
- [ ] Feature comparison table
- [ ] Stripe Checkout integration

### 5.2 Onboarding Flow
- [ ] First-time user welcome modal
- [ ] "Start with Maya" CTA on dashboard
- [ ] Interactive product tour improvements (`ProductTour.tsx`)

### 5.3 Analytics
- [ ] Add PostHog or Mixpanel for usage analytics
- [ ] Track: most-used modules, intake completion rate, doc uploads, trial sessions
- [ ] Dashboard for firm admins showing team usage

### 5.4 SEO & Marketing
- [ ] Complete `SeoPages.tsx` — generate SEO landing pages per practice area + state
- [ ] Submit sitemap to Google
- [ ] Add structured data (LegalService schema)

---

## ✅ COMPLETED
- [x] Initial app deployed to Vercel
- [x] 14 pages built and routed
- [x] Base44 backend functions: aiParalegal, analyzeDocument, discoveryMiner, trialCoach
- [x] Supabase connected
- [x] PWA manifest + service worker
- [x] AI Legal Secretary with embed code
- [x] Deepgram API key saved to Superagent

---

## 📋 NOTES
- Backend functions live at: https://superagent-344f8b2b.base44.app/functions/
- Vercel deployment: https://casebuddy-ai-trial-prep.vercel.app
- GitHub repo: https://github.com/patriotnewsactivism/Casebuddy-AI-Trial-Prep
- AI model: Gemini 2.5 Flash (consider upgrading to Pro for law firm tier)
- All API keys should be added to Vercel environment variables, NOT committed to repo
