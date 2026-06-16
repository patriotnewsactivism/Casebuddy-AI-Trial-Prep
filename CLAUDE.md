# CLAUDE.md — CaseBuddy AI

> **What this is:** CaseBuddy AI is an *agentic AI law firm* — 8 named AI specialists
> (Maya, Lex, Doc, Rex, Sol, Sierra, Jules, Max) that share one case file and hand
> work to each other like departments in a real firm. Built for attorneys and pro se
> litigants. Live at **https://casebuddy.live**.

---

## Commands

```bash
npm start          # dev server on http://localhost:3000
npm run build      # production build → build/  (CRA / react-scripts 5)
npm test           # jest watch mode (CI=true npm test -- --watchAll=false for one-shot)
```

- **Create React App** (not Vite/Next). TypeScript `strict: true`, TS 4.9.
- **CI builds treat ESLint warnings as errors** (`CI=true` on Vercel). Keep the
  code warning-free: no unused imports/vars, exhaustive hook deps or an
  explicit disable comment.
- Deploys to **Vercel** (`vercel.json`: SPA rewrite of all routes → `index.html`).
  Production domain: `casebuddy.live`. Pushing `main` triggers a production
  deploy; other branches get preview URLs.

## Environment variables (Vercel → Project Settings → Environment Variables)

CRA only exposes vars prefixed `REACT_APP_`, and they are **baked in at build
time** — changing one requires a redeploy. Never commit real keys (see
`.env.example` for the shape).

| Var | Purpose |
|---|---|
| `REACT_APP_BASE44_API_URL` | Backend functions host (default `https://superagent-344f8b2b.base44.app`) |
| `REACT_APP_SUPABASE_URL` / `REACT_APP_SUPABASE_ANON_KEY` | **Required for production.** Powers both Supabase Auth (firm login — see "Authentication & security" below) and cloud sync of case files. Without them the app **fails closed**: `/login` shows an "authentication not configured" notice and the whole `<AppShell>` stays locked, it does not fall back to open access. |
| `REACT_APP_GEMINI_API_KEY` | Reserved; AI calls currently go through Base44, not directly to Gemini. |

---

## Architecture — the 30-second tour

```
src/
├── agents/personas.ts      ← THE HEART. All 8 agent identities + system prompts.
├── lib/
│   ├── api.ts              ← Base44 backend client (the only AI gateway). 60s timeout;
│   │                          failures return { reply: friendlyError, serviceError } —
│   │                          agents never go silent, so don't re-wrap errors in pages.
│   ├── supabaseClient.ts   ← the ONE Supabase client instance — auth, caseStore, and
│   │                          anything else touching Supabase import this, never call
│   │                          createClient() again (one auth session for the app).
│   ├── authStore.ts        ← firm login (Supabase Auth): useAuth(), signIn/signUp/
│   │                          signOut/resetPassword/updatePassword, authConfigured.
│   ├── caseStore.ts        ← THE SPINE. Shared case file: tasks, deadlines, docs,
│   │                          witnesses, research, activity log, factLog. localStorage +
│   │                          useSyncExternalStore. Also home to: the handoff engine,
│   │                          built-in Supabase cloud sync (initCloudSync/schedulePush —
│   │                          only pulled once a session exists, see App.tsx),
│   │                          the <CASE_UPDATE> living-case-brain (CASE_UPDATE_DIRECTIVE,
│   │                          ingestAgentReply, applyCaseUpdate), and ROI tracking
│   │                          (minutesSaved on activity → firmMinutesSaved).
│   └── leadStore.ts        ← Sierra's captured leads; promoteLead() → case stub
├── hooks/useLiveVoice.ts   ← hands-free voice engine (Web Speech; Deepgram nova-2 +
│                              Aura TTS when REACT_APP_DEEPGRAM_API_KEY is set)
├── components/
│   ├── AgentHeader.tsx     ← persona banner shown on every module page
│   ├── ActiveCaseBar.tsx   ← case switcher + agent task strip on every module page
│   ├── CaseAssistant.tsx   ← floating firm-wide voice assistant (rendered in AppShell)
│   ├── OnboardingModal.tsx / PwaInstall.tsx
├── pages/                  ← one page per module, routed in App.tsx
│   ├── Landing.tsx         ← public marketing page at /  (full-bleed, no sidebar)
│   ├── Login.tsx           ← firm sign-in/sign-up/reset at /login (full-bleed, no sidebar)
│   └── PublicIntake.tsx    ← shareable client intake at /start → case lands in the firm
└── App.tsx                 ← routes: /, /start, /login are public; everything else sits
                               behind <RequireAuth> → <AppShell> (sidebar, /dashboard)
```

There is **no app server in this repo**. All AI calls go through
`src/lib/api.ts` → POST `${BASE_URL}/functions/<name>` on Base44
(`aiParalegal`, `analyzeDocument`, `discoveryMiner`, `trialCoach`). The model
behind them is Gemini 2.5 Flash. Personas are injected **client-side** by
prepending `agent.systemPrompt` to the prompt/payload.

## The firm — 8 agents, one case file

| Agent | Role | Route | Accent | Backend fn |
|---|---|---|---|---|
| **Maya** | Case Intake Specialist | `/intake` | violet | `aiParalegal` |
| **Lex** | Legal Research Analyst | `/research`, `/conflict-checker` | indigo | `aiParalegal` |
| **Doc** | Document Analyst | `/documents`, `/discovery` | blue | `analyzeDocument`, `discoveryMiner` |
| **Rex** | Trial Coach | `/trial`, `/witnesses` | orange | `trialCoach` |
| **Sol** | Deadline & SOL Tracker | `/deadlines` | yellow | `aiParalegal` |
| **Sierra** | Legal Secretary (lead gen) | `/legal-secretary` | cyan | `aiParalegal` |
| **Jules** | Jury Consultant | `/jury` | pink | `trialCoach` |
| **Max** | E-Filing & Records | `/e-filing` | slate | `aiParalegal` |

All identity lives in `src/agents/personas.ts` (`AGENTS`, `AGENT_LIST`,
`getAgent()`). **Never hardcode an agent's name, color, or prompt in a page** —
import the persona.

### The agentic loop (what makes this a "firm", not a toolbox)

1. Clients arrive two ways: **Sierra** chats with website visitors 24/7 —
   when she has name + contact + issue, her reply embeds
   `<LEAD_CAPTURED>{json}</LEAD_CAPTURED>` → `leadStore.addLead()`, and one
   click ("Send to Maya") promotes the lead to a case stub via `promoteLead()`.
   Or the firm shares the **public intake link `/start`**, where the client
   talks to Maya directly and the finished case lands in the firm's case list
   (source `'client-link'`, synced via Supabase).
2. **Maya** runs the intake interview. Her final reply embeds
   `<INTAKE_SUMMARY>{json}</INTAKE_SUMMARY>` → `createCaseFromIntake()` builds
   the case file **and auto-generates handoff tasks for every department**
   (`generateHandoffTasks` in caseStore: conflict check, SOL calendaring,
   document analysis, research, court requirements, witness prep, jury
   stress-test).
3. Every module page renders `<ActiveCaseBar agentId="..."/>` and injects
   `buildCaseContext(activeCase)` into its AI prompts — so **every agent
   already knows the whole case** (parties, claims, SOL flags, other agents'
   findings).
4. When an agent finishes work it **writes back**: `addCaseDeadline` /
   `addCaseDocument` / `addCaseWitness` / `addResearchNote`, plus
   `logActivity(caseId, agentId, action, detail, minutesSaved?)` (the
   minutes feed the ROI counters on Dashboard/Case Detail) and
   `completeAgentTask(caseId, agentId, route?)`. The Case Detail "war room"
   (`/cases/:id`) shows the live activity feed and stage pipeline.
5. **The case file is alive.** Conversational agents append
   `CASE_UPDATE_DIRECTIVE` to their prompts; whenever a chat reveals new
   facts/parties/claims/deadlines the model emits a `<CASE_UPDATE>{json}`
   block. Pass every reply through
   `ingestAgentReply(caseId, agentId, reply)` — it applies the update to the
   case (deduped `factLog`) and returns the reply with the block stripped for
   display.

**When you add or change any agent feature, preserve this loop.** A module
that doesn't read the case context and write back its results breaks the firm.

## Authentication & security

The case file holds privileged, confidential client data — it must never be
reachable by an unauthenticated stranger. The security model:

- **Login is Supabase Auth** (email/password). `src/lib/authStore.ts` wraps
  `supabase.auth` in the same `useSyncExternalStore` pattern as the other
  stores. `RequireAuth` in `App.tsx` wraps the entire `<AppShell>` route —
  every module (`/dashboard`, `/cases`, `/documents`, …) requires a session.
- **It's a shared firm login, not per-seat multi-tenancy.** Every signed-in
  user at the firm sees the same case pool (matches "8 agents share one case
  file"). This is account security — keeping the case file out of strangers'
  hands — not data isolation between individual attorneys.
- **Fails closed.** If `REACT_APP_SUPABASE_URL`/`REACT_APP_SUPABASE_ANON_KEY`
  aren't set, `authConfigured` is `false` and `/login` shows an admin-facing
  "not configured" notice instead of ever falling back to open access.
  Never change this to fail open.
- **`/` and `/start` stay public on purpose** — `/` is the marketing page and
  `/start` is the client intake link (clients aren't firm users and must
  never need an account). The anonymous Supabase `anon` role is restricted at
  the database level (RLS) to INSERT-only on rows shaped like a client-link
  intake; it cannot read or modify any existing case. See "Supabase setup"
  below for the exact policies — **do not loosen them** to make `/start`'s
  write path "simpler."
- Changing a password or signing out lives in `Settings.tsx` → **Account &
  Security** tab, backed by `updatePassword`/`signOut` from `authStore.ts`.

## Conventions (follow these exactly)

### Structured output from the LLM
The backend returns free text in `res.reply` (note: `aiParalegal` in
LegalSecretary uses `res.response || res.message` — legacy payload shape with
`{message, context, history}` instead of `{messages, agentPersona}`; keep each
page's existing shape). To get JSON out of a reply:

- **Tag pattern** for conversational flows: instruct the model to wrap JSON in
  a named tag (`<INTAKE_SUMMARY>`, `<LEAD_CAPTURED>`), parse with a regex,
  `strip…()` it before rendering the chat bubble.
- **JSON-only pattern** for one-shot tools: prompt ends with
  `Respond with valid JSON only: { ...schema }`, then
  `reply.match(/\{[\s\S]*\}/)` + `JSON.parse` inside try/catch, **always with a
  graceful fallback** that shows the raw text instead of crashing (see
  WitnessPrep/JurySimulator).

### UI / styling
- Dark theme only: page bg `bg-slate-950`, cards `bg-slate-800` +
  `border-slate-700` + `rounded-xl`/`rounded-2xl`, body text `text-slate-300/400`.
- Each module is tinted with its agent's accent (buttons use the agent's
  gradient `bg-gradient-to-r from-X to-Y`, focus rings `focus:border-<accent>-500`).
- Icons: `lucide-react` only. Loading: `<Loader2 className="animate-spin"/>`
  with an agent-voiced message ("Rex is preparing your examination strategy…").
- Page skeleton: title block → `<AgentHeader agent={x} subtitle="(first-person, in character)"/>`
  → `<ActiveCaseBar agentId="x"/>` → 1/3 input column + 2/3 results column grid.
- Empty states: big emoji, bold one-liner, supportive sub-text (never blank panels).

### State
- App state = the stores (`caseStore`, `leadStore`, `authStore`, `firmStore`):
  module-level cache + `localStorage` (`cb_cases`, `cb_active_case`, `cb_leads`)
  + `useSyncExternalStore` hooks (`useCases`, `useActiveCase`, `useLeads`,
  `useAuth`, `useFirm`).
  Mutate **only** through the exported store functions so listeners fire and
  cloud sync runs. No Redux/Zustand — don't introduce them.
- Supabase sync is **built into caseStore and best-effort/silent**: dirty case
  ids are debounce-pushed to the `case_files` table on every persist, and
  `initCloudSync()` (called from `RequireAuth` once a session exists, not on
  every page load) pulls + merges on startup (newer `updatedAt` wins). It must
  never throw into the UI; without env keys it's a no-op.

  **Supabase setup (run once in the Supabase SQL editor) — do this exactly,
  do not use permissive "anon read/write" or "disable RLS" shortcuts, that
  was the old setup and it leaked every firm's case data to anyone holding
  the public anon key:**
  ```sql
  create table case_files (id text primary key, data jsonb, updated_at timestamptz);
  alter table case_files enable row level security;

  -- Signed-in firm members (any authenticated user) can read/write the shared case pool.
  create policy "Firm members read cases" on case_files for select to authenticated using (true);
  create policy "Firm members insert cases" on case_files for insert to authenticated with check (true);
  create policy "Firm members update cases" on case_files for update to authenticated using (true);
  create policy "Firm members delete cases" on case_files for delete to authenticated using (true);

  -- Anonymous /start visitors may ONLY create a new client-intake case — never read or modify existing rows.
  create policy "Public intake can create client cases" on case_files
    for insert to anon with check (data->>'source' = 'client-link');
  ```
  Also enable **Email** auth under Supabase → Authentication → Providers (on
  by default), and add your production URL to Authentication → URL
  Configuration → Redirect URLs so password-reset links work.

### Adding a new agent module (checklist)
1. Add the persona to `AGENTS` in `src/agents/personas.ts` (unique accent color, first-person `systemPrompt` with numbered duties).
2. Create `src/pages/YourModule.tsx` following the page skeleton above.
3. Route it in `App.tsx` **and** add it to `NAV_SECTIONS` (label format `Module — Agent`) and `AGENT_COLORS`.
4. Inject `buildCaseContext(activeCase)` into prompts; write back with `logActivity` + `completeAgentTask` (+ the relevant `addCase*`).
5. If Maya should brief the new department at intake, add a task to `generateHandoffTasks()` in `caseStore.ts`.
6. Add the agent to the Dashboard "Meet the Team" grid if it isn't driven by `AGENT_LIST`.

## Gotchas

- `react-scripts test` exists but there's effectively no test suite beyond the
  CRA default — **verify changes with `npm run build`** (it typechecks and
  lints) before pushing.
- The `supabase` export from `lib/supabaseClient.ts` can be **null**; never
  call it unguarded — check `supabaseConfigured`/`authConfigured` first.
- `localStorage.getItem('cb_token')` in `api.ts` is legacy/unrelated to
  `authStore.ts` — it's a Base44 hint, never set by anything, and has nothing
  to do with firm login. Don't confuse the two.
- `WitnessPrep`/`JurySimulator` call `trialCoach` but pass the *persona prompt
  inside the user message* — the `config.role` field is a legacy backend hint.
  Keep both.
- PDF "export" is print-to-PDF: build a styled HTML string, `Blob` →
  `window.open` → `win.print()` (see `exportPrepPackage` in WitnessPrep).
  Don't add jsPDF for new exports unless asked.
- Service worker (`public/sw.js`) caches aggressively; bump its cache name if
  you change cached asset behavior.
- `TODO.md` is the living roadmap (priorities, API integrations awaiting
  keys, pricing). Update its checkboxes when you complete items.

## Legal-domain guardrails

- Every AI output is **trial preparation assistance, not legal advice** — keep
  existing disclaimers (e.g. exported document footers) intact and add one to
  any new client-facing artifact.
- Never fabricate citations in UI copy or prompts; Lex's prompt asks for cited
  authority, and anything surfaced as "real case law" must come from a real
  source (CourtListener integration is the planned path — TODO 3.1).
- Confidentiality framing matters: intake copy promises client data stays in
  the case file. Don't send case data to new third-party services without an
  explicit opt-in.
