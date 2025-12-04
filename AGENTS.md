# Repository Guidelines

## Project Structure & Module Organization
- `App.tsx` wires routing/layout and navigation; entrypoint is `index.tsx` with global Tailwind setup in `index.html`.
- `components/` holds feature views (Dashboard, CaseManager, WitnessLab, StrategyRoom, Transcriber, DraftingAssistant, Settings, static policies). Keep new pages here and register routes in `App.tsx`.
- `services/geminiService.ts` centralizes Google GenAI calls (JSON schemas, retries, timeouts); keep all model interactions here.
- `utils/` contains shared helpers (`storage` for localStorage, `errorHandler` for toasts/backoff, `fileValidation`); `types.ts` defines domain contracts and `constants.ts` stores mock data/templates.
- Build artifacts live in `dist/`; environment examples in `.env.local.example`; Vite config in `vite.config.ts` exposes env vars.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — start Vite dev server on `0.0.0.0:5000` with hot reload.
- `npm run build` — create production bundle in `dist/`.
- `npm run preview` — serve the built bundle for a local smoke test.
- Environment: create `.env.local` with `GEMINI_API_KEY=...` (available as `process.env.API_KEY` / `process.env.GEMINI_API_KEY` in code) and optional Supabase keys `SUPABASE_URL`, `SUPABASE_ANON_KEY` for cloud persistence.

## Coding Style & Naming Conventions
- TypeScript + React 19 function components; favor hooks and component-level state.
- 2-space indentation, semicolons, named exports when reasonable; PascalCase for components/files, camelCase for functions/props, SCREAMING_SNAKE_CASE for constants/mock sets.
- Styling uses Tailwind classes via CDN; preserve dark slate + gold accent theme and responsive classes.
- Keep data shapes in `types.ts`; share mock/template data through `constants.ts`; centralize fetch/AI logic in `services/`.
- Surface user feedback through `utils/errorHandler` (toast variants) and persist UI data through `utils/storage`.

## Testing Guidelines
- No automated test runner is configured; rely on manual checks during `npm run dev`.
- Exercise core flows after changes: case creation/editing, Witness Lab conversations, Strategy/AI insights, Drafting Assistant uploads/analysis, and Transcriber/file validation.
- If adding tests, prefer Vitest + React Testing Library; mock Gemini responses and reuse `MOCK_CASE_TEMPLATES` for fixtures.

## Commit & Pull Request Guidelines
- Use conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, etc.) and short, imperative summaries.
- Open PRs from feature branches; include a clear description, linked issue/roadmap item, and screenshots for UI changes.
- Run `npm run build` before submitting; ensure no console errors and keep env secrets out of commits.
- Update relevant docs when behavior shifts (README, CLAUDE.md, IMPLEMENTATION_STATUS.md/ROADMAP.md) and verify imports are used/ordered.

## Security & Configuration Tips
- Never commit `.env.local`; rotate `GEMINI_API_KEY` if exposed and confirm Vite `define` exports remain in sync with env naming.
- Handle user files safely via `utils/fileValidation` and prefer client-side checks before invoking Gemini endpoints.
- Supabase: set RLS policies appropriately; anon CRUD is acceptable only for local prototypes. Table `cases` should allow JSON `evidence`/`tasks` columns (see `SUPABASE_SETUP.md`).
