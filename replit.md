# CaseBuddy: AI-Powered Legal Trial Preparation

## Overview
CaseBuddy is an AI-powered legal trial preparation application built with React, TypeScript, and Vite. It provides lawyers with tools for case management, witness simulation, argument practice, strategy analysis, and legal document transcription using Google's Gemini AI.

## Live Domains
- **Main Application**: casebuddy.live
- **Transcription Service**: transcribe.casebuddy.live (external repository)

## Project Architecture

### Tech Stack
- **Frontend Framework**: React 19.2.0 with TypeScript
- **Build Tool**: Vite 6.2.0
- **UI Styling**: Tailwind CSS (CDN)
- **Routing**: React Router DOM
- **AI Integration**: Google Gemini AI (@google/genai)
- **Charts**: Recharts
- **Notifications**: React Toastify
- **Icons**: Lucide React

### Directory Structure
```
.
├── components/          # React components for each feature
│   ├── Dashboard.tsx
│   ├── CaseManager.tsx
│   ├── WitnessLab.tsx
│   ├── StrategyRoom.tsx
│   ├── ArgumentPractice.tsx
│   ├── Transcriber.tsx
│   └── ...
├── services/           # API and external service integrations
│   └── geminiService.ts
├── utils/              # Utility functions
│   ├── errorHandler.ts
│   ├── fileValidation.ts
│   └── storage.ts
├── App.tsx             # Main app component with routing
├── index.tsx           # App entry point
├── types.ts            # TypeScript type definitions
├── constants.ts        # App constants
├── vite.config.ts      # Vite configuration
└── index.html          # HTML template
```

## Development Setup

### Prerequisites
- Node.js (v18 or higher)
- Google Gemini API key

### Environment Variables
- `GEMINI_API_KEY`: Google Gemini API key (stored in Replit secrets)

### Running Locally
1. Dependencies are automatically installed via npm
2. The app runs on port 5000 (configured for Replit webview)
3. Development server: `npm run dev`
4. Build for production: `npm run build`

## Replit Configuration

### Workflow
- **Name**: Start application
- **Command**: `npm run dev`
- **Port**: 5000
- **Output Type**: Webview (for frontend preview)

### Deployment
- **Type**: Static site
- **Build Command**: `npm run build`
- **Public Directory**: `dist`

### Important Replit Settings
The Vite config is set up to work with Replit's proxy:
- Host: `0.0.0.0` (required for Replit)
- Port: `5000` (required for webview output)
- `allowedHosts: true` (required for Replit iframe proxy)

## Features

### Core Modules
1. **Dashboard**: Overview of active cases and trial readiness
2. **Case Files**: Manage legal cases and documents
3. **Trial Simulator**: Practice oral arguments with AI opponent
4. **Witness Lab**: Simulate witness examinations
5. **Strategy & AI**: AI-powered case strategy insights
6. **Transcriber**: Audio/document transcription and analysis
7. **Drafting Assistant**: Legal document generation

### AI Capabilities
- Document analysis and summarization
- Witness personality simulation (hostile, nervous, cooperative)
- Opposing counsel simulation
- Strategic predictions using Gemini's thinking model
- Real-time coaching and feedback
- Trial phase simulation (voir dire, opening/closing, cross-examination)

## Recent Changes (December 4, 2025)
- Configured Vite to run on port 5000 with `allowedHosts: true` for Replit compatibility
- Set up GEMINI_API_KEY as environment variable in Replit
- Installed all project dependencies
- Fixed TypeScript errors (added aria-label to ToastContainer)
- Created missing index.css file
- Configured static deployment with dist as public directory
- Set up workflow for development server with webview output

## User Preferences
- None specified yet

## Notes
- The app uses HashRouter for client-side routing
- Tailwind CSS is loaded via CDN for development (should consider PostCSS for production)
- API key is secured in Replit environment variables, not committed to git
- The .gitignore properly excludes .env.local files
