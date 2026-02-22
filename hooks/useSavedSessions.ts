import { useState, useEffect, useCallback } from 'react';
import { TrialSession } from '../types';

export function useSavedSessions(caseId: string | undefined) {
  const [sessions, setSessions] = useState<TrialSession[]>(() => {
    if (!caseId) return [];
    try {
      return JSON.parse(localStorage.getItem(`trial_sessions_${caseId}`) ?? '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!caseId) return;
    try {
      setSessions(JSON.parse(localStorage.getItem(`trial_sessions_${caseId}`) ?? '[]'));
    } catch {
      setSessions([]);
    }
  }, [caseId]);

  const addSession = useCallback((session: TrialSession) => {
    setSessions(prev => {
      const updated = [session, ...prev].slice(0, 20);
      if (caseId) localStorage.setItem(`trial_sessions_${caseId}`, JSON.stringify(updated));
      return updated;
    });
  }, [caseId]);

  const removeSession = useCallback((id: string) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      if (caseId) localStorage.setItem(`trial_sessions_${caseId}`, JSON.stringify(updated));
      return updated;
    });
  }, [caseId]);

  return { sessions, addSession, removeSession };
}
