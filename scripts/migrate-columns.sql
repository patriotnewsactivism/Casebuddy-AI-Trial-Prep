-- Migration: Rename columns to camelCase to match TypeScript types
-- Run this in Supabase SQL Editor

-- Rename cases table columns (they are currently all lowercase)
ALTER TABLE public.cases RENAME COLUMN "opposingcounsel" TO "opposingCounsel";
ALTER TABLE public.cases RENAME COLUMN "nextcourtdate" TO "nextCourtDate";
ALTER TABLE public.cases RENAME COLUMN "winprobability" TO "winProbability";

SELECT 'Migration complete!' as status;
