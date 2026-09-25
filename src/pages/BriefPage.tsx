import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Campaign,
  CampaignBrief,
  CampaignBriefSchema,
  TONE_OPTIONS,
  ToneOption,
} from '@/shared/types';
import { useUpdateBrief } from '../hooks/useCampaigns';
import { getSampleBrief } from '@/shared/sampleBrief';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  FileText,
  Save,
  RotateCcw,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Calendar,
  DollarSign,
  Target,
  Globe,
} from 'lucide-react';

export function BriefPage() {
  const { campaign } = useOutletContext<{ campaign: Campaign }>();
  const updateBriefMutation = useUpdateBrief();

  const initialBrief = useMemo<CampaignBrief>(() => {
    if (campaign.brief) {
      return {
        ...campaign.brief,
        approvedFacts: campaign.brief.approvedFacts || [],
        competitors: campaign.brief.competitors || [],
        bannedTerms: campaign.brief.bannedTerms || [],
        nicheKeywords: campaign.brief.nicheKeywords || [],
        tones: campaign.brief.tones || ['authentic'],
        requiredDisclosures: campaign.brief.requiredDisclosures || {
          descriptionText: '#ad',
          verbalText: `This video is sponsored by ${campaign.brief.brandName || campaign.name}.`,
        },
      };
    }
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    return {
      brandName: campaign.name || '',
      productName: '',
      productCategory: '',
      landingPageUrl: 'https://',
      approvedFacts: [''],
      competitors: [],
      bannedTerms: [],
      nicheKeywords: [],
      targetAudience: '',
      geography: 'US',
      tones: ['authentic'],
      customTone: '',
      budgetUsd: 25000,
      goal: 'consideration',
      launchDate: futureDate.toISOString().split('T')[0],
      requiredDisclosures: {
        descriptionText: '#ad',
        verbalText: `This video is sponsored by ${campaign.name}.`,
      },
    };
  }, [campaign.brief, campaign.name]);

  const [formData, setFormData] = useState<CampaignBrief>(initialBrief);
  const [dirty, setDirty] = useState(false);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Input helper buffers
  const [competitorInput, setCompetitorInput] = useState('');
  const [bannedTermInput, setBannedTermInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  // Sync if campaign prop changes from outside and not dirty
  useEffect(() => {
    if (!dirty) {
      setFormData(initialBrief);
    }
  }, [initialBrief, dirty]);

  // Warn before browser unload if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  const updateField = <K extends keyof CampaignBrief>(field: K, value: CampaignBrief[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-update default verbal disclosure brand name if changed
      if (field === 'brandName') {
        const brand = (value as string) || 'our sponsor';
        if (
          !next.requiredDisclosures?.verbalText ||
          next.requiredDisclosures.verbalText.includes('sponsored by')
        ) {
          next.requiredDisclosures = {
            ...next.requiredDisclosures,
            verbalText: `This video is sponsored by ${brand}.`,
          };
        }
      }
      return next;
    });
    setDirty(true);
    // Clear error for field
    if (errors[field as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  };

  // Facts handlers
  const handleFactChange = (index: number, val: string) => {
    const facts = [...formData.approvedFacts];
    facts[index] = val;
    updateField('approvedFacts', facts);
  };

  const handleAddFact = () => {
    if (formData.approvedFacts.length < 20) {
      updateField('approvedFacts', [...formData.approvedFacts, '']);
    }
  };

  const handleRemoveFact = (index: number) => {
    const facts = formData.approvedFacts.filter((_, i) => i !== index);
    updateField('approvedFacts', facts);
  };

  // Tag list helpers
  const handleAddCompetitor = () => {
    const val = competitorInput.trim();
    if (val && !formData.competitors.includes(val) && formData.competitors.length < 20) {
      updateField('competitors', [...formData.competitors, val]);
      setCompetitorInput('');
    }
  };

  const handleRemoveCompetitor = (item: string) => {
    updateField('competitors', formData.competitors.filter((c) => c !== item));
  };

  const handleAddBannedTerm = () => {
    const val = bannedTermInput.trim();
    if (val && !formData.bannedTerms.includes(val) && formData.bannedTerms.length < 50) {
      updateField('bannedTerms', [...formData.bannedTerms, val]);
      setBannedTermInput('');
    }
  };

  const handleRemoveBannedTerm = (item: string) => {
    updateField('bannedTerms', formData.bannedTerms.filter((b) => b !== item));
  };

  const handleAddKeyword = () => {
    const val = keywordInput.trim();
    if (val && !formData.nicheKeywords.includes(val) && formData.nicheKeywords.length < 10) {
      updateField('nicheKeywords', [...formData.nicheKeywords, val]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (item: string) => {
    updateField('nicheKeywords', formData.nicheKeywords.filter((k) => k !== item));
  };

  const handleToneToggle = (tone: ToneOption) => {
    let nextTones = [...formData.tones];
    if (nextTones.includes(tone)) {
      if (nextTones.length > 1) {
        nextTones = nextTones.filter((t) => t !== tone);
      }
    } else {
      nextTones.push(tone);
    }
    updateField('tones', nextTones);
  };

  // Sample Brief loader
  const handleLoadSample = () => {
    const hasData =
      Boolean(formData.productName) ||
      formData.approvedFacts.some((f) => f.trim().length > 0) ||
      formData.competitors.length > 0;

    if (hasData) {
      setSampleModalOpen(true);
    } else {
      applySampleBrief();
    }
  };

  const applySampleBrief = () => {
    const sample = getSampleBrief();
    setFormData(sample);
    setDirty(true);
    setErrors({});
    setSampleModalOpen(false);
  };

  // Save handler
  const handleSave = async () => {
    // Validate with Zod
    const cleanData = {
      ...formData,
      approvedFacts: formData.approvedFacts.map((f) => f.trim()).filter(Boolean),
    };

    const result = CampaignBriefSchema.safeParse(cleanData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const pathKey = issue.path.join('.');
        if (!fieldErrors[pathKey]) {
          fieldErrors[pathKey] = issue.message;
        }
      }
      setErrors(fieldErrors);
      // Scroll to first error
      window.scrollTo({ top: 100, behavior: 'smooth' });
      return;
    }

    // Launch date in draft check
    if (campaign.status === 'draft' && cleanData.launchDate) {
      const launch = new Date(cleanData.launchDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const launchStart = new Date(launch);
      launchStart.setHours(0, 0, 0, 0);
      if (launchStart.getTime() < today.getTime()) {
        setErrors((prev) => ({
          ...prev,
          launchDate: 'Launch date cannot be in the past while campaign is draft',
        }));
        return;
      }
    }

    try {
      await updateBriefMutation.mutateAsync({
        campaignId: campaign.id,
        brief: result.data,
        version: campaign.version,
      });
      setDirty(false);
      setErrors({});
    } catch {
      // Handled by mutation onError toast
    }
  };

  const handleDiscard = () => {
    setFormData(initialBrief);
    setDirty(false);
    setErrors({});
    setDiscardModalOpen(false);
  };

  const isComplete = Boolean(
    campaign.brief &&
      campaign.brief.brandName &&
      campaign.brief.productName &&
      campaign.brief.approvedFacts &&
      campaign.brief.approvedFacts.length >= 1
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 pb-28">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white">Campaign Brief & Brand Claims</h1>
            {isComplete && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Step Complete
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Define approved product claims, non-negotiable boundaries, and creator compliance parameters.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoadSample}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Load Sample Brief (Portable Espresso)
        </button>
      </div>

      {/* Global Validation Banner */}
      {Object.keys(errors).length > 0 && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-200">Please correct the following errors before saving:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              {Object.entries(errors).map(([key, msg]) => (
                <li key={key}>
                  <span className="font-medium text-rose-200">{key}:</span> {msg}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* SECTION 1: Brand & Product */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
            1
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Brand & Product Details</h2>
            <p className="text-xs text-slate-400">Core offering and verified product claim foundations.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Brand Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={formData.brandName}
              onChange={(e) => updateField('brandName', e.target.value)}
              placeholder="e.g. Outin"
              className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition ${
                errors.brandName ? 'border-rose-500' : 'border-slate-800'
              }`}
            />
            {errors.brandName && <p className="text-[11px] text-rose-400 mt-1">{errors.brandName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Product Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={formData.productName}
              onChange={(e) => updateField('productName', e.target.value)}
              placeholder="e.g. Outin Nano Portable Espresso Machine"
              className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition ${
                errors.productName ? 'border-rose-500' : 'border-slate-800'
              }`}
            />
            {errors.productName && <p className="text-[11px] text-rose-400 mt-1">{errors.productName}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Product Category <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={formData.productCategory}
              onChange={(e) => updateField('productCategory', e.target.value)}
              placeholder="e.g. Outdoor Travel & Coffee Appliances"
              className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition ${
                errors.productCategory ? 'border-rose-500' : 'border-slate-800'
              }`}
            />
            {errors.productCategory && <p className="text-[11px] text-rose-400 mt-1">{errors.productCategory}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Landing Page URL (Secure https://) <span className="text-rose-400">*</span>
            </label>
            <input
              type="url"
              value={formData.landingPageUrl}
              onChange={(e) => updateField('landingPageUrl', e.target.value)}
              placeholder="https://example.com/product"
              className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition ${
                errors.landingPageUrl ? 'border-rose-500' : 'border-slate-800'
              }`}
            />
            {errors.landingPageUrl && (
              <p className="text-[11px] text-rose-400 mt-1">{errors.landingPageUrl}</p>
            )}
          </div>
        </div>

        {/* Approved Product Facts */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="block text-xs font-semibold text-white">
                Approved Product Claims & Facts <span className="text-rose-400">*</span>
              </label>
              <p className="text-[11px] text-slate-400">
                These are the <strong className="text-amber-300 font-semibold">ONLY</strong> claims creator video drafts may state. (1–20 claims, 5–300 characters each)
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddFact}
              disabled={formData.approvedFacts.length >= 20}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Claim
            </button>
          </div>

          <div className="space-y-2.5">
            {formData.approvedFacts.map((fact, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-xs font-mono text-slate-500 pt-2.5 w-6 text-right shrink-0">
                  {idx + 1}.
                </span>
                <div className="flex-1">
                  <textarea
                    rows={2}
                    value={fact}
                    onChange={(e) => handleFactChange(idx, e.target.value)}
                    placeholder="e.g. Delivers up to 20 bars of electric pressure to extract rich crema with commercial quality."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 px-1">
                    <span>{fact.length}/300 characters</span>
                    {fact.length > 0 && fact.length < 5 && (
                      <span className="text-rose-400">Must be at least 5 characters</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFact(idx)}
                  disabled={formData.approvedFacts.length <= 1}
                  className="p-2 text-slate-500 hover:text-rose-400 transition cursor-pointer disabled:opacity-30 pt-2.5"
                  title="Remove claim"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {errors.approvedFacts && (
            <p className="text-[11px] text-rose-400 mt-1">{errors.approvedFacts}</p>
          )}
        </div>
      </section>

      {/* SECTION 2: Audience & Tone */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
            2
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Audience, Tone & Keywords</h2>
            <p className="text-xs text-slate-400">Audience profiling and contextual search targeting.</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Target Audience Description (20–500 chars) <span className="text-rose-400">*</span>
          </label>
          <textarea
            rows={3}
            value={formData.targetAudience}
            onChange={(e) => updateField('targetAudience', e.target.value)}
            placeholder="Describe audience demographics, pain points, motivations, and lifestyle traits..."
            className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition ${
              errors.targetAudience ? 'border-rose-500' : 'border-slate-800'
            }`}
          />
          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>{formData.targetAudience.length} / 500 characters</span>
            {errors.targetAudience && (
              <span className="text-rose-400 font-medium">{errors.targetAudience}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Geography (Country Code)
            </label>
            <input
              type="text"
              value={formData.geography}
              onChange={(e) => updateField('geography', e.target.value.toUpperCase())}
              placeholder="US"
              maxLength={4}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white uppercase placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Custom Tone Addendum (Optional)
            </label>
            <input
              type="text"
              value={formData.customTone || ''}
              onChange={(e) => updateField('customTone', e.target.value)}
              placeholder="e.g. Rugged yet refined, high focus on workflow"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>

        {/* Tone Options Checkboxes */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Primary Tone Directives (Select at least one) <span className="text-rose-400">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {TONE_OPTIONS.map((tone) => {
              const active = formData.tones.includes(tone);
              return (
                <button
                  key={tone}
                  type="button"
                  onClick={() => handleToneToggle(tone)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium text-left capitalize flex items-center justify-between border transition cursor-pointer ${
                    active
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>{tone}</span>
                  {active && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                </button>
              );
            })}
          </div>
          {errors.tones && <p className="text-[11px] text-rose-400 mt-1">{errors.tones}</p>}
        </div>

        {/* Niche Keywords (1–10) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Niche Keywords (1–10 tags) <span className="text-rose-400">*</span>
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
              placeholder="Add keyword tag (e.g. travel coffee, espresso crema)"
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={handleAddKeyword}
              disabled={formData.nicheKeywords.length >= 10 || !keywordInput.trim()}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {formData.nicheKeywords.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs rounded-lg"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(tag)}
                  className="hover:text-rose-400 p-0.5"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {errors.nicheKeywords && (
            <p className="text-[11px] text-rose-400 mt-1">{errors.nicheKeywords}</p>
          )}
        </div>

        {/* Competitors & Banned Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Competitors */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Named Competitors (0–20 names)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={competitorInput}
                onChange={(e) => setCompetitorInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCompetitor())}
                placeholder="Competitor name..."
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddCompetitor}
                disabled={formData.competitors.length >= 20 || !competitorInput.trim()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-40"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[30px]">
              {formData.competitors.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => handleRemoveCompetitor(item)}
                    className="hover:text-rose-400 p-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Banned Terms */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Banned Words or Phrases (0–50 terms)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={bannedTermInput}
                onChange={(e) => setBannedTermInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBannedTerm())}
                placeholder="Banned phrase..."
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddBannedTerm}
                disabled={formData.bannedTerms.length >= 50 || !bannedTermInput.trim()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-40"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[30px]">
              {formData.bannedTerms.map((term) => (
                <span
                  key={term}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-lg"
                >
                  🚫 {term}
                  <button
                    type="button"
                    onClick={() => handleRemoveBannedTerm(term)}
                    className="hover:text-rose-400 p-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Budget & Timing */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
            3
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Budget, Goal & Timing</h2>
            <p className="text-xs text-slate-400">Financial limits, campaign objectives, and timeline.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Budget (USD) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 font-mono">$</span>
              <input
                type="number"
                min={1}
                max={10000000}
                value={formData.budgetUsd || ''}
                onChange={(e) => updateField('budgetUsd', Number(e.target.value))}
                placeholder="25000"
                className={`w-full pl-8 pr-3.5 py-2.5 bg-slate-950 border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition ${
                  errors.budgetUsd ? 'border-rose-500' : 'border-slate-800'
                }`}
              />
            </div>
            {errors.budgetUsd && <p className="text-[11px] text-rose-400 mt-1">{errors.budgetUsd}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Campaign Goal <span className="text-rose-400">*</span>
            </label>
            <select
              value={formData.goal}
              onChange={(e) => updateField('goal', e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer"
            >
              <option value="awareness">Awareness (Brand Reach & Impressions)</option>
              <option value="consideration">Consideration (High Intent & Deep Engagement)</option>
              <option value="conversions">Conversions (Purchases & Landing Page Clicks)</option>
            </select>
            {errors.goal && <p className="text-[11px] text-rose-400 mt-1">{errors.goal}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Planned Launch Date <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              value={formData.launchDate}
              onChange={(e) => updateField('launchDate', e.target.value)}
              className={`w-full px-3.5 py-2.5 bg-slate-950 border rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer ${
                errors.launchDate ? 'border-rose-500' : 'border-slate-800'
              }`}
            />
            {errors.launchDate && (
              <p className="text-[11px] text-rose-400 mt-1">{errors.launchDate}</p>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 4: Required Disclosures */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
            4
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Required Disclosures & Legal Copy</h2>
            <p className="text-xs text-slate-400">
              Mandatory sponsorship phrases automatically inserted into creator briefs and audited by compliance engines.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Video Description Tag
            </label>
            <input
              type="text"
              value={formData.requiredDisclosures?.descriptionText || '#ad'}
              onChange={(e) =>
                updateField('requiredDisclosures', {
                  ...formData.requiredDisclosures,
                  descriptionText: e.target.value,
                })
              }
              placeholder="#ad"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            <p className="text-[11px] text-slate-500 mt-1">Default is &ldquo;#ad&rdquo;.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Verbal Sponsorship Statement
            </label>
            <input
              type="text"
              value={formData.requiredDisclosures?.verbalText || ''}
              onChange={(e) =>
                updateField('requiredDisclosures', {
                  ...formData.requiredDisclosures,
                  verbalText: e.target.value,
                })
              }
              placeholder="This video is sponsored by {brandName}."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Must be spoken aloud near the start of the sponsored segment.
            </p>
          </div>
        </div>
      </section>

      {/* Sticky Save Bar */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-indigo-500/30 p-4 shadow-2xl">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Unsaved changes in Campaign Brief
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDiscardModalOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={updateBriefMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {updateBriefMutation.isPending ? 'Saving...' : 'Save Brief'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Sample Confirmation Dialog */}
      <ConfirmDialog
        isOpen={sampleModalOpen}
        title="Replace with Sample Brief?"
        description="This will overwrite current form values with realistic sample brief data for a portable espresso maker."
        confirmLabel="Load Sample Brief"
        onConfirm={applySampleBrief}
        onCancel={() => setSampleModalOpen(false)}
      />

      {/* Discard Changes Dialog */}
      <ConfirmDialog
        isOpen={discardModalOpen}
        isDestructive={true}
        title="Discard Unsaved Changes?"
        description="All edits made since your last save will be discarded."
        confirmLabel="Discard Changes"
        onConfirm={handleDiscard}
        onCancel={() => setDiscardModalOpen(false)}
      />
    </div>
  );
}
