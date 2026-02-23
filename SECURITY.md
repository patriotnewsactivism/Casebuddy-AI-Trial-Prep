# Security Architecture

This document explains the security model implemented in CaseBuddy AI.

## Overview

CaseBuddy AI implements a **defense-in-depth** security approach with multiple layers of protection:

1. **Server-side API key storage** - Keys never reach the client
2. **Row Level Security (RLS)** - Database-level access control
3. **Authentication** - Supabase Auth with JWT tokens
4. **Rate limiting** - Per-user request throttling
5. **Input validation** - Request sanitization at multiple levels

---

## API Key Security

### The Problem

In client-side applications, embedding API keys in the frontend bundle exposes them to anyone who inspects the browser's DevTools. This leads to:
- API key theft and quota abuse
- Unexpected billing charges
- Potential data breaches

### Our Solution

All API keys are stored as **Supabase secrets** and only accessed by Edge Functions running on the server:

```
┌─────────────┐      ┌────────────────────┐      ┌─────────────────┐
│   Browser   │─────▶│   Edge Function    │─────▶│   Gemini API    │
│  (no keys)  │      │ (reads secret key) │      │                 │
└─────────────┘      └────────────────────┘      └─────────────────┘
```

**Benefits:**
- API keys are never transmitted to the client
- Keys can be rotated without code changes
- Usage is logged and monitorable
- Per-user rate limiting is enforced

---

## Row Level Security (RLS)

RLS policies enforce data isolation at the database level. Even if a client bypasses the frontend, they cannot access other users' data.

### How RLS Works

1. Each request includes a JWT token identifying the user
2. PostgreSQL checks RLS policies before any query
3. Policies use `auth.uid()` to filter data by the current user

### Policy Examples

```sql
-- Users can only view their own cases
CREATE POLICY "cases_select_own" ON public.cases
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only view evidence for their own cases
CREATE POLICY "evidence_select_own" ON public.evidence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = evidence.case_id
      AND cases.user_id = auth.uid()
      AND cases.deleted_at IS NULL
    )
  );
```

### Tables with RLS Enabled

| Table | Policy Type |
|-------|-------------|
| `profiles` | User owns their profile |
| `cases` | User owns their cases |
| `evidence` | User owns case → can access evidence |
| `tasks` | User owns case → can access tasks |
| `transcriptions` | User owns the transcription |
| `trial_sessions` | User owns the session |
| `settlement_analyses` | User owns the analysis |
| `witnesses` | User owns the witness |
| `documents` | User owns the document |

### Storage Buckets

File storage also uses RLS:

```sql
-- Users can only access files in their own directory
CREATE POLICY "case_files_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'case-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

Files are stored in paths like: `{user-id}/{case-id}/{filename}`

---

## Authentication Flow

```
┌──────────┐     ┌───────────────┐     ┌──────────────────┐
│  User    │────▶│   Supabase    │────▶│   JWT Token      │
│  Sign In │     │   Auth Service│     │   Generated      │
└──────────┘     └───────────────┘     └──────────────────┘
                                               │
                                               ▼
┌──────────┐     ┌───────────────┐     ┌──────────────────┐
│  API     │────▶│   Token       │────▶│   Request        │
│  Request │     │   Attached    │     │   Processed      │
└──────────┘     └───────────────┘     └──────────────────┘
```

### Token Validation

Every Edge Function validates the JWT:

```typescript
export async function validateAuth(authHeader: string | null): Promise<AuthUser> {
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  return { id: user.id, email: user.email };
}
```

---

## Rate Limiting

All Edge Functions implement per-user rate limiting:

```typescript
const RATE_LIMIT_MAX_REQUESTS: Record<string, number> = {
  'gemini-proxy': 30,      // 30 requests per minute
  'openai-proxy': 30,
  'whisper-proxy': 10,     // Lower for expensive transcription
  'elevenlabs-proxy': 20,
};
```

**Benefits:**
- Prevents quota exhaustion from runaway clients
- Protects against accidental loops
- Limits impact of compromised accounts

---

## Security Best Practices for Production

### 1. Enable Email Verification

```sql
-- In Supabase Dashboard > Authentication > Settings
-- Enable "Enable email confirmations"
```

### 2. Configure Allowed Domains

Restrict authentication to specific email domains for enterprise:

```sql
-- In authentication hooks or triggers
CREATE OR REPLACE FUNCTION validate_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email NOT LIKE '%@yourcompany.com' THEN
    RAISE EXCEPTION 'Email domain not allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 3. Enable Multi-Factor Authentication (MFA)

Supabase supports MFA. Enable in **Authentication** > **Providers**.

### 4. Set Up Audit Logging

Track sensitive operations:

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. Configure Backup and Point-in-Time Recovery

Enable in Supabase: **Settings** > **Database** > **Backups**

### 6. Review Security Advisor

Supabase provides a Security Advisor that checks for:
- Exposed API keys
- Misconfigured RLS
- Public bucket settings

Run it regularly in **Security** > **Advisor**.

### 7. Monitor Edge Function Logs

Check for:
- Repeated authentication failures
- Unusual request patterns
- Rate limit violations

### 8. Rotate API Keys Periodically

1. Generate new API keys from providers
2. Update secrets in Supabase dashboard
3. Revoke old keys after verification

---

## Security Checklist

- [ ] All API keys stored as Supabase secrets (not in code)
- [ ] RLS enabled on all tables
- [ ] RLS policies tested (try accessing another user's data)
- [ ] Storage bucket policies configured
- [ ] Rate limiting active on all Edge Functions
- [ ] Email verification enabled (production)
- [ ] MFA enabled for admin accounts
- [ ] Security Advisor shows no warnings
- [ ] Backups configured
- [ ] Audit logging implemented
- [ ] CORS origins restricted to your domains

---

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly by creating a private security advisory rather than a public issue.
