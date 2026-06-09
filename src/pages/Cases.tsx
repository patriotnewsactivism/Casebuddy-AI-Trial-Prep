import React from 'react';
import { FolderOpen, Plus } from 'lucide-react';

export default function Cases() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="text-blue-400" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-white">Case Manager</h1>
            <p className="text-slate-400 text-sm">Track all active cases, deadlines, witnesses & research</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> New Case
        </button>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
        <FolderOpen className="text-slate-600 mx-auto mb-4" size={48} />
        <div className="text-slate-400 text-lg font-medium">No cases yet</div>
        <div className="text-slate-500 text-sm mt-2 mb-6">Start with an AI Intake to automatically create your first case file</div>
        <a href="/intake" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors inline-block">
          Start AI Intake
        </a>
      </div>
    </div>
  );
}
