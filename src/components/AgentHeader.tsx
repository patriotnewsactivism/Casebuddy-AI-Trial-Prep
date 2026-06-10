import React from 'react';
import { AgentPersona } from '../agents/personas';

interface AgentHeaderProps {
  agent: AgentPersona;
  subtitle?: string;
  compact?: boolean;
}

export default function AgentHeader({ agent, subtitle, compact = false }: AgentHeaderProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
          {agent.avatar}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm">{agent.name}</span>
            <span className={`text-xs ${agent.textColor}`}>{agent.title}</span>
          </div>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          <span className="text-xs text-slate-400">Available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-r ${agent.color} bg-opacity-10 border border-slate-700 rounded-xl p-5 mb-6`}>
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg`}>
          {agent.emoji}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-white font-bold text-lg">{agent.name}</h2>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 ${agent.textColor} border ${agent.borderColor} border-opacity-40`}>
              {agent.title}
            </span>
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              Online
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">{subtitle || agent.description}</p>
        </div>
      </div>
    </div>
  );
}
