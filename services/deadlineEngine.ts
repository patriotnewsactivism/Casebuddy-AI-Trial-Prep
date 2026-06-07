/**
 * Court Deadline Engine
 * 
 * Tracks court deadlines, statutes of limitations, and rules-based
 * filing dates. Stores in case metadata via updateCase().
 */

export interface CourtDeadline {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO date
  category: DeadlineCategory;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'upcoming' | 'due-soon' | 'overdue' | 'completed' | 'dismissed';
  caseId?: string;
  ruleReference?: string;  // e.g. "FRCP 12(a)(1)(A)(i)"
  daysFromTrigger?: number;
  triggerEvent?: string;
  notes?: string;
  completedAt?: string;
  reminderDays?: number[];  // e.g. [30, 14, 7, 3, 1]
}

export type DeadlineCategory =
  | 'response'
  | 'discovery'
  | 'motion'
  | 'trial'
  | 'appeal'
  | 'statute-of-limitations'
  | 'administrative'
  | 'custom';

/** Federal Rules of Civil Procedure deadline templates */
export const FRCP_TEMPLATES: Array<{
  label: string;
  category: DeadlineCategory;
  daysFromTrigger: number;
  triggerEvent: string;
  ruleReference: string;
  description: string;
}> = [
  // Response deadlines
  { label: 'Answer to Complaint', category: 'response', daysFromTrigger: 21, triggerEvent: 'Service of complaint', ruleReference: 'FRCP 12(a)(1)(A)(i)', description: 'File answer within 21 days of service' },
  { label: 'Answer (waived service)', category: 'response', daysFromTrigger: 60, triggerEvent: 'Waiver of service sent', ruleReference: 'FRCP 12(a)(1)(A)(ii)', description: 'File answer within 60 days if service waived' },
  { label: 'Motion to Dismiss', category: 'response', daysFromTrigger: 21, triggerEvent: 'Service of complaint', ruleReference: 'FRCP 12(a)(1)(A)(i)', description: 'File 12(b) motion before or with answer' },
  { label: 'Reply to Counterclaim', category: 'response', daysFromTrigger: 21, triggerEvent: 'Service of counterclaim', ruleReference: 'FRCP 12(a)(1)(B)', description: 'Reply within 21 days of service' },
  { label: 'Opposition to Motion', category: 'response', daysFromTrigger: 14, triggerEvent: 'Motion filed', ruleReference: 'Local Rule (varies)', description: 'File opposition/response brief (check local rules)' },
  { label: 'Reply Brief', category: 'response', daysFromTrigger: 7, triggerEvent: 'Opposition filed', ruleReference: 'Local Rule (varies)', description: 'File reply brief (check local rules)' },

  // Discovery deadlines
  { label: 'Initial Disclosures', category: 'discovery', daysFromTrigger: 14, triggerEvent: 'FRCP 26(f) conference', ruleReference: 'FRCP 26(a)(1)(C)', description: 'Initial disclosures within 14 days of 26(f) conference' },
  { label: 'Respond to Interrogatories', category: 'discovery', daysFromTrigger: 30, triggerEvent: 'Interrogatories served', ruleReference: 'FRCP 33(b)(2)', description: 'Respond within 30 days of service' },
  { label: 'Respond to Request for Production', category: 'discovery', daysFromTrigger: 30, triggerEvent: 'RFP served', ruleReference: 'FRCP 34(b)(2)(A)', description: 'Respond within 30 days of service' },
  { label: 'Respond to Request for Admission', category: 'discovery', daysFromTrigger: 30, triggerEvent: 'RFA served', ruleReference: 'FRCP 36(a)(3)', description: 'Respond within 30 days or deemed admitted' },
  { label: 'Expert Disclosures', category: 'discovery', daysFromTrigger: 90, triggerEvent: 'Court order deadline', ruleReference: 'FRCP 26(a)(2)(D)', description: 'Per scheduling order (typically 90 days before trial)' },
  { label: 'Rebuttal Expert Disclosures', category: 'discovery', daysFromTrigger: 30, triggerEvent: 'Expert disclosures deadline', ruleReference: 'FRCP 26(a)(2)(D)(ii)', description: '30 days after expert disclosures' },

  // Motion deadlines
  { label: 'Motion for Summary Judgment', category: 'motion', daysFromTrigger: 30, triggerEvent: 'Discovery close', ruleReference: 'FRCP 56(b)', description: 'File after discovery closes (check local rules)' },
  { label: 'Motions in Limine', category: 'trial', daysFromTrigger: 14, triggerEvent: 'Trial date', ruleReference: 'Local Rule (varies)', description: 'File before trial (check local rules)' },
  { label: 'Pretrial Brief/Statement', category: 'trial', daysFromTrigger: 7, triggerEvent: 'Trial date', ruleReference: 'Local Rule (varies)', description: 'File per scheduling order' },

  // Appeal deadlines
  { label: 'Notice of Appeal', category: 'appeal', daysFromTrigger: 30, triggerEvent: 'Final judgment entered', ruleReference: 'FRAP 4(a)(1)(A)', description: '30 days from entry of judgment (civil)' },
  { label: 'Notice of Appeal (govt party)', category: 'appeal', daysFromTrigger: 60, triggerEvent: 'Final judgment entered', ruleReference: 'FRAP 4(a)(1)(B)', description: '60 days if US is a party' },
  { label: 'Motion for New Trial / JMOL', category: 'appeal', daysFromTrigger: 28, triggerEvent: 'Judgment entered', ruleReference: 'FRCP 59(b)/50(b)', description: 'File within 28 days of judgment' },

  // Statute of Limitations
  { label: '§1983 Civil Rights (MS: 3 years)', category: 'statute-of-limitations', daysFromTrigger: 1095, triggerEvent: 'Date of violation', ruleReference: '42 U.S.C. §1983 / Miss. Code §15-1-49', description: 'Mississippi personal injury SOL applies to §1983 claims' },
  { label: '§1983 Civil Rights (general: 2 years)', category: 'statute-of-limitations', daysFromTrigger: 730, triggerEvent: 'Date of violation', ruleReference: '42 U.S.C. §1983', description: 'Most states use 2-year personal injury SOL' },
  { label: 'Federal Tort Claims Act', category: 'statute-of-limitations', daysFromTrigger: 730, triggerEvent: 'Date of incident', ruleReference: '28 U.S.C. §2401(b)', description: 'Administrative claim within 2 years, then 6 months to sue' },
];

const STORAGE_KEY = 'casebuddy_deadlines';

/** Load deadlines */
export const loadDeadlines = (): CourtDeadline[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/** Save deadlines */
export const saveDeadlines = (deadlines: CourtDeadline[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deadlines));
    window.dispatchEvent(new CustomEvent('deadlines-update'));
  } catch (e) {
    console.error('[DeadlineEngine] Save failed:', e);
  }
};

/** Add a deadline */
export const addDeadline = (deadline: Omit<CourtDeadline, 'id' | 'status'>): CourtDeadline => {
  const d: CourtDeadline = {
    ...deadline,
    id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: getDeadlineStatus(deadline.dueDate),
  };
  const all = loadDeadlines();
  all.push(d);
  saveDeadlines(all);
  return d;
};

/** Create a deadline from FRCP template */
export const createFromTemplate = (
  templateIdx: number,
  triggerDate: string,
  caseId?: string,
): CourtDeadline | null => {
  const tpl = FRCP_TEMPLATES[templateIdx];
  if (!tpl) return null;

  const due = new Date(triggerDate);
  due.setDate(due.getDate() + tpl.daysFromTrigger);

  return addDeadline({
    title: tpl.label,
    description: tpl.description,
    dueDate: due.toISOString().slice(0, 10),
    category: tpl.category,
    priority: tpl.category === 'statute-of-limitations' ? 'critical' : tpl.daysFromTrigger <= 14 ? 'high' : 'medium',
    caseId,
    ruleReference: tpl.ruleReference,
    daysFromTrigger: tpl.daysFromTrigger,
    triggerEvent: tpl.triggerEvent,
    reminderDays: [30, 14, 7, 3, 1],
  });
};

/** Compute status based on due date */
export const getDeadlineStatus = (dueDate: string): CourtDeadline['status'] => {
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 7) return 'due-soon';
  return 'upcoming';
};

/** Refresh statuses for all deadlines */
export const refreshStatuses = (): void => {
  const all = loadDeadlines();
  let changed = false;
  for (const d of all) {
    if (d.status === 'completed' || d.status === 'dismissed') continue;
    const newStatus = getDeadlineStatus(d.dueDate);
    if (newStatus !== d.status) {
      d.status = newStatus;
      changed = true;
    }
  }
  if (changed) saveDeadlines(all);
};

/** Complete a deadline */
export const completeDeadline = (id: string): void => {
  const all = loadDeadlines();
  const dl = all.find(d => d.id === id);
  if (dl) {
    dl.status = 'completed';
    dl.completedAt = new Date().toISOString();
    saveDeadlines(all);
  }
};

/** Dismiss a deadline */
export const dismissDeadline = (id: string): void => {
  const all = loadDeadlines();
  const dl = all.find(d => d.id === id);
  if (dl) {
    dl.status = 'dismissed';
    saveDeadlines(all);
  }
};

/** Delete a deadline */
export const deleteDeadline = (id: string): void => {
  const all = loadDeadlines().filter(d => d.id !== id);
  saveDeadlines(all);
};

/** Get deadlines needing alerts */
export const getAlerts = (): CourtDeadline[] => {
  const all = loadDeadlines();
  return all.filter(d => d.status === 'overdue' || d.status === 'due-soon');
};

/** Export deadlines as ICS calendar file */
export const exportICS = (deadlines: CourtDeadline[]): string => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CaseBuddy//Deadline Engine//EN',
    'CALSCALE:GREGORIAN',
  ];

  for (const d of deadlines) {
    if (d.status === 'dismissed') continue;
    const dtStart = d.dueDate.replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `DTSTART;VALUE=DATE:${dtStart}`,
      `SUMMARY:⚖️ ${d.title}`,
      `DESCRIPTION:${d.description}${d.ruleReference ? ` (${d.ruleReference})` : ''}`,
      `UID:${d.id}@casebuddy.live`,
      'BEGIN:VALARM',
      'TRIGGER:-P7D',
      'ACTION:DISPLAY',
      `DESCRIPTION:Deadline in 7 days: ${d.title}`,
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:Deadline TOMORROW: ${d.title}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};
