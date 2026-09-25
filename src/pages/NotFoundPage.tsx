import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2">404</h1>
        <h2 className="text-lg font-bold text-slate-200 mb-2">Page Not Found</h2>
        <p className="text-xs text-slate-400 mb-8 leading-relaxed">
          The requested URL does not match any route in the Creator Campaign Intelligence Agent platform.
        </p>

        <Link
          to="/campaigns"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20"
        >
          <Home className="w-4 h-4" />
          Back to Campaigns
        </Link>
      </div>
    </div>
  );
}
