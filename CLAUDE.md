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
| `REACT_APP_SUPABASE_URL` / `REACT_APP_SUPABASE_ANON_KEY` | Optional cloud sync of case files. App runs fine without them (localStorage only). |
| `REACT_APP_GEMINI_API_KEY` | Reserved; AI calls currently go through Base44, not directly to Gemini. |

---

## Architecture — the 30-second tour

```
src/
├── agents/personas.ts      ← THE HEART. All 8 agent identities + system prompts.
├── lib/
│   ├── api.ts              ← thin client for Base44 backend functions (the only AI gateway)
│   ├── caseStore.ts        ← THE SPINE. Shared case file: tasks, deadlines, docs,
│   │                          witnesses, research, activity log. localStorage +
│   │                          useSyncExternalStore. Handoff engine lives here.
│   ├── cloudSync.ts        ← optional Supabase mirror of caseStore (best-effort, silent no-op)
│   ├── leadStore.ts        ← Sierra's captured leads; promoteLead() → case stub
│   └── supabase.ts         ← guarded client (null when env vars absent — handle it)
├── components/
│   ├── AgentHeader.tsx     ← persona banner shown on every module page
│   ├── ActiveCaseBar.tsx   ← case switcher + agent task strip on every module page
│   ├── OnboardingModal.tsx / PwaInstall.tsx
├── pages/                  ← one page per module, routed in App.tsx
└── App.tsx                 ← BrowserRouter, sidebar nav (NAV_SECTIONS), all routes
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

1. **Sierra** chats with a website visitor 24/7. When she has name + contact +
   issue, her reply embeds `<LEAD_CAPTURED>{json}</LEAD_CAPTURED>` →
   `leadStore.addLead()`. One click ("Send to Maya") promotes the lead to a
   case stub via `promoteLead()`.
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
   `logActivity(caseId, agentId, action, detail)` and
   `completeAgentTask(caseId, agentId, route?)`. The Case Detail "war room"
   (`/cases/:id`) shows the live activity feed and stage pipeline.

**When you add or change any agent feature, preserve this loop.** A module
that doesn't read the case context and write back its results breaks the firm.

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
- App state = the two stores (`caseStore`, `leadStore`): module-level cache +
  `localStorage` (`cb_cases`, `cb_active_case`, `cb_leads`, token `cb_token`) +
  `useSyncExternalStore` hooks (`useCases`, `useActiveCase`, `useLeads`).
  Mutate **only** through the exported store functions so listeners fire and
  cloud sync runs. No Redux/Zustand — don't introduce them.
- Supabase sync is **best-effort and silent**: `cloudSync.ts` debounce-pushes
  on every persist and pulls/merges (newer `updatedAt` wins) on startup. It
  must never throw into the UI. Table SQL is in the header of `cloudSync.ts`.

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
- `supabase` export can be **null**; never call it unguarded.
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
