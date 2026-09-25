import React from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Sparkles, Eye, ArrowRight, CheckCircle2 } from 'lucide-react';

export function DemoPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-12">
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 md:p-12 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-mono font-semibold mb-1">
                Phase 9 Preview
              </div>
              <h1 className="text-2xl font-bold text-white">Interactive Demo Mode</h1>
            </div>
          </div>

          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            Demo Mode operates against pre-recorded YouTube and Gemini fixtures with
            InMemoryRepository, allowing instant review of the full campaign lifecycle without
            consuming API quota or credentials.
          </p>

          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl mb-8 space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Full CRUD operations ready in Phase 1</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Job runner and progress polling ready</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Gemini structured JSON engine configured with repair retries</span>
            </div>
          </div>

          <Link
            to="/campaigns"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30"
          >
            Enter Live Workspace <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
