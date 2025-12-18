# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LexSim** is an AI-powered legal trial preparation platform built with React, TypeScript, and Vite. It integrates with Google's Gemini AI to provide:

- Interactive witness examination simulations
- AI-driven trial strategy analysis
- Real-time courtroom practice with live voice interaction
- Legal document analysis and drafting assistance

The app uses Google's Gemini API (including advanced features like thinking models, live API with audio, and structured output) to simulate realistic legal scenarios.

## Development Commands

### Essential Commands
```bash
# Install dependencies
npm install

# Run development server (http://localhost:5000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Setup
- Set `GEMINI_API_KEY` in `.env.local` before running the app
- The Vite config exposes this as `process.env.API_KEY` and `process.env.GEMINI_API_KEY` to the app
- **Optional**: Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` for cloud persistence (falls back to localStorage if not configured)

### Testing
```bash
# Run tests with Vitest
npm test

# Run tests in watch mode
npm test -- --watch
```

## Architecture

### Core Application Structure

**App.tsx** - Main application shell with:
- HashRouter-based routing (required for static deployment)
- Global `AppContext` providing case management state (cases, activeCase, setActiveCase, addCase, updateCase, deleteCase)
- Sidebar navigation with responsive mobile menu
- Layout wrapper for all pages
- Auto-save functionality using localStorage and optional Supabase sync

**Routing:**
- `/` - Landing Page
- `/app` - Dashboard
- `/app/cases` - Case Manager
- `/app/witness-lab` - Witness Lab (text-based witness simulation)
- `/app/practice` - Trial Simulator (live audio-based courtroom practice)
- `/app/strategy` - Strategy Room (AI insights using thinking models)
- `/app/transcriber` - Transcriber
- `/app/docs` - Drafting Assistant
- `/app/settings` - Settings (theme, auto-save, profile, storage management)

### State Management

The app uses React Context (`AppContext`) for global state:
- `cases: Case[]` - All cases in the system
- `activeCase: Case | null` - Currently selected case
- `setActiveCase(c: Case)` - Set active case
- `addCase(c: Case)` - Add new case
- `updateCase(id: string, updates: Partial<Case>)` - Update existing case
- `deleteCase(id: string)` - Delete a case

**Data Persistence:**
- Primary: `localStorage` via `utils/storage.ts` (auto-save enabled by default)
- Optional: Supabase sync via `services/dataService.ts` and `services/supabaseClient.ts`
- Auto-load on app start, auto-save on case changes
- Export/import functionality for data backup (JSON format)

**Important:** `MOCK_CASES` is intentionally empty in `constants.ts`. Real case data should be entered by users. Mock case templates are available in `MOCK_CASE_TEMPLATES` for practice/simulation.

### AI Service Layer (services/geminiService.ts)

All Gemini API interactions are centralized here:

1. **analyzeDocument** - Structured JSON extraction from legal documents (supports text + images)
2. **generateWitnessResponse** - Chat-based witness personality simulation (nervous/hostile/cooperative)
3. **predictStrategy** - Uses `gemini-3-pro-preview` with thinking budget for deep strategic analysis
4. **generateOpponentResponse** - Simulates opposing counsel in arguments
5. **getCoachingTip** - Provides real-time feedback with rhetorical analysis and fallacy detection
6. **getTrialSimSystemInstruction** - Dynamic system instructions generator for multi-phase trial simulation

**Key Models Used:**
- `gemini-2.5-flash` - Fast responses for chat/witness/opponent simulation
- `gemini-3-pro-preview` - Deep reasoning for strategy (with `thinkingConfig`)
- Live API - Audio-based real-time courtroom simulation in ArgumentPractice

### Components

**Dashboard.tsx**
- Overview statistics and charts
- Displays case distribution by status using Recharts

**CaseManager.tsx**
- CRUD operations for cases
- Document upload and AI-powered document analysis
- Evidence timeline integration
- File validation via `utils/fileValidation.ts`

**WitnessLab.tsx**
- Text-based witness cross-examination practice
- Personality-driven witness responses (hostile, nervous, cooperative)
- Uses `MOCK_WITNESSES` from `constants.ts`

**ArgumentPractice.tsx** (Most Complex)
- Live audio-based trial simulation using Gemini Live API
- Supports multiple trial phases: pre-trial-motions, voir-dire, opening-statement, direct-examination, cross-examination, closing-argument, sentencing
- Three difficulty modes: learn, practice, trial
- Real-time objection system with visual alerts
- Uses Web Audio API for microphone input and audio playback
- Function calling integration for objections and coaching tips
- Session recording with transcript storage

**StrategyRoom.tsx**
- AI-powered case strategy analysis
- Uses thinking models for complex legal reasoning
- Opponent profiling and tactical predictions

**Settings.tsx**
- Theme management (dark/light)
- Auto-save toggle
- User profile editing
- Storage usage monitoring with visual progress bar
- Data export/import (JSON)
- Clear all data option

**Additional Components:**
- `SessionHistory.tsx` - View past trial simulator sessions
- `EvidenceTimeline.tsx` - Visual timeline of case events
- `MockJury.tsx` - AI jury simulation feature
- `Transcriber.tsx` - Audio transcription utility
- `DraftingAssistant.tsx` - AI legal document generation
- `ErrorBoundary.tsx` - Error handling wrapper

### Type System (types.ts)

Core types:
- `Case` - Case metadata with winProbability, evidence, tasks
- `CaseStatus` - Enum: PRE_TRIAL, DISCOVERY, TRIAL, APPEAL, CLOSED
- `TrialPhase` - Union type for trial simulation phases
- `SimulationMode` - 'learn' | 'practice' | 'trial'
- `Witness` - Personality-driven witness profiles
- `Message` - Chat message structure
- `CoachingAnalysis` - Structured feedback with fallacy detection
- `OpposingProfile` - Opponent behavioral modeling
- `EvidenceItem` - Evidence metadata with timestamps
- `SessionRecord` - Trial simulator session recordings

## Key Technical Details

### Path Aliases
- `@/*` maps to project root (configured in tsconfig.json and vite.config.ts)

### Styling
- Tailwind CSS with custom color scheme (slate backgrounds, gold accents)
- Custom colors: `text-gold-500`, `bg-slate-950`, `border-slate-800`

### Gemini API Patterns

**Structured Output:**
All AI functions use `responseMimeType: "application/json"` with `responseSchema` for type-safe responses.

**Function Calling (ArgumentPractice only):**
The live API session can call:
- `raiseObjection` - Flash objection on screen
- `sendCoachingTip` - Provide teleprompter text

**Thinking Models:**
Strategy analysis uses `thinkingConfig: { thinkingBudget: 2048 }` for deep reasoning.

**Live API Audio:**
- Input: PCM 16kHz mono audio from microphone
- Output: Base64-encoded PCM audio decoded to AudioBuffer
- Connection managed via `ai.live.connect({ model: 'gemini-live-2.5-flash-preview' })`

### Image/Document Upload
- `fileToGenerativePart` converts File to base64 inline data for Gemini
- Used in document analysis for scanned PDFs/images
- File validation via `utils/fileValidation.ts` (checks size, type, name)

### Directory Structure
```
Casebuddy-AI-Trial-Prep/
├── components/         # React components (Dashboard, CaseManager, etc.)
├── services/           # External service integrations (Gemini, Supabase)
│   ├── geminiService.ts
│   ├── dataService.ts
│   └── supabaseClient.ts
├── utils/              # Utility functions
│   ├── storage.ts      # localStorage operations
│   ├── fileValidation.ts
│   └── errorHandler.ts
├── tests/              # Vitest test files
├── App.tsx             # Main app component
├── types.ts            # TypeScript type definitions
├── constants.ts        # Mock data and templates
└── vite.config.ts      # Build configuration
```

## Common Gotchas

1. **API Key**: Must be set in `.env.local` as `GEMINI_API_KEY`
2. **Routing**: Uses HashRouter (not BrowserRouter) for static hosting compatibility
3. **Empty Mock Data**: `MOCK_CASES` is intentionally empty; use `MOCK_CASE_TEMPLATES` for examples
4. **Live API Audio Format**: Must be 16kHz PCM mono (not standard WebM/MP3)
5. **Data Persistence**: Now uses localStorage by default (auto-save); optionally syncs with Supabase if configured
6. **Storage Limits**: localStorage has 5-10MB limit (browser-dependent); monitor via Settings page
7. **HTTPS Required**: Microphone access in Trial Simulator requires HTTPS in production
