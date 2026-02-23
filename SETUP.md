# CaseBuddy AI Setup Guide

This guide walks you through setting up CaseBuddy AI with Supabase from scratch.

## Prerequisites

- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- **Supabase Account** - [Sign up free](https://supabase.com)
- **API Keys** (for AI features):
  - [Google Gemini API Key](https://makersuite.google.com/app/apikey)
  - [OpenAI API Key](https://platform.openai.com/api-keys) (optional, for GPT-4 and Whisper)
  - [ElevenLabs API Key](https://elevenlabs.io/app/settings/api-keys) (optional, for TTS)

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name**: `casebuddy` (or your preferred name)
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
4. Click **"Create new project"**
5. Wait ~2 minutes for project initialization

---

## Step 2: Get Project Credentials

1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy these values for your `.env.local`:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

---

## Step 3: Run Database Migrations

### Option A: Via Supabase Dashboard (Recommended for beginners)

1. Go to **SQL Editor** in Supabase dashboard
2. Click **"New Query"**
3. Copy and paste each migration file contents in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_additional_tables.sql`
   - `supabase/migrations/004_storage_buckets.sql`
   - `supabase/migrations/005_functions_and_triggers.sql`
4. Click **"Run"** after pasting each file

### Option B: Via Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

---

## Step 4: Deploy Edge Functions

### Via Supabase CLI

```bash
# Navigate to supabase directory
cd supabase

# Deploy all functions
supabase functions deploy gemini-proxy
supabase functions deploy openai-proxy
supabase functions deploy whisper-proxy
supabase functions deploy elevenlabs-proxy
```

### Via Dashboard (Manual)

1. Go to **Edge Functions** in Supabase dashboard
2. Click **"Create Function"**
3. Name it `gemini-proxy`
4. Copy contents from `supabase/functions/gemini-proxy/index.ts`
5. Repeat for other functions

---

## Step 5: Configure API Keys (Secrets)

API keys are stored securely in Supabase and **never exposed to the client**.

### Via Supabase Dashboard

1. Go to **Edge Functions** > **Manage secrets**
2. Add each secret:

| Secret Name | Description | Required |
|------------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `OPENAI_API_KEY` | OpenAI API key | For GPT-4/Whisper |
| `ELEVENLABS_API_KEY` | ElevenLabs API key | For TTS |

### Via CLI

```bash
supabase secrets set GEMINI_API_KEY=your-gemini-key
supabase secrets set OPENAI_API_KEY=your-openai-key
supabase secrets set ELEVENLABS_API_KEY=your-elevenlabs-key
```

---

## Step 6: Configure Authentication

### Enable Email Auth

1. Go to **Authentication** > **Providers**
2. Ensure **Email** is enabled
3. Configure settings:
   - Enable email confirmations (recommended for production)
   - Set secure password requirements

### (Optional) Enable Social Auth

1. In **Authentication** > **Providers**
2. Enable Google, GitHub, etc.
3. Configure OAuth credentials for each provider

---

## Step 7: Local Development Setup

1. Create `.env.local` in the project root:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

2. Install dependencies:

```bash
npm install
```

3. Start development server:

```bash
npm run dev
```

The app runs at `http://localhost:5000`.

---

## Step 8: Production Deployment

### Build the Frontend

```bash
npm run build
```

Output is in the `dist/` directory.

### Deploy Options

#### Option A: Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Add environment variables in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

#### Option B: Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

Add environment variables in Netlify dashboard.

#### Option C: Supabase Hosting

1. Go to **Settings** > **Add-ons** > **Hosting**
2. Connect your GitHub repository
3. Configure build settings:
   - Build command: `npm run build`
   - Output directory: `dist`

---

## Troubleshooting

### CORS Errors

If you see CORS errors, ensure your domain is added to:
- Supabase Dashboard > **Settings** > **API** > **Additional CORS Origins**

### Authentication Issues

- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Check that the anon key is not the service role key
- Ensure cookies/storage are not blocked

### Edge Function Errors

1. Check logs: **Edge Functions** > **Logs**
2. Verify secrets are set correctly
3. Test function directly:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/gemini-proxy \
     -H "Authorization: Bearer your-anon-key" \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Hello"}'
   ```

### Database Connection Issues

- Verify RLS policies are applied
- Check that tables exist in **Table Editor**
- Ensure user has proper permissions

---

## Next Steps

- Configure email templates in **Authentication** > **Email Templates**
- Set up database backups in **Settings** > **Database** > **Backups**
- Review security settings in [SECURITY.md](./SECURITY.md)
- Understand the architecture in [ARCHITECTURE.md](./ARCHITECTURE.md)
