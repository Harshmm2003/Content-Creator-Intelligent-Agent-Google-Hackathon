import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, Construction, ArrowLeft, ArrowRight } from 'lucide-react';

interface PhasePlaceholderProps {
  phase: number;
  title: string;
  description: string;
  prerequisite?: {
    name: string;
    path: string;
  };
}

export function PhasePlaceholder({
  phase,
  title,
  description,
  prerequisite,
}: PhasePlaceholderProps) {
  const location = useLocation();

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 md:p-12 relative overflow-hidden backdrop-blur-md shadow-2xl">
        <div className="absolute top-0 right-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 text-xs font-mono font-semibold mb-1">
              Coming in Phase {phase}
            </div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
          </div>
        </div>

        <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-8 max-w-2xl">
          {description}
        </p>

        {prerequisite && (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 mb-8 max-w-xl">
            <div className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">
              Prerequisite
            </div>
            <p className="text-sm text-slate-300 mb-3">
              This workflow step builds directly on insights generated in{' '}
              <span className="text-indigo-400 font-semibold">{prerequisite.name}</span>.
            </p>
            <Link
              to={prerequisite.path}
              className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
            >
              Complete {prerequisite.name} First <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        <div className="flex items-center gap-3 pt-6 border-t border-slate-800 text-xs text-slate-500">
          <Construction className="w-4 h-4 text-amber-400" />
          <span>Architecture, data models, and API foundations are pre-configured for Phase {phase}.</span>
        </div>
      </div>
    </div>
  );
}
