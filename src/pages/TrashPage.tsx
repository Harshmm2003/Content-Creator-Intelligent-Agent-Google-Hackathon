import React, { useState } from 'react';
import { useTrashCampaigns, useRestoreCampaign, usePermanentDeleteCampaign } from '../hooks/useCampaigns';
import { Header } from '../components/Header';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Campaign } from '@/shared/types';
import { formatRelativeTime } from '@/shared/formatters';
import { Link } from 'react-router-dom';
import { Trash2, RotateCcw, ArrowLeft, AlertTriangle } from 'lucide-react';

export function TrashPage() {
  const { data, isLoading, error } = useTrashCampaigns();
  const restoreMutation = useRestoreCampaign();
  const permDeleteMutation = usePermanentDeleteCampaign();

  const [selectedForPermDelete, setSelectedForPermDelete] = useState<Campaign | null>(null);

  const campaigns = data?.items || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Link to="/campaigns" className="hover:text-indigo-400 transition flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Campaigns
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Trash2 className="w-6 h-6 text-rose-400" />
              Campaign Trash
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Restore soft-deleted campaigns or permanently purge them and their associated datasets.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-900/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-950/30 border border-rose-500/30 rounded-2xl text-center text-rose-300 text-sm">
            Failed to load trash list.
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center max-w-md mx-auto">
            <Trash2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Trash is empty</h3>
            <p className="text-xs text-slate-400">There are no soft-deleted campaigns.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <h3 className="text-sm font-bold text-white">{camp.name}</h3>
                  <div className="text-xs text-slate-400 flex items-center gap-3 mt-1">
                    <span>Deleted {formatRelativeTime(camp.deletedAt || camp.updatedAt)}</span>
                    <span>•</span>
                    <span className="font-mono">v{camp.version}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => restoreMutation.mutate(camp.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                    Restore
                  </button>

                  <button
                    onClick={() => setSelectedForPermDelete(camp)}
                    className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    Delete Permanently
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Strict typed confirmation dialog for permanent deletion */}
      {selectedForPermDelete && (
        <ConfirmDialog
          isOpen={Boolean(selectedForPermDelete)}
          isDestructive={true}
          title="Delete Permanently?"
          description={`This action CANNOT be undone. This will permanently delete the campaign "${selectedForPermDelete.name}" and all associated intelligence subcollections.`}
          confirmLabel="Permanently Delete"
          requiredTypedText={selectedForPermDelete.name}
          onConfirm={async () => {
            await permDeleteMutation.mutateAsync(selectedForPermDelete.id);
            setSelectedForPermDelete(null);
          }}
          onCancel={() => setSelectedForPermDelete(null)}
        />
      )}
    </div>
  );
}
