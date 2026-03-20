import React, { useState } from 'react';
import { Case, CaseTask, CourtDate } from '../../types';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { handleSuccess } from '../../utils/errorHandler';

interface TasksTabProps {
  activeCase: Case | null;
  updateCase: (id: string, data: Partial<Case>) => Promise<void>;
}

export const TasksTab: React.FC<TasksTabProps> = ({ activeCase, updateCase }) => {
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddDate, setShowAddDate] = useState(false);
  const [newTask, setNewTask] = useState<Partial<CaseTask>>({ status: 'open', priority: 'medium' });
  const [newDate, setNewDate] = useState<Partial<CourtDate>>({ type: 'hearing' });

  if (!activeCase) {
    return <div className="text-slate-400">Select a case to view</div>;
  }

  const handleAddTask = async () => {
    if (!newTask.title) return;
    const task: CaseTask = {
      id: crypto.randomUUID(),
      caseId: activeCase.id,
      title: newTask.title,
      status: (newTask.status || 'open') as any,
      priority: (newTask.priority || 'medium') as any,
      dueDate: newTask.dueDate,
    };
    const updated = [...(activeCase.tasks || []), task];
    await updateCase(activeCase.id, { tasks: updated });
    setNewTask({ status: 'open', priority: 'medium' });
    setShowAddTask(false);
    handleSuccess('Task added');
  };

  const handleAddDate = async () => {
    if (!newDate.title || !newDate.date) return;
    const date: CourtDate = {
      id: crypto.randomUUID(),
      caseId: activeCase.id,
      title: newDate.title,
      date: newDate.date,
      type: (newDate.type || 'hearing') as any,
      completed: false,
    };
    const updated = [...(activeCase.courtDates || []), date];
    await updateCase(activeCase.id, { courtDates: updated });
    setNewDate({ type: 'hearing' });
    setShowAddDate(false);
    handleSuccess('Court date added');
  };

  const handleDeleteTask = async (id: string) => {
    const updated = (activeCase.tasks || []).filter(t => t.id !== id);
    await updateCase(activeCase.id, { tasks: updated });
    handleSuccess('Task deleted');
  };

  const handleDeleteDate = async (id: string) => {
    const updated = (activeCase.courtDates || []).filter(d => d.id !== id);
    await updateCase(activeCase.id, { courtDates: updated });
    handleSuccess('Court date deleted');
  };

  const getUrgencyColor = (dueDate: string | undefined, status: string): string => {
    if (status === 'done') return 'bg-green-600/20 border-green-600/30';
    if (!dueDate) return 'border-slate-600';
    const days = Math.floor((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'bg-red-600/20 border-red-600/30';
    if (days < 7) return 'bg-yellow-600/20 border-yellow-600/30';
    if (days < 30) return 'bg-blue-600/20 border-blue-600/30';
    return 'border-slate-600';
  };

  const sortedDates = [...(activeCase.courtDates || [])]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Tasks - Left 60% */}
      <div className="md:col-span-2 lg:col-span-1 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-white">Tasks</h3>
          <button
            onClick={() => setShowAddTask(true)}
            className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-3 py-1 rounded text-sm"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        <div className="space-y-2">
          {(activeCase.tasks || []).map(task => (
            <div key={task.id} className={`border rounded-lg p-3 ${getUrgencyColor(task.dueDate, task.status)}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      task.status === 'done' ? 'bg-green-600' : task.status === 'blocked' ? 'bg-red-600' : 'bg-yellow-600'
                    } text-white`}>
                      {task.status}
                    </span>
                    <h4 className="font-semibold text-white">{task.title}</h4>
                  </div>
                  {task.dueDate && <p className="text-xs text-slate-400 mt-1">{new Date(task.dueDate).toLocaleDateString()}</p>}
                </div>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="text-slate-400 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {showAddTask && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
            <input
              type="text"
              placeholder="Task title"
              value={newTask.title || ''}
              onChange={e => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
            />
            <input
              type="date"
              value={newTask.dueDate || ''}
              onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
            />
            <select
              value={newTask.priority || 'medium'}
              onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })}
              className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAddTask}
                className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-3 py-2 rounded text-sm"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddTask(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-3 py-2 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Court Dates - Right 40% */}
      <div className="md:col-span-2 lg:col-span-1 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-white">Court Dates</h3>
          <button
            onClick={() => setShowAddDate(true)}
            className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-3 py-1 rounded text-sm"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        <div className="space-y-2">
          {sortedDates.map(date => {
            const days = Math.floor((new Date(date.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const urgencyColor = days < 0 ? 'border-red-600' : days < 7 ? 'border-yellow-600' : days < 30 ? 'border-blue-600' : 'border-slate-600';

            return (
              <div key={date.id} className={`border ${urgencyColor} rounded-lg p-3 hover:bg-slate-800/50`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-white text-sm">{date.title}</h4>
                    <p className="text-gold-500 text-sm">{new Date(date.date).toLocaleDateString()}</p>
                    <p className="text-slate-400 text-xs mt-1 capitalize">{date.type}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteDate(date.id)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {showAddDate && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
            <input
              type="text"
              placeholder="Event title"
              value={newDate.title || ''}
              onChange={e => setNewDate({ ...newDate, title: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
            />
            <input
              type="date"
              value={newDate.date || ''}
              onChange={e => setNewDate({ ...newDate, date: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
            />
            <select
              value={newDate.type || 'hearing'}
              onChange={e => setNewDate({ ...newDate, type: e.target.value as any })}
              className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
            >
              <option value="hearing">Hearing</option>
              <option value="trial">Trial</option>
              <option value="deposition">Deposition</option>
              <option value="mediation">Mediation</option>
              <option value="deadline">Deadline</option>
              <option value="other">Other</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAddDate}
                className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-3 py-2 rounded text-sm"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddDate(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-3 py-2 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
