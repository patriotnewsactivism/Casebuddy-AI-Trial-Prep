import React, { useState, useEffect } from 'react';
import { Case, TimelineEvent, TimelineEventType, TimelineEventImportance } from '../types';
import { Plus, Trash2, Zap, BookOpen } from 'lucide-react';
import { callGeminiProxy } from '../services/apiProxy';
import { Type } from '@google/genai';
import { handleSuccess, handleError } from '../utils/errorHandler';

interface CaseTimelineProps {
  activeCase: Case | null;
  updateCase: (id: string, data: Partial<Case>) => Promise<void>;
}

const deduplicateEvents = (events: TimelineEvent[]): TimelineEvent[] => {
  const seen = new Set<string>();
  return events.filter(e => {
    const key = `${e.title.toLowerCase().trim()}|${e.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const typeColors: Record<TimelineEventType, string> = {
  incident: 'border-red-500',
  evidence: 'border-blue-500',
  witness: 'border-purple-500',
  filing: 'border-yellow-500',
  hearing: 'border-green-500',
  other: 'border-slate-500',
};

const typeColors2: Record<TimelineEventType, string> = {
  incident: 'bg-red-500',
  evidence: 'bg-blue-500',
  witness: 'bg-purple-500',
  filing: 'bg-yellow-500',
  hearing: 'bg-green-500',
  other: 'bg-slate-500',
};

const importanceColors: Record<TimelineEventImportance, string> = {
  low: 'bg-slate-600 text-slate-300',
  medium: 'bg-yellow-500 text-slate-900',
  high: 'bg-orange-500 text-white',
  critical: 'bg-red-600 text-white animate-pulse',
};

export const CaseTimeline: React.FC<CaseTimelineProps> = ({ activeCase, updateCase }) => {
  const [events, setEvents] = useState<TimelineEvent[]>(activeCase?.timelineEvents || []);
  const [filterType, setFilterType] = useState<TimelineEventType | 'all'>('all');
  const [filterImportance, setFilterImportance] = useState<TimelineEventImportance | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<TimelineEvent>>({
    type: 'other',
    importance: 'medium',
  });

  // Re-sync on case switch
  useEffect(() => {
    setEvents(activeCase?.timelineEvents || []);
  }, [activeCase?.id]);

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.date || !activeCase) {
      handleError('Please fill in title and date');
      return;
    }

    const event: TimelineEvent = {
      id: crypto.randomUUID(),
      title: newEvent.title,
      date: newEvent.date,
      description: newEvent.description || '',
      type: (newEvent.type || 'other') as TimelineEventType,
      importance: (newEvent.importance || 'medium') as TimelineEventImportance,
    };

    const updated = [...events, event];
    setEvents(updated);
    await updateCase(activeCase.id, { timelineEvents: updated });
    setNewEvent({ type: 'other', importance: 'medium' });
    setShowAddModal(false);
    handleSuccess('Event added');
  };

  const handleDeleteEvent = async (id: string) => {
    if (!activeCase) return;
    const updated = events.filter(e => e.id !== id);
    setEvents(updated);
    await updateCase(activeCase.id, { timelineEvents: updated });
    handleSuccess('Event deleted');
  };

  const handleExtractFromDocuments = async () => {
    if (!activeCase || !activeCase.evidence || activeCase.evidence.length === 0) {
      handleError('No documents in case to extract from');
      return;
    }

    setExtracting(true);
    try {
      const docsText = activeCase.evidence.map(e => `${e.title}: ${e.summary}`).join('\n');

      const response = await callGeminiProxy({
        prompt: `Extract all datable events from these case documents:\n\n${docsText}`,
        systemPrompt: 'You are a legal timeline analyst. Extract all significant datable events from case documents. Return a JSON array of timeline events.',
        model: 'gemini-2.5-flash',
        options: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                date: { type: Type.STRING },
                description: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['incident', 'evidence', 'witness', 'filing', 'hearing', 'other'] },
                importance: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
              },
              required: ['title', 'date'],
            },
          },
        },
      });

      if (!response.success || !response.text) {
        handleError('Failed to extract events');
        return;
      }

      const extracted = JSON.parse(response.text);
      const newEvents: TimelineEvent[] = extracted.map((e: any) => ({
        id: crypto.randomUUID(),
        title: e.title || '',
        date: e.date || '',
        description: e.description || '',
        type: (e.type || 'other') as TimelineEventType,
        importance: (e.importance || 'medium') as TimelineEventImportance,
      }));

      const merged = deduplicateEvents([...events, ...newEvents]);
      setEvents(merged);
      await updateCase(activeCase.id, { timelineEvents: merged });
      handleSuccess(`Extracted ${newEvents.length} events from documents`);
    } catch (error) {
      handleError('Failed to extract events from documents');
    } finally {
      setExtracting(false);
    }
  };

  const filteredEvents = events.filter(e => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (filterImportance !== 'all' && e.importance !== filterImportance) return false;
    return true;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Case Timeline</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={18} />
            Add Event
          </button>
          <button
            onClick={handleExtractFromDocuments}
            disabled={extracting || !activeCase?.evidence?.length}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <BookOpen size={18} />
            {extracting ? 'Extracting...' : 'Extract from Docs'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="text-slate-300 text-sm block mb-1">Type</label>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg"
          >
            <option value="all">All Types</option>
            <option value="incident">Incident</option>
            <option value="evidence">Evidence</option>
            <option value="witness">Witness</option>
            <option value="filing">Filing</option>
            <option value="hearing">Hearing</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="text-slate-300 text-sm block mb-1">Importance</label>
          <select
            value={filterImportance}
            onChange={e => setFilterImportance(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg"
          >
            <option value="all">All Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Timeline Visualization */}
      <div className="relative py-8">
        {/* Center line */}
        <div className="absolute left-4 sm:left-1/2 sm:-translate-x-1/2 top-0 bottom-0 w-0.5" style={{
          background: 'linear-gradient(to bottom, transparent, #eab308 20%, #eab308 80%, transparent)',
          boxShadow: '0 0 10px 3px rgba(234,179,8,0.25)',
        }} />

        {/* Events */}
        <div className="space-y-12">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p>No events to display. {filterType !== 'all' || filterImportance !== 'all' ? 'Try adjusting filters.' : 'Add an event to get started.'}</p>
            </div>
          ) : (
            filteredEvents.map((event, idx) => {
              const isEven = idx % 2 === 0;
              return (
                <div key={event.id} className="relative">
                  {/* Connector dot */}
                  <div className={`absolute left-2 sm:left-1/2 sm:-translate-x-1/2 w-4 h-4 rounded-full border-2 border-slate-950 mt-5 ${typeColors2[event.type]} ${
                    event.importance === 'critical' ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-slate-950 animate-pulse' : ''
                  }`} />

                  {/* Event card */}
                  <div className={`w-full sm:w-[45%] ${isEven ? 'sm:text-right pl-8 sm:pl-0 sm:pr-8 sm:mr-[55%]' : 'pl-8 sm:ml-[55%]'}`}>
                    <div className={`bg-slate-800/80 border ${typeColors[event.type]} border-slate-700 rounded-xl p-4 hover:border-gold-500/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold-500/10 transition-all duration-200`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-white text-lg">{event.title}</h3>
                          <p className="text-gold-500 text-sm">{event.date}</p>
                          {event.description && (
                            <p className="text-slate-300 text-sm mt-2">{event.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors mt-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 capitalize">
                          {event.type}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${importanceColors[event.importance]}`}>
                          {event.importance}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Add Timeline Event</h3>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Event title"
                value={newEvent.title || ''}
                onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              />

              <input
                type="date"
                value={newEvent.date || ''}
                onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              />

              <textarea
                placeholder="Description (optional)"
                value={newEvent.description || ''}
                onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg resize-none h-20"
              />

              <select
                value={newEvent.type || 'other'}
                onChange={e => setNewEvent({ ...newEvent, type: e.target.value as TimelineEventType })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              >
                <option value="incident">Incident</option>
                <option value="evidence">Evidence</option>
                <option value="witness">Witness</option>
                <option value="filing">Filing</option>
                <option value="hearing">Hearing</option>
                <option value="other">Other</option>
              </select>

              <select
                value={newEvent.importance || 'medium'}
                onChange={e => setNewEvent({ ...newEvent, importance: e.target.value as TimelineEventImportance })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleAddEvent}
                className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-4 py-2 rounded-lg"
              >
                Add Event
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewEvent({ type: 'other', importance: 'medium' });
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
