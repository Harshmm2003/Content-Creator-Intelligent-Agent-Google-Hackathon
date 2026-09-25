import React, { useState, useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Campaign, Guideline } from '@/shared/types';
import {
  useGuidelines,
  useCreateGuideline,
  useUpdateGuideline,
  useDeleteGuideline,
  useReorderGuidelines,
  useConfirmImportGuidelines,
} from '../hooks/useCampaigns';
import { api } from '../lib/api';
import { SplitGuidelineItem } from '@/shared/guidelineSplitter';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  FileUp,
  Search,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Lock,
  AlertCircle,
  Eye,
  ArrowRight,
  Info,
} from 'lucide-react';

export function GuidelinesPage() {
  const { campaign } = useOutletContext<{ campaign: Campaign }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  const { data: guidelinesData, isLoading } = useGuidelines(campaign.id);
  const createGuidelineMutation = useCreateGuideline();
  const updateGuidelineMutation = useUpdateGuideline();
  const deleteGuidelineMutation = useDeleteGuideline();
  const reorderMutation = useReorderGuidelines();
  const confirmImportMutation = useConfirmImportGuidelines();

  // Search input handler updating URL
  const handleSearchChange = (val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val.trim()) {
      next.set('q', val);
    } else {
      next.delete('q');
    }
    setSearchParams(next, { replace: true });
  };

  // Drawer / Side Panel State
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState<Guideline | null>(null);
  const [panelTitle, setPanelTitle] = useState('');
  const [panelText, setPanelText] = useState('');
  const [panelErrors, setPanelErrors] = useState<Record<string, string>>({});

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Guideline | null>(null);

  // Import Dialog State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<SplitGuidelineItem[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const guidelines = guidelinesData?.items || [];

  // Split into Brand & Baseline sections
  const brandRules = useMemo(() => {
    return guidelines.filter((g) => g.type === 'brand');
  }, [guidelines]);

  const baselineRules = useMemo(() => {
    return guidelines.filter((g) => g.type === 'baseline');
  }, [guidelines]);

  // Filtered lists
  const filterList = (list: Guideline[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (g) =>
        g.code.toLowerCase().includes(q) ||
        g.title.toLowerCase().includes(q) ||
        g.text.toLowerCase().includes(q)
    );
  };

  const filteredBrandRules = filterList(brandRules);
  const filteredBaselineRules = filterList(baselineRules);

  const activeBrandCount = brandRules.filter((g) => g.active).length;
  const isComplete = activeBrandCount >= 1;

  // Open Drawer for Create
  const handleOpenCreate = () => {
    setEditingGuideline(null);
    setPanelTitle('');
    setPanelText('');
    setPanelErrors({});
    setIsSidePanelOpen(true);
  };

  // Open Drawer for Edit
  const handleOpenEdit = (rule: Guideline) => {
    setEditingGuideline(rule);
    setPanelTitle(rule.title);
    setPanelText(rule.text);
    setPanelErrors({});
    setIsSidePanelOpen(true);
  };

  // Close Drawer
  const handleClosePanel = () => {
    setIsSidePanelOpen(false);
    setEditingGuideline(null);
  };

  // Save Drawer Form
  const handleSavePanel = async (e: React.FormEvent) => {
    e.preventDefault();
    const titleTrimmed = panelTitle.trim();
    const textTrimmed = panelText.trim();
    const errors: Record<string, string> = {};

    if (titleTrimmed.length < 3 || titleTrimmed.length > 100) {
      errors.title = 'Title must be between 3 and 100 characters';
    }
    if (textTrimmed.length < 10 || textTrimmed.length > 3000) {
      errors.text = 'Rule text must be between 10 and 3,000 characters';
    }

    if (Object.keys(errors).length > 0) {
      setPanelErrors(errors);
      return;
    }

    if (editingGuideline) {
      await updateGuidelineMutation.mutateAsync({
        campaignId: campaign.id,
        guidelineId: editingGuideline.id,
        data: {
          title: titleTrimmed,
          text: textTrimmed,
        },
        version: editingGuideline.version,
      });
    } else {
      await createGuidelineMutation.mutateAsync({
        campaignId: campaign.id,
        data: {
          title: titleTrimmed,
          text: textTrimmed,
        },
      });
    }

    handleClosePanel();
  };

  // Active Toggle Handler
  const handleToggleActive = async (rule: Guideline) => {
    await updateGuidelineMutation.mutateAsync({
      campaignId: campaign.id,
      guidelineId: rule.id,
      data: {
        active: !rule.active,
      },
      version: rule.version,
    });
  };

  // Reorder Handlers (move up / down)
  const handleMoveRule = async (rule: Guideline, direction: 'up' | 'down') => {
    const list = rule.type === 'brand' ? brandRules : baselineRules;
    const currentIndex = list.findIndex((g) => g.id === rule.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const reorderedList = [...list];
    const [moved] = reorderedList.splice(currentIndex, 1);
    reorderedList.splice(targetIndex, 0, moved);

    // Merge with the other list to preserve global order IDs
    const otherList = rule.type === 'brand' ? baselineRules : brandRules;
    const fullOrderedIds =
      rule.type === 'brand'
        ? [...reorderedList.map((g) => g.id), ...otherList.map((g) => g.id)]
        : [...otherList.map((g) => g.id), ...reorderedList.map((g) => g.id)];

    await reorderMutation.mutateAsync({
      campaignId: campaign.id,
      orderedIds: fullOrderedIds,
    });
  };

  // Import Text: Preview
  const handlePreviewImport = async () => {
    if (!importText.trim()) return;
    setIsImporting(true);
    setImportError('');
    try {
      const res = await api.importGuidelinesPreview(campaign.id, importText);
      setImportPreview(res.rules);
    } catch (err: any) {
      setImportError(err.message || 'Failed to parse guidelines text');
    } finally {
      setIsImporting(false);
    }
  };

  // Import Text: Confirm & Save
  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    setIsImporting(true);
    try {
      await confirmImportMutation.mutateAsync({
        campaignId: campaign.id,
        rules: importPreview,
      });
      setIsImportModalOpen(false);
      setImportText('');
      setImportPreview(null);
    } catch (err: any) {
      setImportError(err.message || 'Failed to save rules');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white">Brand Safety & Creator Guidelines</h1>
            {isComplete ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Step Complete ({activeBrandCount} active)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                Needs 1 Active Brand Rule
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Establish legal baseline rules and bespoke brand guardrails for automated compliance audits.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <FileUp className="w-4 h-4 text-slate-400" />
            Paste Guidelines
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Brand Rule
          </button>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Filter guidelines by code, title, or keywords..."
          className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => handleSearchChange('')}
            className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* SECTION 1: Brand Rules */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Brand Safety Rules</h2>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-mono font-semibold">
              {brandRules.length} rules
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Custom rules auto-assigned sequential <code className="text-indigo-400">G-1, G-2...</code> codes.
          </p>
        </div>

        {filteredBrandRules.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center bg-slate-950/40 space-y-3">
            <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-white">No Brand Rules Yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Add at least one active brand rule to complete this step, or use &ldquo;Paste Guidelines&rdquo; to import existing compliance policies.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
              >
                Add Rule
              </button>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Paste Policy Text
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredBrandRules.map((rule, idx) => (
              <div
                key={rule.id}
                className={`p-4 rounded-xl border transition flex items-start gap-3 ${
                  rule.active
                    ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/60 border-slate-900 opacity-60'
                }`}
              >
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5 pt-0.5 text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleMoveRule(rule, 'up')}
                    disabled={idx === 0}
                    className="p-1 hover:text-indigo-400 disabled:opacity-20 cursor-pointer"
                    title="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveRule(rule, 'down')}
                    disabled={idx === filteredBrandRules.length - 1}
                    className="p-1 hover:text-indigo-400 disabled:opacity-20 cursor-pointer"
                    title="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Code Pill */}
                <div className="shrink-0 pt-0.5">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {rule.code}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-white truncate">{rule.title}</h3>
                    {!rule.active && (
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        Deactivated
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                    {rule.text}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  {/* Active Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(rule)}
                    className={`w-10 h-5 flex items-center rounded-full p-0.5 transition cursor-pointer ${
                      rule.active ? 'bg-indigo-600' : 'bg-slate-800'
                    }`}
                    title={rule.active ? 'Rule is active' : 'Rule is deactivated'}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
                        rule.active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(rule)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                    title="Edit Rule"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(rule)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 2: Baseline Rules (L-1 through L-7) */}
      <section className="space-y-3 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Baseline Compliance Rules</h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-semibold">
              7 rules
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Permanent legal guardrails. Can be toggled or edited, but not deleted.</span>
          </div>
        </div>

        <div className="space-y-2">
          {filteredBaselineRules.map((rule, idx) => (
            <div
              key={rule.id}
              className={`p-4 rounded-xl border transition flex items-start gap-3 ${
                rule.active
                  ? 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/60 border-slate-900 opacity-60'
              }`}
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5 pt-0.5 text-slate-600">
                <button
                  type="button"
                  onClick={() => handleMoveRule(rule, 'up')}
                  disabled={idx === 0}
                  className="p-1 hover:text-indigo-400 disabled:opacity-20 cursor-pointer"
                  title="Move up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveRule(rule, 'down')}
                  disabled={idx === filteredBaselineRules.length - 1}
                  className="p-1 hover:text-indigo-400 disabled:opacity-20 cursor-pointer"
                  title="Move down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Code Pill */}
              <div className="shrink-0 pt-0.5">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {rule.code}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-white truncate">{rule.title}</h3>
                  {!rule.active && (
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      Deactivated
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                  {rule.text}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                {/* Active Toggle Switch */}
                <button
                  type="button"
                  onClick={() => handleToggleActive(rule)}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition cursor-pointer ${
                    rule.active ? 'bg-indigo-600' : 'bg-slate-800'
                  }`}
                  title={rule.active ? 'Rule is active' : 'Rule is deactivated'}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
                      rule.active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(rule)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  title="Edit Rule Text"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                {/* Non-deletable notice tooltip icon */}
                <div
                  className="p-1.5 text-slate-600 cursor-not-allowed"
                  title="Baseline rules cannot be deleted (deactivate to disable)"
                >
                  <Lock className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Side Panel / Drawer for Add / Edit */}
      {isSidePanelOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingGuideline ? `Edit Rule (${editingGuideline.code})` : 'New Brand Guideline'}
                </h3>
                <p className="text-xs text-slate-400">
                  {editingGuideline
                    ? `Update rule definition for ${editingGuideline.code}`
                    : 'Create a specific compliance standard for this campaign.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClosePanel}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePanel} className="flex-1 flex flex-col justify-between py-6 space-y-4 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Rule Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={panelTitle}
                    onChange={(e) => setPanelTitle(e.target.value)}
                    placeholder="e.g. Strict Water Resistance Demonstrations Only"
                    maxLength={100}
                    className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition ${
                      panelErrors.title ? 'border-rose-500' : 'border-slate-800'
                    }`}
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>{panelTitle.length}/100 characters</span>
                    {panelErrors.title && (
                      <span className="text-rose-400">{panelErrors.title}</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Guideline Rule Text <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={8}
                    value={panelText}
                    onChange={(e) => setPanelText(e.target.value)}
                    placeholder="Describe exactly what creators must or must not say or demonstrate in their videos..."
                    maxLength={3000}
                    className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition ${
                      panelErrors.text ? 'border-rose-500' : 'border-slate-800'
                    }`}
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>{panelText.length}/3,000 characters</span>
                    {panelErrors.text && (
                      <span className="text-rose-400">{panelErrors.text}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleClosePanel}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createGuidelineMutation.isPending || updateGuidelineMutation.isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {editingGuideline ? 'Update Rule' : 'Save Guideline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Paste Guidelines Modal with Preview */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Import Guidelines from Text</h3>
                <p className="text-xs text-slate-400">
                  Paste bullet points, policy docs, or numbered guidelines. They will be parsed automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {importError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {!importPreview ? (
              <div className="space-y-3 flex-1 flex flex-col">
                <textarea
                  rows={10}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="1. Competitor mentions: Do not show competitor logos in the frame.&#10;2. Brewing temperature: Must show thermometer showing 92°C brew temperature.&#10;3. Safety notice: Do not operate while moving in a moving vehicle..."
                  className="w-full flex-1 px-3.5 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Deterministic parsing splits rules by headers and numbered lines (max 300 words per rule).</span>
                  <button
                    type="button"
                    onClick={handlePreviewImport}
                    disabled={!importText.trim() || isImporting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-40"
                  >
                    <Eye className="w-4 h-4" />
                    {isImporting ? 'Parsing...' : 'Preview Rules'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl text-xs text-indigo-300">
                  <span>Parsed {importPreview.length} separate rules. Review preview before saving:</span>
                  <button
                    type="button"
                    onClick={() => setImportPreview(null)}
                    className="text-xs font-semibold text-slate-300 hover:text-white underline"
                  >
                    Edit Raw Text
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {importPreview.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
                          G-New
                        </span>
                        <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-3">{item.text}</p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isImporting ? 'Saving...' : `Confirm & Save ${importPreview.length} Rules`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Rule Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        isDestructive={true}
        title={`Delete Brand Guideline "${deleteTarget?.code}"?`}
        description={`"${deleteTarget?.title}" will be permanently removed. The code ${deleteTarget?.code} will not be reused.`}
        confirmLabel="Delete Rule"
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteGuidelineMutation.mutateAsync({
              campaignId: campaign.id,
              guidelineId: deleteTarget.id,
            });
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
