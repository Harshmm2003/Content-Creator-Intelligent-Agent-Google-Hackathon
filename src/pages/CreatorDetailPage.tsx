import React, { useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useCampaign, useCreator, useUpdateCreator } from '../hooks/useCampaigns';
import {
  ArrowLeft,
  Calendar,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Shield,
  FileText,
  User,
  Clock,
  Layers,
  Save,
} from 'lucide-react';

export function CreatorDetailPage() {
  const { campaignId, creatorId } = useParams<{ campaignId: string; creatorId: string }>();
  const location = useLocation();

  const { data: campaign } = useCampaign(campaignId);
  const { data: creator, isLoading, error } = useCreator(campaignId, creatorId);
  const updateCreatorMutation = useUpdateCreator();

  // Back link preserves query params
  const backHref = `/campaigns/${campaignId}/creators${location.search}`;

  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [plannedDate, setPlannedDate] = useState<string>('');
  const [selected, setSelected] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Sync state once creator loads
  React.useEffect(() => {
    if (creator) {
      setNotes(creator.notes || '');
      setTags(creator.tags || []);
      setPlannedDate(creator.plannedPublishDate || '');
      setSelected(creator.selected);
      setIsDirty(false);
    }
  }, [creator]);

  const handleAddTag = () => {
    const t = newTagInput.trim().replace(/^#/, '');
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags([...tags, t]);
      setNewTagInput('');
      setIsDirty(true);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!creator || !campaignId) return;
    await updateCreatorMutation.mutateAsync({
      campaignId,
      creatorId: creator.id,
      data: {
        notes: notes.trim(),
        tags,
        plannedPublishDate: plannedDate || null,
        selected,
      },
      version: creator.version,
    });
    setIsDirty(false);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Loading creator dossier...</p>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Creator Not Found</h2>
        <p className="text-xs text-slate-400">
          This creator could not be found or was removed from the campaign.
        </p>
        <Link
          to={backHref}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Creators List
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 pb-20">
      {/* Navigation header with Back link preserving filters */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Link
          to={backHref}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-indigo-400 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Candidate Creators
        </Link>

        {isDirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={updateCreatorMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {updateCreatorMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Creator Profile Header Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-lg">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white">{creator.input}</h1>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {creator.inputType}
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {creator.status}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 mt-1">Key: {creator.normalizedKey}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl">
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => {
                  setSelected(e.target.checked);
                  setIsDirty(true);
                }}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
              />
              <span className="font-semibold text-white">Approved for Campaign Lineup</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 text-[11px] block">Added Date</span>
            <span className="text-slate-300 font-mono text-[11px]">
              {new Date(creator.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] block">Planned Publish Date</span>
            <span className="text-slate-300 font-mono text-[11px]">
              {creator.plannedPublishDate || 'Not scheduled'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] block">Document Version</span>
            <span className="text-slate-300 font-mono text-[11px]">v{creator.version}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[11px] block">Analysis Status</span>
            <span className="text-slate-300 font-semibold capitalize text-[11px]">
              {creator.status}
            </span>
          </div>
        </div>
      </div>

      {/* Editable Fields: Notes, Tags, Publish Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Notes */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Campaign Collaboration Notes</h3>
          </div>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setIsDirty(true);
            }}
            placeholder="Add notes regarding audience alignment, sponsorship rates, past video formats, or talking points..."
            maxLength={1000}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
          <div className="text-[10px] text-slate-500 text-right">{notes.length}/1000 characters</div>
        </div>

        {/* Tags & Planned Publish Date */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Planned Publish Date</h3>
            </div>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => {
                setPlannedDate(e.target.value);
                setIsDirty(true);
              }}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Tags ({tags.length}/10)</h3>
            </div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add tag (e.g. coffee, outdoor)"
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={tags.length >= 10 || !newTagInput.trim()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium disabled:opacity-40"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {tags.map((t) => (
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
        </div>
      </div>

      {/* Analysis Dossier Placeholder (Available in Phase 3) */}
      <div className="border border-indigo-500/20 bg-indigo-950/10 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto space-y-1.5">
          <h3 className="text-base font-bold text-white">
            Multi-Dimensional Creator Analysis (Available in Phase 3)
          </h3>
          <p className="text-xs text-slate-400">
            In Phase 3, this dossier will evaluate recent channel uploads using Gemini and YouTube Data APIs across three quantitative dimensions:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-left pt-2">
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-xs font-bold text-indigo-400 block mb-0.5">1. Brand Fit</span>
            <span className="text-[11px] text-slate-400">
              Alignment with approved claims & safe product narratives.
            </span>
          </div>
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-xs font-bold text-emerald-400 block mb-0.5">2. Sentiment Fit</span>
            <span className="text-[11px] text-slate-400">
              Audience comment positivity and toxicity analysis.
            </span>
          </div>
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-xs font-bold text-amber-400 block mb-0.5">3. Authenticity</span>
            <span className="text-[11px] text-slate-400">
              Organic engagement velocity vs sponsored drop-off.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
