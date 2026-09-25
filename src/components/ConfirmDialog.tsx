import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  requiredTypedText?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  requiredTypedText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isMatch = requiredTypedText ? typedValue === requiredTypedText : true;

  const handleConfirm = async () => {
    if (!isMatch) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      setTypedValue('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          {isDestructive ? (
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          ) : null}
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
        </div>

        <p className="text-sm text-slate-300 mb-4 leading-relaxed">{description}</p>

        {requiredTypedText && (
          <div className="mb-6">
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">
              To verify, type <span className="text-white font-mono font-semibold">{requiredTypedText}</span> below:
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={requiredTypedText}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500 transition font-mono"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setTypedValue('');
              onCancel();
            }}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isMatch || loading}
            className={`px-4 py-2 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
