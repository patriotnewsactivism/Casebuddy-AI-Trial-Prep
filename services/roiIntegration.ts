/**
 * ROI Integration — auto-tracks AI task completions.
 * 
 * Import and call trackAICompletion() after any major AI-assisted task.
 * This is the lightweight integration layer so components only need one line.
 */

import { trackROI, type ROITaskType } from './roiTracker';

/**
 * Track an AI task completion with minimal boilerplate.
 * 
 * Usage in any component:
 *   import { trackAICompletion } from '../services/roiIntegration';
 *   
 *   // After successful AI call:
 *   trackAICompletion('Drafting Assistant', 'Generated motion to dismiss');
 */
export const trackAICompletion = (
  toolName: string,
  description: string,
  options?: {
    caseId?: string;
    caseName?: string;
    taskType?: ROITaskType;
    startTime?: number; // Date.now() from before the AI call
  }
): void => {
  const actualSeconds = options?.startTime
    ? Math.round((Date.now() - options.startTime) / 1000)
    : 5; // default 5s if not measured

  trackROI({
    toolName,
    description,
    actualSeconds,
    caseId: options?.caseId,
    caseName: options?.caseName,
    taskType: options?.taskType,
  });
};
