#!/usr/bin/env node
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof COLORS = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function prompt(rl: readline.ReadLine, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function loadEnvFile(): Promise<Record<string, string>> {
  const envPath = path.join(process.cwd(), '.env.local');
  const env: Record<string, string> = {};

  if (!fs.existsSync(envPath)) {
    return env;
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  }

  return env;
}

async function testConnection(url: string, key: string): Promise<{ success: boolean; latency?: number; error?: string }> {
  const startTime = Date.now();
  try {
    const response = await fetch(`${url}/rest/v1/cases?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      return { success: true, latency };
    }

    const errorText = await response.text();
    if (response.status === 401) {
      return { success: false, error: 'Invalid API key' };
    }
    if (errorText.includes('relation') || errorText.includes('does not exist')) {
      return { success: true, latency, error: 'Tables not created yet' };
    }
    return { success: false, error: `HTTP ${response.status}: ${errorText.slice(0, 100)}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

function getSqlEditorUrl(projectUrl: string): string {
  const match = projectUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/);
  if (match) {
    return `https://supabase.com/dashboard/project/${match[1]}/sql/new`;
  }
  return 'https://supabase.com/dashboard';
}

function getMinimalSql(): string {
  return `-- Minimal Casebuddy Setup
-- Run this in Supabase SQL Editor

-- Cases table
CREATE TABLE IF NOT EXISTS public.cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pre-Trial',
  opposing_counsel TEXT DEFAULT '',
  judge TEXT DEFAULT '',
  next_court_date TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  win_probability NUMERIC(5,2) DEFAULT 0.00,
  tags JSONB DEFAULT '[]'::jsonb,
  evidence JSONB DEFAULT '[]'::jsonb,
  tasks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Permissive policies (prototype mode)
CREATE POLICY "anon_full_access" ON public.cases FOR ALL USING (true);

-- Permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`;
}

async function main() {
  console.log('\n' + '═'.repeat(50));
  log('  CASEBUDDY SUPABASE SETUP', 'bold');
  console.log('═'.repeat(50) + '\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // Step 1: Load environment
    log('Step 1: Checking environment...', 'cyan');
    const env = await loadEnvFile();

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseAnonKey = env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      log('  ✗ SUPABASE_URL not found in .env.local', 'red');
      log('\n  Please add to .env.local:', 'yellow');
      log('    SUPABASE_URL=https://your-project.supabase.co');
      log('    SUPABASE_ANON_KEY=your_anon_key\n');
      rl.close();
      return;
    }

    log(`  ✓ Found SUPABASE_URL: ${supabaseUrl}`, 'green');

    if (!supabaseAnonKey) {
      log('  ✗ SUPABASE_ANON_KEY not found', 'red');
      rl.close();
      return;
    }
    log('  ✓ Found SUPABASE_ANON_KEY', 'green');

    // Step 2: Test connection
    console.log('\n' + '─'.repeat(50));
    log('Step 2: Testing connection...', 'cyan');

    const result = await testConnection(supabaseUrl, supabaseAnonKey);

    if (result.success) {
      if (result.latency) {
        log(`  ✓ Connected successfully (${result.latency}ms)`, 'green');
      }
      if (result.error) {
        log(`  ⚠ ${result.error}`, 'yellow');
      }
    } else {
      log(`  ✗ Connection failed: ${result.error}`, 'red');
      rl.close();
      return;
    }

    // Step 3: Check tables
    console.log('\n' + '─'.repeat(50));
    log('Step 3: Checking database tables...', 'cyan');

    try {
      const tableCheck = await fetch(`${supabaseUrl}/rest/v1/cases?select=id&limit=1`, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
      });

      if (tableCheck.ok) {
        log('  ✓ Tables exist and are accessible', 'green');
        log('\n  Your Supabase setup is complete!', 'green');
        rl.close();
        return;
      }

      if (tableCheck.status === 404 || (await tableCheck.text()).includes('relation')) {
        log('  ⚠ Tables not found - setup required', 'yellow');
      }
    } catch {
      log('  ⚠ Could not verify tables', 'yellow');
    }

    // Step 4: Provide instructions
    console.log('\n' + '─'.repeat(50));
    log('Step 4: Setup Instructions', 'cyan');

    const sqlEditorUrl = getSqlEditorUrl(supabaseUrl);

    console.log('\n  To complete setup, run the SQL in Supabase:\n');
    log('  1. Open SQL Editor:', 'yellow');
    console.log(`     ${sqlEditorUrl}\n`);
    log('  2. Copy and paste the SQL below', 'yellow');
    log('  3. Click Run (or press Ctrl+Enter)\n');

    console.log('─'.repeat(50));
    log('SQL TO RUN:', 'bold');
    console.log('─'.repeat(50));
    console.log(getMinimalSql());
    console.log('─'.repeat(50) + '\n');

    // Show URL
    log('\n  Open this URL in your browser:', 'yellow');
    console.log(`  ${sqlEditorUrl}`);

    // Option to save SQL
    const saveFile = await prompt(rl, '\nSave SQL to scripts/minimal-setup.sql? (y/n): ');
    if (saveFile.toLowerCase() === 'y' || saveFile.toLowerCase() === 'yes') {
      const scriptsDir = path.join(process.cwd(), 'scripts');
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(scriptsDir, 'minimal-setup.sql'), getMinimalSql());
      log('  ✓ Saved to scripts/minimal-setup.sql', 'green');
    }

    console.log('\n' + '═'.repeat(50));
    log('  Setup script complete!', 'green');
    log('  After running SQL, restart your dev server', 'dim');
    console.log('═'.repeat(50) + '\n');

  } catch (error) {
    log(`\n  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
  } finally {
    rl.close();
  }
}

main();
