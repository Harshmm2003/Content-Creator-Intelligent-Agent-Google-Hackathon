import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  useCampaigns,
  useCreateCampaign,
  useDuplicateCampaign,
  useSoftDeleteCampaign,
  useImportCampaign,
} from '../hooks/useCampaigns';
import { Header } from '../components/Header';
import { CreateCampaignModal } from '../components/CreateCampaignModal';
import { ImportCampaignModal } from '../components/ImportCampaignModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { api } from '../lib/api';
import { Campaign, CampaignExport } from '@/shared/types';
import { formatRelativeTime } from '@/shared/formatters';
import {
  Search,
  Plus,
  Upload,
  Sparkles,
  ArrowUpDown,
  MoreVertical,
  Copy,
  Trash2,
  Download,
  FolderOpen,
  Calendar,
  Layers,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export function CampaignsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Search, Status, Sort preserved directly in URL query params
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const sort = searchParams.get('sort') || 'updatedAt';
  const order = (searchParams.get('order') as 'asc' | 'desc') || 'desc';

  // State modals
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [confirmTrashOpen, setConfirmTrashOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Queries & Mutations
  const { data, isLoading, error, refetch } = useCampaigns({
    search: search || undefined,
    status: status || undefined,
    sort,
    order,
  });

  const createMutation = useCreateCampaign();
  const duplicateMutation = useDuplicateCampaign();
  const softDeleteMutation = useSoftDeleteCampaign();
  const importMutation = useImportCampaign();

  const campaigns = data?.items || [];

  const updateFilter = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === '') {
        next.delete(key);
      } else {
        next.set(key, val);
      }
    }
    setSearchParams(next);
  };

  const handleCreate = async (formData: { name: string }) => {
    const created = await createMutation.mutateAsync(formData);
    // Replace history so Back doesn't return to blank form
    navigate(`/campaigns/${created.id}/brief`, { replace: true });
  };

  const handleExport = async (campaign: Campaign) => {
    try {
      const exportData = await api.exportCampaign(campaign.id);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${campaign.name.replace(/\s+/g, '_')}_export.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    }
  };

  const handleImport = async (exportData: CampaignExport) => {
    const campaign = await importMutation.mutateAsync(exportData);
    navigate(`/campaigns/${campaign.id}/overview`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header / Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Creator Campaigns</h1>
            <p className="text-sm text-slate-400 mt-1">
              End-to-end intelligence: lineup scoring, pre-mortem simulation, briefs, and AI search demand capture.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setImportOpen(true)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <Upload className="w-4 h-4 text-purple-400" />
              Import Campaign
            </button>

            <button
              onClick={() => setCreateOpen(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 mb-6 backdrop-blur-sm flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search campaigns by name..."
              value={search}
              onChange={(e) => updateFilter({ search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0">
            {/* Status Filter */}
            <select
              value={status}
              onChange={(e) => updateFilter({ status: e.target.value })}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>

            {/* Sort Field */}
            <select
              value={sort}
              onChange={(e) => updateFilter({ sort: e.target.value })}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="updatedAt">Sort: Recently Updated</option>
              <option value="createdAt">Sort: Created Date</option>
              <option value="name">Sort: Name</option>
            </select>

            {/* Order toggle */}
            <button
              onClick={() => updateFilter({ order: order === 'asc' ? 'desc' : 'asc' })}
              className="p-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 hover:text-white hover:border-slate-700 transition cursor-pointer"
              title={`Current: ${order.toUpperCase()}`}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Campaign List State: Loading / Empty / Rows */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 bg-slate-900/40 border border-slate-800/60 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center max-w-lg mx-auto">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No campaigns listed</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              No campaigns added yet. Get started by creating your first YouTube creator campaign or importing an existing campaign pack.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setCreateOpen(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                <Plus className="w-4 h-4" />
                Create New Campaign
              </button>
              <button
                onClick={() => refetch()}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Refresh
              </button>
            </div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center max-w-lg mx-auto">
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {search || status ? 'No matching campaigns' : 'No campaigns listed'}
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {search || status
                ? 'No campaigns matched your current search filters.'
                : 'No campaigns added yet. Create your first creator campaign to start discovering channels, running pre-mortems, and generating briefs.'}
            </p>
            {search || status ? (
              <button
                onClick={() => updateFilter({ search: null, status: null })}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer"
              >
                Clear Search & Filters
              </button>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setCreateOpen(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <Plus className="w-4 h-4" />
                  Create First Campaign
                </button>
                <button
                  onClick={() => setImportOpen(true)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-purple-400" />
                  Import JSON
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {campaigns.map((camp) => {
              const statusColor =
                camp.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : camp.status === 'completed'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  : camp.status === 'archived'
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30';

              return (
                <div
                  key={camp.id}
                  className="bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition group flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                      <Link
                        to={`/campaigns/${camp.id}/overview`}
                        className="text-base font-bold text-white hover:text-indigo-400 transition truncate group-hover:underline underline-offset-4"
                      >
                        {camp.name}
                      </Link>

                      <span
                        className={`text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full border ${statusColor}`}
                      >
                        {camp.status}
                      </span>

                      <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        v{camp.version}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        Updated {formatRelativeTime(camp.updatedAt)}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span>Owner: {camp.ownerEmail}</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <Link
                      to={`/campaigns/${camp.id}/overview`}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition"
                    >
                      Open Workspace
                    </Link>

                    {/* Context menu dropdown */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveMenuId(activeMenuId === camp.id ? null : camp.id)
                        }
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === camp.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setActiveMenuId(null)}
                          />
                          <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-30 py-1.5 text-xs animate-in fade-in">
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                duplicateMutation.mutate(camp.id);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800/80 hover:text-white transition text-left cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 text-indigo-400" />
                              Duplicate
                            </button>

                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                handleExport(camp);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:bg-slate-800/80 hover:text-white transition text-left cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-400" />
                              Export JSON
                            </button>

                            <div className="border-t border-slate-800 my-1" />

                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                setSelectedCampaign(camp);
                                setConfirmTrashOpen(true);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:bg-rose-500/10 transition text-left cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Move to Trash
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modals & Dialogs */}
      <CreateCampaignModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <ImportCampaignModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />

      {selectedCampaign && (
        <ConfirmDialog
          isOpen={confirmTrashOpen}
          isDestructive={true}
          title="Move Campaign to Trash?"
          description={`"${selectedCampaign.name}" will be moved to the Trash. You can restore it or permanently delete it later.`}
          confirmLabel="Move to Trash"
          onConfirm={async () => {
            await softDeleteMutation.mutateAsync({
              id: selectedCampaign.id,
              version: selectedCampaign.version,
            });
            setConfirmTrashOpen(false);
            setSelectedCampaign(null);
          }}
          onCancel={() => {
            setConfirmTrashOpen(false);
            setSelectedCampaign(null);
          }}
        />
      )}
    </div>
  );
}
