# AI Law Firm Architecture

**CaseBuddy AI — Your Personal Autonomous AI Law Firm**

This document defines the multi-agent architecture to transform CaseBuddy into a complete, autonomous AI-powered law firm that handles the full lifecycle of your cases — from intake through resolution — while teaching you master-class trial preparation through natural voice interaction.

## Vision

You input a new case (or client matter). The AI Law Firm:

- **Intelligently intakes** the case
- **Autonomously divvies** work across specialized AI agents/departments
- **Executes** the heavy lifting (research, document generation, evidence organization, deadline tracking, demand preparation, etc.)
- **Maintains** complete shared memory and audit trail
- **Surfaces** progress, insights, and teaching moments to you via voice or chat
- **Requires** your approval only on high-stakes actions (final demands, filings, settlements)

Goal: You run your own cases at a professional level with the AI doing 80-90% of the workhorse tasks, while you stay in strategic control and continuously improve your skills through voice masterclasses.

## Core Principles

1. **Autonomy with Oversight** — Agents act proactively but log everything and flag items needing human review.
2. **Shared Case Memory** — Single source of truth for facts, evidence, timeline, strategy, tasks, and history.
3. **Specialized Agents** — Each has a distinct persona, expertise, tools, and system prompt.
4. **Orchestrator / Managing Partner** — Routes tasks, coordinates agents, maintains workflow state.
5. **Voice-First Teaching** — Natural voice interaction for briefings, explanations, strategy discussions, and skill-building.
6. **Auditability** — Every action, decision, and output is logged with reasoning.
7. **Extensibility** — Easy to add new agents or tools.

## High-Level Architecture

```
User (Voice/Chat)
     ↓
[Voice Interface Layer]
     ↓
[Orchestrator / Managing Partner Agent]
     ↓
+---------------------------------------------------+
|                  Shared Case Memory                 |
|  (Facts | Evidence | Timeline | Tasks | Strategy |   |
|   History | Deadlines | Documents | Audit Log)       |
+---------------------------------------------------+
     ↑                        ↓
[Intake Agent]          [Paralegal Team]     [Co-Counsel]     [Senior Partner]
     |                         |                  |                |
     |                         |                  |                |
[Initial Assessment] --> [Research]       --> [Strategy Dev] --> [Final Review]
                         [Evidence Org]     [Drafting]        [Negotiation]
                         [Discovery]        [Witness Prep]    [Risk Assessment]
                         [Deadline Mgmt]    [Objections]      [Settlement]
                         [Document Gen]                       [Teaching]
```

## Agent Definitions

### 1. Intake Specialist Agent
**Persona**: Professional, thorough, empathetic intake paralegal / new client coordinator.
**Responsibilities**:
- Structured intake interview (chat or voice)
- Extract key facts, parties, claims, damages, timeline
- Identify missing information and ask clarifying questions
- Perform initial conflict check (basic)
- Generate initial case summary and strength assessment
- Create initial task list and timeline
- **Auto-delegate** to Orchestrator: "Route to Paralegal Team for evidence organization and research; flag for Co-Counsel strategy review"
**Tools**: Structured form parser, entity extraction, initial risk scorer, task generator
**Output**: Structured Case Intake Report + initial tasks in Shared Memory

### 2. Orchestrator / Managing Partner Agent (The Brain)
**Persona**: Strategic, organized, decisive Managing Partner who runs the firm.
**Responsibilities**:
- Receive intake output
- Analyze case type and complexity
- Create high-level workflow / matter plan
- Route tasks to appropriate specialist agents
- Monitor progress across all agents
- Aggregate results and surface key decisions to user
- Handle escalation and human approval gates
- Maintain overall case health dashboard
**Tools**: Workflow engine (simple state machine or prompt-based planning), task router, progress aggregator, notification system
**Key Capability**: "Divvy things out to the correct departments"

### 3. Paralegal Team (Multi-Agent or Powerful Single Agent)
**Sub-roles / Capabilities**:
- **Research Paralegal**: Legal research, precedent identification, statute of limitations, elements of claims
- **Evidence & Discovery Paralegal**: Evidence timeline, exhibit organization, Bates numbering, discovery request/response tracking, privilege log
- **Document Paralegal**: Draft routine documents (demand letters, discovery responses, status reports)
- **Deadline & Task Paralegal**: Calendar all deadlines, generate task lists with owners/due dates, send reminders
- **Analysis Paralegal**: Document summarization, damage calculations, inconsistency detection

**Shared Tools**: RAG over case documents + external legal knowledge (future), timeline builder, deadline calculator

### 4. Co-Counsel Agent
**Persona**: Sharp, collaborative second-chair attorney. Excellent at developing theory of case, arguments, and anticipating opposition.
**Responsibilities**:
- Develop case theory and themes
- Generate opening/closing arguments, direct/cross outlines
- Prepare deposition questions and witness kits
- Analyze opponent tactics and prepare counters
- Draft motions and supporting memos
- Real-time strategy suggestions during voice practice
- Identify weaknesses and suggest fixes
**Tools**: Argument generator, objection handler, deposition prep engine, strategy simulator

### 5. Senior Partner / Strategist Agent
**Persona**: Wise, experienced senior partner / rainmaker. Big-picture thinker, risk manager, closer.
**Responsibilities**:
- Final review of all major outputs (demands, settlement offers, key filings)
- High-level risk/benefit analysis and recommendation
- Settlement strategy and negotiation simulation
- "Would I take this case?" gut-check + probability assessment
- Teaching moments: Explain why certain strategies work
- Approve or request revisions before user sees final version
- Voice masterclass mode: Teach advanced trial skills, storytelling, cross-examination technique
**Tools**: Risk analyzer, settlement calculator, negotiation simulator, teaching module

### 6. Voice Teaching & Interaction Layer
**Core Capability**: Natural voice conversation with any agent or the full team.
**Features**:
- "Hey Intake, tell me about the new Smith case..."
- "Co-Counsel, walk me through the cross-examination strategy for the expert witness"
- "Partner, give me a masterclass on opening statements for this type of case"
- Real-time interruption handling (like current Trial Simulator)
- Agent can proactively speak up: "Managing Partner here — we have a deadline approaching on the discovery response"
- Teaching mode: Explains reasoning, cites principles, gives examples, quizzes user
**Tech**: Extend existing Gemini Live API integration + role-specific system prompts + context injection from Shared Memory

## Shared Case Memory (Data Model)

Extend `types.ts` with a rich `CaseMemory` structure:

```typescript
interface CaseMemory {
  caseId: string;
  basicInfo: { client, matter, claims, parties, jurisdiction, ... };
  facts: Fact[];
  timeline: TimelineEvent[];
  evidence: EvidenceItem[];
  documents: Document[];
  tasks: Task[];
  deadlines: Deadline[];
  strategy: StrategyNotes;
  arguments: Argument[];
  history: ActionLog[];
  agentOutputs: { [agentName: string]: any };
  auditLog: AuditEntry[];
  status: 'Intake' | 'Active' | 'Discovery' | 'Pre-Trial' | 'Trial' | 'Settled' | 'Closed';
}
```

All agents read from and write to this shared memory (via Supabase or localStorage + sync later).

## Workflow Example: New Case Intake

1. User uploads documents or speaks case summary (voice)
2. **Intake Agent** processes → creates structured CaseMemory + initial assessment
3. **Orchestrator** activates → creates master workflow plan
4. Orchestrator routes:
   - Paralegal Team: "Organize all evidence into timeline + generate discovery plan"
   - Co-Counsel: "Develop initial case theory and identify top 3 arguments"
   - Senior Partner: "Review intake and flag any red flags or settlement value range"
5. Agents work in parallel where possible, updating Shared Memory
6. Orchestrator aggregates and notifies user (voice or dashboard)
7. User can ask any agent for update or teaching via voice

## Autonomy Levels (Configurable)

- **Level 1 (Conservative)**: All outputs require user approval before sending
- **Level 2 (Balanced)**: Routine tasks (research summaries, internal drafts, deadline tracking) autonomous; high-stakes (demands, offers, filings) require approval
- **Level 3 (Autonomous)**: Agents handle most work; user only reviews final package and key decisions

## Implementation Phases

### Phase 1: Foundation (Current Sprint)
- [ ] Create this architecture document
- [ ] Update ROADMAP.md with AI Law Firm vision
- [ ] Extend types.ts with CaseMemory and agent-related types
- [ ] Build basic Intake Agent + simple Orchestrator (prompt-based)
- [ ] Add Shared Memory context injection into existing services
- [ ] Enhance voice layer to support "talk to specific agent"

### Phase 2: Core Agents
- [ ] Full Intake Specialist with structured output + auto-delegation
- [ ] Paralegal Team (evidence org + deadline tracking first)
- [ ] Basic Co-Counsel integration with Strategy Room
- [ ] Senior Partner review gate

### Phase 3: Autonomy & Workflow
- [ ] Workflow state machine in Orchestrator
- [ ] Task routing and progress tracking UI
- [ ] Audit logging
- [ ] Voice proactive notifications

### Phase 4: Advanced Features
- [ ] RAG over case documents + legal knowledge base
- [ ] Real case law integration
- [ ] Settlement & negotiation modules
- [ ] Mock jury + deposition prep as agent tools
- [ ] Full voice masterclass teaching system

### Phase 5: Production & Scale
- [ ] Move Shared Memory to Supabase (with RLS)
- [ ] User auth + multi-case management
- [ ] Secure Edge Functions for all agent calls
- [ ] Billing / usage tracking

## Tech Implementation Notes

- **AI Calls**: Extend `services/geminiService.ts` with role-specific functions (e.g., `callIntakeAgent`, `callOrchestrator`, `callCoCounsel`)
- **Prompt Engineering**: Store agent system prompts in `constants/agents.ts` or similar
- **State Management**: Use React Context + Supabase (future) for CaseMemory
- **Voice**: Build on existing `Trial Simulator` voice infrastructure; add agent persona switching
- **UI**: Add "AI Team" tab or floating voice button to interact with any agent
- **Persistence**: Leverage the recently added localStorage system; plan Supabase migration

## Success Metrics

- User can input a new case and see the AI Law Firm automatically create a plan and begin work
- Agents produce useful, accurate outputs with clear reasoning
- Voice interaction feels natural and educational
- User feels they have a competent "team" handling the workload
- Clear audit trail for every action

## Next Immediate Actions

1. Get user approval on this architecture
2. Create the document in repo
3. Begin Phase 1 implementation (types + Intake Agent stub + Orchestrator)
4. Update existing components to use shared memory where relevant

---

*This architecture is designed to be implemented incrementally while keeping the existing app fully functional.*
