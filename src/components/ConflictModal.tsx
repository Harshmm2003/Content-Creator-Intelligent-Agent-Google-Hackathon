import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ConflictModalProps {
  isOpen: boolean;
  onReload: () => void;
  onDismiss: () => void;
}

export function ConflictModal({ isOpen, onReload, onDismiss }: ConflictModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">This was changed by someone else</h3>
            <p className="text-xs text-amber-300">Optimistic concurrency version conflict</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          Another team member or tab has updated this campaign since you loaded it. To prevent
          overwriting changes, please choose how you would like to proceed.
        </p>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
          <button
            onClick={onDismiss}
            className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            Keep editing (resolve manually)
          </button>
          <button
            onClick={onReload}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-600/20"
          >
            <RotateCcw className="w-4 h-4" />
            Reload latest (discard my changes)
          </button>
        </div>
      </div>
    </div>
  );
}
