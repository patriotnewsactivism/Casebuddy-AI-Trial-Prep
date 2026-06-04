/**
 * Agent Service — Autonomous AI Law Firm Agents
 *
 * Manages autonomous AI agents that actively work on cases:
 * - AI Paralegal: Drafts & sends FOIA requests, discovery responses, tracks deadlines, follows up
 * - AI Receptionist: Handles intake, responds to emails, schedules, follows up with clients
 * - AI Partner: Reviews case strategy, identifies weaknesses, recommends actions
 *
 * Each agent can:
 * 1. Analyze case state and decide what actions to take
 * 2. Draft human-sounding communications
 * 3. Queue emails for sending (via Supabase edge function)
 * 4. Track deadlines and auto-generate follow-ups
 * 5. Log all actions for review
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Case, DiscoveryRequest } from '../types';
import { callGeminiProxy } from './apiProxy';
import { getSupabaseClient } from './supabaseClient';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// ── Types ────────────────────────────────────────────────────────────────────

export type AgentRole = 'paralegal' | 'receptionist' | 'partner';
export type TaskStatus = 'pending' | 'approved' | 'sent' | 'delivered' | 'replied' | 'failed' | 'cancelled';
export type TaskType =
  | 'foia_request'
  | 'records_request'
  | 'discovery_response'
  | 'follow_up'
  | 'client_intake'
  | 'client_followup'
  | 'email_reply'
  | 'deadline_reminder'
  | 'case_review'
  | 'strategic_memo';

export interface AgentTask {
  id: string;
  caseId: string;
  agent: AgentRole;
  type: TaskType;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  followUpDate?: string;

  // Email-specific fields
  email?: {
    to: string;
    from: string;
    subject: string;
    body: string;
    cc?: string;
    replyTo?: string;
  };

  // Tracking
  sentAt?: string;
  responseReceivedAt?: string;
  responseText?: string;

  // AI reasoning
  reasoning: string;         // Why the agent decided to do this
  caseFactsBasis: string[];  // Which case facts drove this decision

  // Audit trail
  actions: TaskAction[];
}

export interface TaskAction {
  timestamp: string;
  action: string;
  detail: string;
  automated: boolean;
}

export interface AgentAnalysis {
  agent: AgentRole;
  caseId: string;
  timestamp: string;
  recommendedTasks: RecommendedTask[];
  summary: string;
}

export interface RecommendedTask {
  type: TaskType;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  reasoning: string;
  caseFactsBasis: string[];
  dueDate?: string;
  emailDraft?: {
    to: string;
    subject: string;
    body: string;
  };
}

export interface AgentConfig {
  firmName: string;
  firmAddress: string;
  firmPhone: string;
  firmEmail: string;
  attorneyName: string;
  attorneyTitle: string;
  barNumber?: string;
  emailSignature: string;
  autoApprove: boolean;         // If true, send emails without manual approval
  followUpDays: number;         // Days before auto follow-up
  tone: 'formal' | 'professional' | 'friendly';
}

const DEFAULT_CONFIG: AgentConfig = {
  firmName: 'Law Office',
  firmAddress: '',
  firmPhone: '',
  firmEmail: '',
  attorneyName: '',
  attorneyTitle: 'Attorney at Law',
  emailSignature: '',
  autoApprove: false,
  followUpDays: 14,
  tone: 'professional',
};

// ── Agent Configuration ──────────────────────────────────────────────────────

export const saveAgentConfig = (config: AgentConfig): void => {
  localStorage.setItem('agent_config', JSON.stringify(config));
};

export const loadAgentConfig = (): AgentConfig => {
  try {
    const saved = localStorage.getItem('agent_config');
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
};

// ── Paralegal Agent: Analyze Case & Recommend Actions ────────────────────────

export const analyzeForParalegal = async (caseData: Case): Promise<AgentAnalysis> => {
  const config = loadAgentConfig();

  const caseContext = buildCaseContext(caseData);
  const existingTasks = loadTasks(caseData.id).filter(t => t.agent === 'paralegal' && t.status !== 'cancelled');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are an experienced paralegal at ${config.firmName || 'a law firm'}. You work autonomously — you don't wait to be told what to do. You analyze the case and identify what needs to happen next.

CASE:
${caseContext}

ACTIONS ALREADY TAKEN OR IN PROGRESS:
${existingTasks.map(t => `- [${t.status}] ${t.title} (${t.type})`).join('\n') || 'None yet'}

Based on the case facts, what actions should be taken RIGHT NOW? Think about:

1. **FOIA Requests** — What government records should we request? Body cam footage? Arrest records? Internal affairs complaints? 911 call recordings? Dispatch logs? Training records? Personnel files?

2. **Public Records Requests** — State/local records? Court filings? Property records? Business registrations?

3. **Discovery Follow-ups** — Any pending discovery that needs follow-up? Deadlines approaching?

4. **Deadline Tracking** — What deadlines exist? What's coming up? What needs to be calendared?

5. **Document Requests** — What documents should we request from opposing counsel? Medical records? Financial records? Communications?

For each recommended action:
- Draft the actual email/letter that would be sent (it must sound 100% like a real human paralegal wrote it — NO AI language, NO generic templates)
- Include the specific agency/person to send it to
- Explain your reasoning based on case facts
- Set an appropriate follow-up date

IMPORTANT: Only recommend actions that haven't already been taken. Be specific to THIS case — generic actions are useless.

Return JSON array of recommended tasks.`,
    config: {
      thinkingConfig: { thinkingBudget: 8192 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['foia_request', 'records_request', 'discovery_response', 'follow_up', 'deadline_reminder'] },
            priority: { type: Type.STRING, enum: ['low', 'medium', 'high', 'urgent'] },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            caseFactsBasis: { type: Type.ARRAY, items: { type: Type.STRING } },
            dueDate: { type: Type.STRING },
            emailTo: { type: Type.STRING },
            emailSubject: { type: Type.STRING },
            emailBody: { type: Type.STRING },
          },
        },
      },
    },
  });

  const tasks: RecommendedTask[] = JSON.parse(response.text || '[]').map((t: any) => ({
    type: t.type || 'records_request',
    priority: t.priority || 'medium',
    title: t.title || 'Untitled task',
    description: t.description || '',
    reasoning: t.reasoning || '',
    caseFactsBasis: t.caseFactsBasis || [],
    dueDate: t.dueDate,
    emailDraft: t.emailTo ? {
      to: t.emailTo,
      subject: t.emailSubject || '',
      body: t.emailBody || '',
    } : undefined,
  }));

  return {
    agent: 'paralegal',
    caseId: caseData.id,
    timestamp: new Date().toISOString(),
    recommendedTasks: tasks,
    summary: `Analyzed case "${caseData.title}" and identified ${tasks.length} recommended actions.`,
  };
};

// ── Receptionist Agent: Client Communication ─────────────────────────────────

export const analyzeForReceptionist = async (caseData: Case): Promise<AgentAnalysis> => {
  const config = loadAgentConfig();
  const existingTasks = loadTasks(caseData.id).filter(t => t.agent === 'receptionist' && t.status !== 'cancelled');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are a professional law firm receptionist/legal assistant at ${config.firmName || 'a law firm'}. You handle client communications with warmth and professionalism. Nobody should ever suspect you're AI — you write like a real person.

CASE:
Title: ${caseData.title}
Client: ${caseData.client}
Status: ${caseData.status}
Next Court Date: ${caseData.nextCourtDate || 'Not set'}
Summary: ${caseData.summary}

EXISTING COMMUNICATIONS:
${existingTasks.map(t => `- [${t.status}] ${t.title}`).join('\n') || 'No prior communications'}

What client communications should happen now? Think about:

1. **Case Updates** — Should the client be updated on case progress?
2. **Document Collection** — Do we need documents from the client?
3. **Appointment Reminders** — Upcoming court dates or meetings?
4. **Follow-ups** — Has the client been unresponsive? Need a gentle nudge?
5. **Intake** — Any missing information from initial intake?

For each communication:
- Draft the actual email (warm, professional, human — NOT robotic)
- Use the client's name naturally
- Be specific about what's needed and deadlines

Return JSON array.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['client_intake', 'client_followup', 'email_reply', 'deadline_reminder'] },
            priority: { type: Type.STRING, enum: ['low', 'medium', 'high', 'urgent'] },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            caseFactsBasis: { type: Type.ARRAY, items: { type: Type.STRING } },
            emailTo: { type: Type.STRING },
            emailSubject: { type: Type.STRING },
            emailBody: { type: Type.STRING },
          },
        },
      },
    },
  });

  const tasks: RecommendedTask[] = JSON.parse(response.text || '[]').map((t: any) => ({
    type: t.type || 'client_followup',
    priority: t.priority || 'medium',
    title: t.title || 'Client communication',
    description: t.description || '',
    reasoning: t.reasoning || '',
    caseFactsBasis: t.caseFactsBasis || [],
    emailDraft: t.emailTo ? {
      to: t.emailTo,
      subject: t.emailSubject || '',
      body: t.emailBody || '',
    } : undefined,
  }));

  return {
    agent: 'receptionist',
    caseId: caseData.id,
    timestamp: new Date().toISOString(),
    recommendedTasks: tasks,
    summary: `Identified ${tasks.length} client communications needed.`,
  };
};

// ── Partner Agent: Strategic Review ──────────────────────────────────────────

export const analyzeForPartner = async (caseData: Case): Promise<AgentAnalysis> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are a senior managing partner at a law firm. You review cases with a critical eye and provide strategic direction. You don't sugarcoat — if there's a problem, you say it directly.

CASE:
Title: ${caseData.title}
Client: ${caseData.client}
Status: ${caseData.status}
Win Probability: ${caseData.winProbability}%
Opposing Counsel: ${caseData.opposingCounsel}
Judge: ${caseData.judge}
Summary: ${caseData.summary}
Key Issues: ${caseData.keyIssues?.join(', ') || 'None listed'}
Evidence Count: ${caseData.evidence?.length || 0}
Witnesses: ${caseData.witnesses?.map(w => w.name).join(', ') || 'None listed'}

Provide strategic analysis:
1. **Weaknesses** — Where are we vulnerable? What could lose this case?
2. **Missing Actions** — What critical things haven't been done?
3. **Strategic Recommendations** — What should the attorney focus on?
4. **Settlement Assessment** — Should we settle or go to trial?
5. **Devil's Advocate** — What will opposing counsel argue?

Return as structured tasks/memos.`,
    config: {
      thinkingConfig: { thinkingBudget: 8192 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['case_review', 'strategic_memo'] },
            priority: { type: Type.STRING, enum: ['low', 'medium', 'high', 'urgent'] },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            caseFactsBasis: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    },
  });

  const tasks: RecommendedTask[] = JSON.parse(response.text || '[]').map((t: any) => ({
    type: t.type || 'case_review',
    priority: t.priority || 'medium',
    title: t.title || 'Strategic review item',
    description: t.description || '',
    reasoning: t.reasoning || '',
    caseFactsBasis: t.caseFactsBasis || [],
  }));

  return {
    agent: 'partner',
    caseId: caseData.id,
    timestamp: new Date().toISOString(),
    recommendedTasks: tasks,
    summary: `Strategic review complete — ${tasks.length} items identified.`,
  };
};

// ── Generate Follow-Up Email ─────────────────────────────────────────────────

export const generateFollowUp = async (originalTask: AgentTask, caseData: Case): Promise<string> => {
  const config = loadAgentConfig();
  const daysSinceSent = originalTask.sentAt
    ? Math.round((Date.now() - new Date(originalTask.sentAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const response = await callGeminiProxy({
    prompt: `Write a follow-up email for this request that was sent ${daysSinceSent} days ago with no response.

ORIGINAL EMAIL:
To: ${originalTask.email?.to}
Subject: ${originalTask.email?.subject}
Body: ${originalTask.email?.body}

CASE: ${caseData.title}
SENDER: ${config.attorneyName || 'Our office'} at ${config.firmName}

Write a polite but firm follow-up. Sound human — like a real paralegal who's done this a thousand times. Reference the original request date. If it's a FOIA request, cite the relevant statute's response deadline. Keep it short and direct.

Return just the email body text, no JSON.`,
    model: 'gemini-2.5-flash',
    options: { temperature: 0.4 },
  });

  return response.text || '';
};

// ── Send Email via Supabase Edge Function ────────────────────────────────────

export const sendEmail = async (task: AgentTask): Promise<{ success: boolean; error?: string }> => {
  if (!task.email) return { success: false, error: 'No email data on task' };

  const supabase = getSupabaseClient();
  if (!supabase) {
    // Fallback: open mailto link
    const mailto = `mailto:${task.email.to}?subject=${encodeURIComponent(task.email.subject)}&body=${encodeURIComponent(task.email.body)}`;
    window.open(mailto, '_blank');
    return { success: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: task.email.to,
        from: task.email.from,
        subject: task.email.subject,
        body: task.email.body,
        cc: task.email.cc,
        replyTo: task.email.replyTo,
      },
    });

    if (error) {
      // Fallback to mailto
      const mailto = `mailto:${task.email.to}?subject=${encodeURIComponent(task.email.subject)}&body=${encodeURIComponent(task.email.body)}`;
      window.open(mailto, '_blank');
      return { success: true };
    }

    return { success: true };
  } catch (err) {
    // Fallback to mailto
    const mailto = `mailto:${task.email.to}?subject=${encodeURIComponent(task.email.subject)}&body=${encodeURIComponent(task.email.body)}`;
    window.open(mailto, '_blank');
    return { success: true };
  }
};

// ── Task Management ──────────────────────────────────────────────────────────

export const createTask = (recommendation: RecommendedTask, caseId: string, agent: AgentRole): AgentTask => {
  const config = loadAgentConfig();
  const task: AgentTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    caseId,
    agent,
    type: recommendation.type,
    status: 'pending',
    priority: recommendation.priority,
    title: recommendation.title,
    description: recommendation.description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dueDate: recommendation.dueDate,
    reasoning: recommendation.reasoning,
    caseFactsBasis: recommendation.caseFactsBasis,
    email: recommendation.emailDraft ? {
      to: recommendation.emailDraft.to,
      from: config.firmEmail || '',
      subject: recommendation.emailDraft.subject,
      body: recommendation.emailDraft.body,
      replyTo: config.firmEmail || '',
    } : undefined,
    actions: [{
      timestamp: new Date().toISOString(),
      action: 'created',
      detail: `Task created by AI ${agent}. Reasoning: ${recommendation.reasoning}`,
      automated: true,
    }],
  };

  saveTask(task);
  return task;
};

export const approveTask = (taskId: string): AgentTask | null => {
  const task = loadTask(taskId);
  if (!task) return null;

  task.status = 'approved';
  task.updatedAt = new Date().toISOString();
  task.actions.push({
    timestamp: new Date().toISOString(),
    action: 'approved',
    detail: 'Task approved by attorney for execution',
    automated: false,
  });

  saveTask(task);
  return task;
};

export const executeTask = async (taskId: string): Promise<AgentTask | null> => {
  const task = loadTask(taskId);
  if (!task) return null;

  if (task.email) {
    const result = await sendEmail(task);
    if (result.success) {
      task.status = 'sent';
      task.sentAt = new Date().toISOString();
      task.actions.push({
        timestamp: new Date().toISOString(),
        action: 'sent',
        detail: `Email sent to ${task.email.to}`,
        automated: true,
      });

      // Set follow-up date
      const config = loadAgentConfig();
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + config.followUpDays);
      task.followUpDate = followUpDate.toISOString().split('T')[0];
    } else {
      task.status = 'failed';
      task.actions.push({
        timestamp: new Date().toISOString(),
        action: 'failed',
        detail: `Send failed: ${result.error}`,
        automated: true,
      });
    }
  } else {
    // Non-email tasks (strategic memos, reviews) just get marked complete
    task.status = 'sent';
    task.actions.push({
      timestamp: new Date().toISOString(),
      action: 'completed',
      detail: 'Task completed',
      automated: true,
    });
  }

  task.updatedAt = new Date().toISOString();
  saveTask(task);
  return task;
};

export const cancelTask = (taskId: string): void => {
  const task = loadTask(taskId);
  if (!task) return;

  task.status = 'cancelled';
  task.updatedAt = new Date().toISOString();
  task.actions.push({
    timestamp: new Date().toISOString(),
    action: 'cancelled',
    detail: 'Task cancelled by attorney',
    automated: false,
  });

  saveTask(task);
};

// ── Check for tasks needing follow-up ────────────────────────────────────────

export const getOverdueTasks = (caseId: string): AgentTask[] => {
  const tasks = loadTasks(caseId);
  const today = new Date().toISOString().split('T')[0];

  return tasks.filter(t =>
    t.status === 'sent' &&
    t.followUpDate &&
    t.followUpDate <= today &&
    !t.responseReceivedAt
  );
};

export const getPendingTasks = (caseId: string): AgentTask[] => {
  return loadTasks(caseId).filter(t => t.status === 'pending');
};

export const getTasksByAgent = (caseId: string, agent: AgentRole): AgentTask[] => {
  return loadTasks(caseId).filter(t => t.agent === agent);
};

export const getAllTasks = (caseId: string): AgentTask[] => {
  return loadTasks(caseId);
};

// ── Storage ──────────────────────────────────────────────────────────────────

const saveTask = (task: AgentTask): void => {
  try {
    const tasks = loadTasks(task.caseId);
    const idx = tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) {
      tasks[idx] = task;
    } else {
      tasks.push(task);
    }
    localStorage.setItem(`agent_tasks_${task.caseId}`, JSON.stringify(tasks));
  } catch (err) {
    console.warn('[AgentService] Failed to save task:', err);
  }
};

const loadTask = (taskId: string): AgentTask | null => {
  // Search all cases for this task (tasks have unique IDs)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('agent_tasks_')) {
      try {
        const tasks: AgentTask[] = JSON.parse(localStorage.getItem(key) || '[]');
        const found = tasks.find(t => t.id === taskId);
        if (found) return found;
      } catch { /* skip */ }
    }
  }
  return null;
};

const loadTasks = (caseId: string): AgentTask[] => {
  try {
    return JSON.parse(localStorage.getItem(`agent_tasks_${caseId}`) || '[]');
  } catch {
    return [];
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const buildCaseContext = (caseData: Case): string => {
  return `Title: ${caseData.title}
Client: ${caseData.client}
Status: ${caseData.status}
Docket Number: ${caseData.docketNumber || 'N/A'}
Court: ${caseData.courtLocation || 'N/A'}
Jurisdiction: ${caseData.jurisdiction || 'N/A'}
Judge: ${caseData.judge || 'TBD'}
Opposing Counsel: ${caseData.opposingCounsel || 'Unknown'}
Opposing Party: ${caseData.opposingParty || 'Unknown'}
Client Type: ${caseData.clientType || 'Unknown'}
Next Court Date: ${caseData.nextCourtDate || 'Not set'}
Win Probability: ${caseData.winProbability}%
Summary: ${caseData.summary || 'No summary'}
Legal Theory: ${caseData.legalTheory || 'Not specified'}
Key Issues: ${caseData.keyIssues?.join(', ') || 'None listed'}
Evidence: ${caseData.evidence?.length || 0} items
Witnesses: ${caseData.witnesses?.map(w => `${w.name} (${w.role})`).join(', ') || 'None listed'}
Discovery Requests: ${caseData.discoveryRequests?.length || 0} pending`;
};

export default {
  analyzeForParalegal,
  analyzeForReceptionist,
  analyzeForPartner,
  generateFollowUp,
  sendEmail,
  createTask,
  approveTask,
  executeTask,
  cancelTask,
  getOverdueTasks,
  getPendingTasks,
  getTasksByAgent,
  getAllTasks,
  saveAgentConfig,
  loadAgentConfig,
};
