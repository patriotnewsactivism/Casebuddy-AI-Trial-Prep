// CaseBuddy AI — Lead Store
// Sierra (AI Legal Secretary) captures qualified leads here. Each lead can be
// promoted into an intake-ready case stub with one click — Maya's case file
// system takes over from there and briefs every department.
// Same localStorage + useSyncExternalStore pattern as caseStore.

import { useSyncExternalStore } from 'react';
import { createCaseFromIntake, CaseFile } from './caseStore';
import { track } from './analytics';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  caseType: string;
  jurisdiction: string;
  summary: string;
  urgency: string;            // 'Low' | 'Medium' | 'High'
  capturedAt: string;
  status: 'new' | 'promoted' | 'archived';
  caseId?: string;            // set once promoted to a case file
}

const LEADS_KEY = 'cb_leads';

// Demo leads shown on first load so the Leads tab isn't empty.
const SEED_LEADS: Lead[] = [
  {
    id: 'seed-1', name: 'John Smith', email: 'john@email.com', phone: '(555) 123-4567',
    caseType: 'Civil Rights', jurisdiction: 'Mississippi',
    summary: 'Police excessive force during traffic stop. Has video evidence.',
    urgency: 'High', capturedAt: '2026-06-08T14:30:00Z', status: 'new',
  },
  {
    id: 'seed-2', name: 'Sarah Johnson', email: 'sarah.j@email.com', phone: '(555) 987-6543',
    caseType: 'Personal Injury', jurisdiction: 'Mississippi',
    summary: 'Slip and fall at grocery store. Medical bills $12,000.',
    urgency: 'Medium', capturedAt: '2026-06-07T09:15:00Z', status: 'new',
  },
];

function load(): Lead[] {
  try {
    const raw = localStorage.getItem(LEADS_KEY);
    return raw ? JSON.parse(raw) : SEED_LEADS;
  } catch {
    return SEED_LEADS;
  }
}

let cache: Lead[] = load();
const listeners = new Set<() => void>();

function persist() {
  localStorage.setItem(LEADS_KEY, JSON.stringify(cache));
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export function useLeads(): Lead[] {
  return useSyncExternalStore(subscribe, () => cache);
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function addLead(lead: Omit<Lead, 'id' | 'capturedAt' | 'status'>): Lead {
  const l: Lead = { ...lead, id: uid(), capturedAt: new Date().toISOString(), status: 'new' };
  cache = [l, ...cache];
  persist();
  track('lead_captured', { caseType: l.caseType, urgency: l.urgency });
  return l;
}

export function archiveLead(id: string) {
  cache = cache.map(l => l.id === id ? { ...l, status: 'archived' as const } : l);
  persist();
}

// Promote a qualified lead to an intake-ready case stub. Maya's handoff
// engine briefs every department the moment the case file is created.
export function promoteLead(id: string): CaseFile | null {
  const lead = cache.find(l => l.id === id);
  if (!lead || lead.status === 'promoted') return null;
  const c = createCaseFromIntake({
    client_name: lead.name,
    case_type: lead.caseType || 'General',
    jurisdiction: lead.jurisdiction,
    urgency: lead.urgency.toLowerCase(),
    summary: `Lead captured by Sierra (AI Legal Secretary) on ${new Date(lead.capturedAt).toLocaleDateString()}. ` +
      `Contact: ${lead.email}${lead.phone ? `, ${lead.phone}` : ''}. ${lead.summary}`,
    next_steps: ['Complete full intake interview with Maya', 'Verify contact information and conflict check'],
  });
  cache = cache.map(l => l.id === id ? { ...l, status: 'promoted' as const, caseId: c.id } : l);
  persist();
  track('lead_promoted', { caseType: lead.caseType });
  return c;
}

// Sierra's replies may include a <LEAD_CAPTURED>{...}</LEAD_CAPTURED> block
// once she has gathered contact info. Parse it out (returns null if absent).
export function parseLeadCapture(reply: string): Omit<Lead, 'id' | 'capturedAt' | 'status'> | null {
  const match = reply.match(/<LEAD_CAPTURED>([\s\S]*?)<\/LEAD_CAPTURED>/);
  if (!match) return null;
  try {
    const j = JSON.parse(match[1].replace(/```json|```/g, '').trim());
    if (!j.name) return null;
    return {
      name: j.name,
      email: j.email || '',
      phone: j.phone || '',
      caseType: j.case_type || j.caseType || 'General',
      jurisdiction: j.jurisdiction || '',
      summary: j.summary || '',
      urgency: j.urgency || 'Medium',
    };
  } catch {
    return null;
  }
}

export function stripLeadCapture(reply: string): string {
  return reply.replace(/<LEAD_CAPTURED>[\s\S]*?<\/LEAD_CAPTURED>/, '').trim();
}
