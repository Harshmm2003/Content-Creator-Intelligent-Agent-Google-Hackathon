import React, { useRef, useState } from 'react';
import { CampaignExportSchema, CampaignExport } from '@/shared/types';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';

interface ImportCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: CampaignExport) => Promise<void>;
}

export function ImportCampaignModal({ isOpen, onClose, onImport }: ImportCampaignModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFieldErrors([]);
    setImporting(true);

    try {
      const text = await file.text();
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        setFieldErrors(['The selected file does not contain valid JSON.']);
        setImporting(false);
        return;
      }

      const result = CampaignExportSchema.safeParse(parsedJson);
      if (!result.success) {
        const issues = result.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`);
        setFieldErrors(issues);
        setImporting(false);
        return;
      }

      await onImport(result.data);
      onClose();
    } catch (err: any) {
      setFieldErrors([err.message || 'Import failed. Check JSON format.']);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Import Campaign</h3>
            <p className="text-xs text-slate-400">Restore or clone from an exported JSON file</p>
          </div>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-2xl p-8 text-center cursor-pointer transition bg-slate-950/50 mb-4"
        >
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-200">Click to select campaign JSON</p>
          <p className="text-xs text-slate-400 mt-1">Exported from CCIA v1.0.0</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {importing && (
          <div className="flex items-center justify-center gap-2 py-4 text-purple-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Validating schema and creating campaign...
          </div>
        )}

        {fieldErrors.length > 0 && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 text-xs mb-4 max-h-40 overflow-y-auto">
            <div className="flex items-center gap-1.5 font-semibold text-rose-200 mb-1">
              <AlertCircle className="w-4 h-4" />
              Validation Errors:
            </div>
            <ul className="list-disc pl-4 space-y-1">
              {fieldErrors.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
