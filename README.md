# ⚖️ CaseBuddy AI — Your AI Law Firm

**Live at [casebuddy.live](https://casebuddy.live)**

CaseBuddy AI is an agentic legal intelligence platform: **8 named AI specialists
that work together like departments in a real law firm**, sharing one case file
so nothing falls through the cracks. Built for attorneys and pro se litigants.

## Meet the Firm

| Agent | Specialty | Module |
|---|---|---|
| 💼 **Sierra** | Legal Secretary — 24/7 lead qualification & capture | `/legal-secretary` |
| ⚖️ **Maya** | Case Intake — interviews clients, opens the case file, briefs every department | `/intake` |
| ⏱️ **Sol** | Deadlines & statutes of limitation — never miss a filing window | `/deadlines` |
| 🔍 **Doc** | Document analysis & discovery mining — finds the smoking guns | `/documents`, `/discovery` |
| 📚 **Lex** | Legal research, precedent, win-probability & conflict checks | `/research`, `/conflict-checker` |
| 🗂️ **Max** | E-filing, court rules, formatting & service of process | `/e-filing` |
| ⚔️ **Rex** | Trial coaching & witness prep — direct, cross, impeachment strategy | `/trial`, `/witnesses` |
| 🎭 **Jules** | Jury simulation — 6 AI jurors, persuasion meters, verdict prediction | `/jury` |

**The agentic loop:** Sierra captures a lead → one click sends it to Maya →
Maya's intake creates the case file and auto-assigns handoff tasks to Sol, Doc,
Lex, Max, Rex & Jules → every agent reads the shared case context and writes
its findings back → the Case Detail war room (`/cases/:id`) shows the whole
firm's activity in real time.

## Tech Stack

- **React 19 + TypeScript** (Create React App), Tailwind CSS, lucide-react
- **AI backend:** Base44 functions (`aiParalegal`, `analyzeDocument`,
  `discoveryMiner`, `trialCoach`) running Gemini 2.5 Flash
- **State:** localStorage case/lead stores with optional **Supabase cloud sync**
- **Deploy:** Vercel (SPA rewrites), PWA-installable with offline service worker

## Development

```bash
npm install
npm start        # http://localhost:3000
npm run build    # production build
```

Copy `.env.example` to `.env` for local configuration. All real keys live in
Vercel environment variables — never commit secrets.

**Contributing or pointing an AI agent at this repo? Read [`CLAUDE.md`](./CLAUDE.md)**
— it documents the architecture, the persona system, the case-file spine, and
the conventions every module follows. The roadmap lives in [`TODO.md`](./TODO.md).

---

*CaseBuddy AI is a legal preparation tool, not a law firm or a substitute for
licensed legal advice.*
