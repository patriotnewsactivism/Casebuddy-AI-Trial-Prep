# CaseBuddy AI — Master TODO & Roadmap
> Last updated: 2026-06-16 | Managed by Superagent
> Engineering guide for AI agents & contributors: see `CLAUDE.md`

---

## 🔴 CRITICAL — Authentication & Data Security ✅ Done 2026-06-16
> The app had **no login at all** — `cb_token` was read but never set, and the
> documented Supabase setup ("anon read/write policies, or disable RLS") meant
> every firm's privileged case data was publicly readable/writable by anyone
> holding the public anon key. Fixed:
- [x] Supabase Auth (email/password) — `src/lib/authStore.ts`, single shared client `src/lib/supabaseClient.ts`
- [x] `/login` page (sign in / sign up / forgot password) — `src/pages/Login.tsx`
- [x] `RequireAuth` gate wraps the entire authenticated app shell in `App.tsx`; fails **closed** if Supabase env vars are missing (no silent open-access fallback)
- [x] `/` and `/start` (client intake) remain public by design — clients never need an account
- [x] Locked-down RLS policies for `case_files`: authenticated firm members read/write the shared pool; anonymous `/start` visitors may only INSERT new client-intake rows, never read or modify existing cases (exact SQL in `CLAUDE.md` → "Supabase setup")
- [x] Sign out + change password — Settings → Account & Security tab
- [ ] Recommended next: require email confirmation in Supabase dashboard (Authentication → Providers → Email) if not already on; consider 2FA for firm-admin accounts; add an audit log of who signed in/out and from where

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
| **Maya** | Case Intake | `IntakePage.tsx` | ✅ Live |
| **Lex** | Legal Research Hub | `LegalResearchHub.tsx` | ✅ Live |
| **Doc** | Document Lab + Discovery | `DocumentLab.tsx`, `DiscoveryMiner.tsx` | ✅ Live |
| **Rex** | Trial Coach + Witness Prep | `TrialCenter.tsx`, `WitnessPrep.tsx` | ✅ Live |
| **Sol** | Deadlines & SOL Tracker | `DeadlinesAndSol.tsx` | ✅ Live |
| **Sierra** | Legal Secretary | `LegalSecretary.tsx` | ✅ Live + lead capture |
| **Jules** | Jury Simulator | `JurySimulator.tsx` | ✅ Live |
| **Max** | E-Filing & Records | `EFiling.tsx` | ✅ Live |

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
- [x] Features:
  - [x] Input witness name, role, relationship to case
  - [x] AI generates direct examination questions
  - [x] AI generates cross-examination questions
  - [x] Impeachment strategy + credibility assessment (vulnerabilities, danger zones, opening gambit, closing question)
  - [x] Export questions as printable outline (print-to-PDF prep package)
  - [x] Multi-witness roster with per-witness saved prep packages

### 2.2 Jury Simulator Page (`/jury`) — Agent: Jules
- [x] Create `src/pages/JurySimulator.tsx`
- [x] Add route in `App.tsx`
- [x] Add to sidebar nav under "Trial Prep"
- [x] Features:
  - [x] 6 AI jurors with distinct personalities (skeptic, empath, analytical, emotional, plaintiff/defense/neutral leans)
  - [x] Present opening statement → get per-juror reactions
  - [x] Persuasion meter per juror (0–100)
  - [x] Juror deliberation simulation (dramatized jury-room scene)
  - [x] Verdict probability tracker (predicted verdict banner + plaintiff % meter)
  - [x] Closing argument feedback (modes: opening / evidence / closing / rebuttal)

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
- [x] Mic button on Maya's intake chat (browser Web Speech API; Deepgram upgrade pending)
- [ ] Voice input on all AI chat interfaces
- [x] Real-time transcription as user speaks (on intake — interim results stream into the input)

### 4.2 PDF Export
- [x] Witness prep packages export as printable PDF (styled HTML → print dialog, no heavy deps)
- [ ] Export intake summaries, document analysis, case timelines (reuse the WitnessPrep print pattern)

### 4.3 Case File System ✅ (localStorage + Supabase cloud sync)
- [x] Central case store (`src/lib/caseStore.ts`) — cases, deadlines, documents, witnesses, research, activity log
- [x] Maya's intake creates the case file & auto-briefs every department (Sol, Doc, Lex, Max, Rex, Jules) with handoff tasks
- [x] Link all modules to active case context (`<ActiveCaseBar />` + `buildCaseContext()` injected into AI calls)
- [x] Case switcher on every module page
- [x] Case Manager list + Case Detail "war room" (`/cases`, `/cases/:id`) with stage pipeline & firm activity feed
- [x] Conflict checker cross-references new parties against all existing case files
- [x] Sync case store to Supabase (localStorage + cloud merge; requires firm login — see "Authentication & Data Security" above for the table + locked-down RLS policies, run once in the Supabase SQL editor)
- [x] Public client intake link at `/start` — clients talk to Maya, case lands in the firm
- [x] Living case file: agents emit <CASE_UPDATE> blocks, merged into factLog/parties/claims/deadlines
- [x] Firm-wide floating voice assistant (CaseAssistant) on every app page
- [x] Billable-hours-saved tracking per agent action (ROI on Dashboard & Case Detail)
- [x] Sierra's qualified leads auto-create intake-ready case stubs (`src/lib/leadStore.ts` — Sierra emits `<LEAD_CAPTURED>` in chat, "Send to Maya →" promotes lead to a case file & briefs all departments)

### 4.4 White-Label Mode (Law Firm Sales)
- [x] Platform-wide firm name + color theme customization (`src/lib/firmStore.ts` + Settings → Firm Branding tab)
- [ ] Custom domain support
- [ ] Firm logo upload (currently logo-by-URL, not a file upload widget)
- [x] Remove CaseBuddy branding in white-label mode (sidebar, public intake page, Sierra's widget defaults)

### 4.5 Mobile PWA Polish
- [ ] Offline mode for case notes
- [ ] Push notifications for deadlines
- [ ] Mobile-optimized layouts for all pages

---

## 🔵 PRIORITY 5 — Growth & Sales

### 5.1 Pricing Page
- [x] Create `src/pages/Pricing.tsx` at route `/pricing` (single plan $499/mo, 2-week free trial)
- [ ] Stripe Checkout integration (blocked on Stripe account — see 3.3)

### 5.2 Onboarding Flow
- [x] First-time user welcome modal (`OnboardingModal.tsx`)
- [x] Guided product tour (`/video-tour`)
- [ ] "Start with Maya" CTA on dashboard

### 5.3 Analytics
- [x] Add PostHog or Mixpanel (`src/lib/analytics.ts`, no-ops without `REACT_APP_POSTHOG_KEY`)
- [x] Track: most-used modules, intake completion rate, doc uploads, trial sessions (`page_view`, `intake_started`/`intake_completed`, `agent_action`, `trial_session_started`, `lead_captured`/`lead_promoted`, `case_stage_changed`)
- [ ] Admin dashboard for firm usage stats (use PostHog's own dashboards for now)

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
- Live app: https://casebuddy.live (Vercel project: casebuddy-ai-trial-prep)
- GitHub: https://github.com/patriotnewsactivism/Casebuddy-AI-Trial-Prep
- AI model: Gemini 2.5 Flash (upgrade to Pro for Law Firm tier)
- All API keys → Vercel environment variables only, never commit to repo
- Architecture & conventions for contributors/AI agents: `CLAUDE.md`
