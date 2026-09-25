import React, { useState, useMemo } from 'react';
import { useOutletContext, Link, useSearchParams } from 'react-router-dom';
import { Campaign, CandidateCreator } from '@/shared/types';
import {
  useCreators,
  useCreateCreator,
  useBulkCreateCreators,
  useUpdateCreator,
  useDeleteCreator,
} from '../hooks/useCampaigns';
import { parseCreatorInput } from '@/shared/creatorInputParser';
import { CONFIG } from '@/shared/config';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Users,
  Plus,
  Search,
  Sparkles,
  ExternalLink,
  Tag,
  FileText,
  Trash2,
  Edit3,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Check,
  ChevronRight,
  Filter,
} from 'lucide-react';

export function CreatorsPage() {
  const { campaign } = useOutletContext<{ campaign: Campaign }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = searchParams.get('status') || '';
  const selectedFilter = searchParams.get('selected') || '';
  const sortBy = searchParams.get('sort') || 'createdAt';
  const searchQuery = searchParams.get('q') || '';

  const { data: creatorsData, isLoading } = useCreators(campaign.id, {
    status: statusFilter || undefined,
    selected: selectedFilter === 'true' ? true : selectedFilter === 'false' ? false : undefined,
    sort: sortBy,
  });

  const bulkCreateMutation = useBulkCreateCreators();
  const updateCreatorMutation = useUpdateCreator();
  const deleteCreatorMutation = useDeleteCreator();

  const creators = creatorsData?.items || [];

  // Filter client side by search query
  const filteredCreators = useMemo(() => {
    if (!searchQuery.trim()) return creators;
    const q = searchQuery.toLowerCase();
    return creators.filter((c) => {
      const inputMatch = c.input.toLowerCase().includes(q);
      const notesMatch = (c.notes || '').toLowerCase().includes(q);
      const tagsMatch = (c.tags || []).some((t) => t.toLowerCase().includes(q));
      return inputMatch || notesMatch || tagsMatch;
    });
  }, [creators, searchQuery]);

  // Bulk Add Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [bulkInputText, setBulkInputText] = useState('');

  // Edit notes/tags modal state
  const [editingCreator, setEditingCreator] = useState<CandidateCreator | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [editDate, setEditDate] = useState<string>('');

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<CandidateCreator | null>(null);

  // Live parsing preview for bulk modal
  const livePreview = useMemo(() => {
    const lines = bulkInputText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const existingKeys = new Set(creators.map((c) => c.normalizedKey));
    const seenBatchKeys = new Set<string>();

    return lines.map((line) => {
      const parsed = parseCreatorInput(line);
      if (!parsed.valid) {
        return {
          original: line,
          status: 'invalid' as const,
          reason: parsed.reason,
        };
      }

      if (existingKeys.has(parsed.normalizedKey)) {
        return {
          original: line,
          status: 'duplicate' as const,
          reason: 'Already in campaign',
          parsed,
        };
      }

      if (seenBatchKeys.has(parsed.normalizedKey)) {
        return {
          original: line,
          status: 'duplicate' as const,
          reason: 'Duplicate in current input list',
          parsed,
        };
      }

      seenBatchKeys.add(parsed.normalizedKey);
      return {
        original: line,
        status: 'valid' as const,
        parsed,
      };
    });
  }, [bulkInputText, creators]);

  const validNewCount = livePreview.filter((p) => p.status === 'valid').length;
  const remainingCapacity = Math.max(0, CONFIG.MAX_CREATORS_PER_CAMPAIGN - creators.length);

  // Handle Bulk Submit
  const handleBulkSubmit = async () => {
    const validInputs = livePreview
      .filter((p) => p.status === 'valid')
      .map((p) => p.original);

    if (validInputs.length === 0) return;

    await bulkCreateMutation.mutateAsync({
      campaignId: campaign.id,
      inputs: validInputs,
    });

    setIsAddModalOpen(false);
    setBulkInputText('');
  };

  // Toggle selection
  const handleToggleSelected = async (creator: CandidateCreator) => {
    await updateCreatorMutation.mutateAsync({
      campaignId: campaign.id,
      creatorId: creator.id,
      data: {
        selected: !creator.selected,
      },
      version: creator.version,
    });
  };

  // Open Edit modal
  const handleOpenEdit = (creator: CandidateCreator) => {
    setEditingCreator(creator);
    setEditNotes(creator.notes || '');
    setEditTags(creator.tags || []);
    setEditDate(creator.plannedPublishDate || '');
    setNewTagInput('');
  };

  // Save Edit modal
  const handleSaveEdit = async () => {
    if (!editingCreator) return;
    await updateCreatorMutation.mutateAsync({
      campaignId: campaign.id,
      creatorId: editingCreator.id,
      data: {
        notes: editNotes.trim(),
        tags: editTags,
        plannedPublishDate: editDate || null,
      },
      version: editingCreator.version,
    });
    setEditingCreator(null);
  };

  const handleAddTag = () => {
    const t = newTagInput.trim().replace(/^#/, '');
    if (t && !editTags.includes(t) && editTags.length < 10) {
      setEditTags([...editTags, t]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditTags(editTags.filter((t) => t !== tagToRemove));
  };

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) {
      next.set(key, val);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white">Candidate Creators</h1>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
              {creators.length} / {CONFIG.MAX_CREATORS_PER_CAMPAIGN} Creators
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Build and curate prospective YouTube creator lineups. Evaluated and scored in Phase 3.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Run Discovery Disabled Button with Tooltip */}
          <div className="relative group">
            <button
              type="button"
              disabled={true}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 border border-slate-800 text-slate-500 rounded-xl text-xs font-semibold cursor-not-allowed opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              Run Discovery
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 px-2.5 py-1 text-[11px] font-medium text-slate-200 bg-slate-900 border border-slate-700 rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
              Available in Phase 3
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            disabled={creators.length >= CONFIG.MAX_CREATORS_PER_CAMPAIGN}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            Add Creators
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => updateParam('q', e.target.value)}
            placeholder="Search creators by channel, handle, note, or tag..."
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => updateParam('q', '')} className="text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => updateParam('status', e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="analyzed">Analyzed</option>
            <option value="error">Error</option>
          </select>

          {/* Selected filter */}
          <select
            value={selectedFilter}
            onChange={(e) => updateParam('selected', e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Lineups</option>
            <option value="true">Selected Only</option>
            <option value="false">Unselected</option>
          </select>

          {/* Sort order */}
          <select
            value={sortBy}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="createdAt">Sort by Date Added</option>
            <option value="plannedPublishDate">Sort by Publish Date</option>
          </select>
        </div>
      </div>

      {/* Creators Table / List */}
      {filteredCreators.length === 0 ? (
        <div className="p-12 border border-dashed border-slate-800 rounded-2xl text-center bg-slate-950/40 space-y-3">
          <Users className="w-10 h-10 text-slate-600 mx-auto" />
          <div>
            <p className="text-base font-semibold text-white">No Candidate Creators Added</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Add creator channel IDs (UC...), @handles, or YouTube channel URLs to populate your prospective evaluation pool.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition cursor-pointer mt-2"
          >
            <Plus className="w-4 h-4" />
            Add First Creators
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCreators.map((creator) => {
            const hasPublishDate = Boolean(creator.plannedPublishDate);

            return (
              <div
                key={creator.id}
                className="bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Left: Selection check & Identifier */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleSelected(creator)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer mt-0.5 shrink-0 ${
                      creator.selected
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/40'
                        : 'border-slate-700 hover:border-slate-500 bg-slate-950 text-transparent'
                    }`}
                    title={creator.selected ? 'Selected for Lineup' : 'Select for Lineup'}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/campaigns/${campaign.id}/creators/${creator.id}?${searchParams.toString()}`}
                        className="text-sm font-bold text-white hover:text-indigo-400 transition truncate max-w-sm"
                      >
                        {creator.input}
                      </Link>

                      {/* Type Badge */}
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                        {creator.inputType}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`font-semibold text-[10px] uppercase px-2 py-0.5 rounded-full ${
                          creator.status === 'analyzed'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : creator.status === 'error'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {creator.status}
                      </span>

                      {creator.selected && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Approved Lineup
                        </span>
                      )}
                    </div>

                    {/* Notes & Tags summary */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                      {creator.notes && (
                        <span className="truncate max-w-md italic text-slate-300">
                          &ldquo;{creator.notes}&rdquo;
                        </span>
                      )}

                      {creator.tags && creator.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          {creator.tags.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 text-[10px]"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      {hasPublishDate && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 font-mono">
                          <Calendar className="w-3 h-3" />
                          {creator.plannedPublishDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(creator)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer"
                    title="Edit Notes & Tags"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Notes/Tags
                  </button>

                  <Link
                    to={`/campaigns/${campaign.id}/creators/${creator.id}?${searchParams.toString()}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-medium transition"
                  >
                    Dossier
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(creator)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition cursor-pointer"
                    title="Remove from campaign"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Creators Modal with Live Parser Preview */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Add Candidate Creators</h3>
                <p className="text-xs text-slate-400">
                  Paste YouTube channel IDs (UC...), handles (@name), or URLs (one per line). Up to {remainingCapacity} more allowed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 flex-1 flex flex-col overflow-y-auto">
              <div>
                <textarea
                  rows={5}
                  value={bulkInputText}
                  onChange={(e) => setBulkInputText(e.target.value)}
                  placeholder={`@mkbhd\nhttps://www.youtube.com/@veritasium\nUCX6OQ3DkcsbYNE6H8uQQuVA\nhttps://youtube.com/c/LinusTechTips`}
                  className="w-full px-3.5 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Live Preview List */}
              {livePreview.length > 0 && (
                <div className="space-y-1.5 flex-1 max-h-56 overflow-y-auto pr-1">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Input Validation Preview ({validNewCount} valid, {livePreview.length - validNewCount} skipped)
                  </p>
                  {livePreview.map((item, idx) => (
                    <div
                      key={idx}
                      className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between border ${
                        item.status === 'valid'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                          : item.status === 'duplicate'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {item.status === 'valid' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        {item.status === 'duplicate' && <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        {item.status === 'invalid' && <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                        <span className="font-mono truncate">{item.original}</span>
                      </div>
                      <span className="text-[10px] shrink-0 font-medium ml-2">
                        {item.status === 'valid'
                          ? `Valid (${(item as any).parsed?.inputType})`
                          : (item as any).reason}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                {validNewCount} creator{validNewCount === 1 ? '' : 's'} ready to add
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkSubmit}
                  disabled={validNewCount === 0 || bulkCreateMutation.isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 disabled:opacity-40"
                >
                  {bulkCreateMutation.isPending ? 'Adding Creators...' : `Add ${validNewCount} Creator${validNewCount === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Notes & Tags Modal */}
      {editingCreator && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Edit Creator Notes & Tags</h3>
                <p className="text-xs text-slate-400 truncate max-w-xs">{editingCreator.input}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCreator(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Internal Notes (0–1,000 characters)
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  maxLength={1000}
                  placeholder="Notes on communication, content format suitability, rates, or past experience..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <div className="text-[10px] text-slate-500 text-right mt-1">
                  {editNotes.length}/1000 characters
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tags (Up to 10)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Add tag (e.g. coffee, outdoor, tech)"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    disabled={editTags.length >= 10 || !newTagInput.trim()}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[30px]">
                  {editTags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-rose-400 p-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Planned Publish Date (Optional)
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingCreator(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={updateCreatorMutation.isPending}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 disabled:opacity-40"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Creator Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        isDestructive={true}
        title="Remove Creator from Campaign?"
        description={`"${deleteTarget?.input}" will be removed from this campaign's candidate pool.`}
        confirmLabel="Remove Creator"
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteCreatorMutation.mutateAsync({
              campaignId: campaign.id,
              creatorId: deleteTarget.id,
            });
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
