import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Campaign, CampaignSettings, ScoringWeights, CpmAssumptions } from '@/shared/types';
import {
  useUpdateSettings,
  useUpdateMembers,
  useUpdateCampaign,
  useSoftDeleteCampaign,
} from '../hooks/useCampaigns';
import { useAuth } from '../lib/AuthContext';
import { CONFIG } from '@/shared/config';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Shield,
  Trash2,
  Users,
  Plus,
  X,
  Sliders,
  RotateCcw,
  Save,
  Archive,
  AlertTriangle,
  Lock,
  CheckCircle2,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

export function SettingsPage() {
  const { campaign } = useOutletContext<{ campaign: Campaign }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isOwner = user?.email === campaign.ownerEmail || user?.uid === campaign.ownerId;

  const updateSettingsMutation = useUpdateSettings();
  const updateMembersMutation = useUpdateMembers();
  const updateCampaignMutation = useUpdateCampaign();
  const softDeleteMutation = useSoftDeleteCampaign();

  // Settings state
  const defaultWeights = CONFIG.DEFAULT_SCORING_WEIGHTS;
  const initialSettings: CampaignSettings = campaign.settings || {
    scoringWeights: defaultWeights,
    cpmAssumptions: {
      cpmLow: CONFIG.DEFAULT_CPM_LOW,
      cpmHigh: CONFIG.DEFAULT_CPM_HIGH,
    },
    searchBudgetShare: CONFIG.DEFAULT_SEARCH_BUDGET_SHARE,
  };

  const [weights, setWeights] = useState<ScoringWeights>(initialSettings.scoringWeights);
  const [cpm, setCpm] = useState<CpmAssumptions>(initialSettings.cpmAssumptions);
  const [searchBudgetShare, setSearchBudgetShare] = useState<number>(
    initialSettings.searchBudgetShare
  );
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsError, setSettingsError] = useState<string>('');

  // Members state
  const [members, setMembers] = useState<string[]>(campaign.memberEmails || []);
  const [newEmail, setNewEmail] = useState('');
  const [memberError, setMemberError] = useState('');

  // Danger zone dialogs
  const [trashConfirmOpen, setTrashConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  // Sync settings when campaign updates
  useEffect(() => {
    if (campaign.settings && !settingsDirty) {
      setWeights(campaign.settings.scoringWeights);
      setCpm(campaign.settings.cpmAssumptions);
      setSearchBudgetShare(campaign.settings.searchBudgetShare);
    }
  }, [campaign.settings, settingsDirty]);

  // Sync members
  useEffect(() => {
    setMembers(campaign.memberEmails || []);
  }, [campaign.memberEmails]);

  // Total weight sum calculation
  const totalWeight = weights.brandFit + weights.sentimentFit + weights.authenticityFit;
  const isWeightsValid = totalWeight === 100;

  // Reset weights to defaults
  const handleResetWeights = () => {
    setWeights(defaultWeights);
    setCpm({
      cpmLow: CONFIG.DEFAULT_CPM_LOW,
      cpmHigh: CONFIG.DEFAULT_CPM_HIGH,
    });
    setSearchBudgetShare(CONFIG.DEFAULT_SEARCH_BUDGET_SHARE);
    setSettingsDirty(true);
    setSettingsError('');
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setSettingsError('');
    if (totalWeight !== 100) {
      setSettingsError(`Weights must sum exactly to 100% (currently ${totalWeight}%)`);
      return;
    }
    if (cpm.cpmLow <= 0 || cpm.cpmHigh <= 0) {
      setSettingsError('CPM values must be greater than $0');
      return;
    }
    if (cpm.cpmLow > cpm.cpmHigh) {
      setSettingsError('Low CPM cannot be higher than High CPM');
      return;
    }

    try {
      await updateSettingsMutation.mutateAsync({
        campaignId: campaign.id,
        settings: {
          scoringWeights: weights,
          cpmAssumptions: cpm,
          searchBudgetShare,
        },
        version: campaign.version,
      });
      setSettingsDirty(false);
    } catch {
      // Handled by mutation onError toast
    }
  };

  // Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError('');
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMemberError('Please enter a valid email address');
      return;
    }

    if (email === campaign.ownerEmail.toLowerCase()) {
      setMemberError('Owner email is already included as workspace owner');
      return;
    }

    if (members.includes(email)) {
      setMemberError('This member has already been added');
      return;
    }

    if (members.length >= CONFIG.MAX_MEMBERS_PER_CAMPAIGN) {
      setMemberError(`Maximum of ${CONFIG.MAX_MEMBERS_PER_CAMPAIGN} members allowed`);
      return;
    }

    const nextMembers = [...members, email];
    setMembers(nextMembers);
    setNewEmail('');

    try {
      await updateMembersMutation.mutateAsync({
        campaignId: campaign.id,
        memberEmails: nextMembers,
        version: campaign.version,
      });
    } catch {
      // Handled by toast
    }
  };

  // Remove Member
  const handleRemoveMember = async (emailToRemove: string) => {
    if (!isOwner) return;
    const nextMembers = members.filter((m) => m !== emailToRemove);
    setMembers(nextMembers);

    try {
      await updateMembersMutation.mutateAsync({
        campaignId: campaign.id,
        memberEmails: nextMembers,
        version: campaign.version,
      });
    } catch {
      // Handled by toast
    }
  };

  // Archive Campaign
  const handleArchiveCampaign = async () => {
    await updateCampaignMutation.mutateAsync({
      id: campaign.id,
      data: {
        status: 'archived',
        version: campaign.version,
      },
    });
    setArchiveConfirmOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-white">Campaign Settings & Access</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure discovery scoring weights, financial CPM baselines, team access, and lifecycle status.
        </p>
      </div>

      {/* SECTION 1: Scoring Weights & CPM Assumptions */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Creator Scoring Weights & CPM Baselines</h2>
              <p className="text-xs text-slate-400">
                Override system defaults. Weights must sum to 100%.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetWeights}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Defaults
          </button>
        </div>

        {settingsError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{settingsError}</span>
          </div>
        )}

        {/* Scoring Weights sliders */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">Scoring Dimensions</span>
            <span
              className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-full ${
                isWeightsValid
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              Sum: {totalWeight}% / 100%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Brand Fit */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-300">Brand Fit</span>
                <span className="font-mono text-white font-bold">{weights.brandFit}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={weights.brandFit}
                onChange={(e) => {
                  setWeights({ ...weights, brandFit: Number(e.target.value) });
                  setSettingsDirty(true);
                }}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">Alignment with approved claims</p>
            </div>

            {/* Sentiment Fit */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-300">Sentiment Fit</span>
                <span className="font-mono text-white font-bold">{weights.sentimentFit}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={weights.sentimentFit}
                onChange={(e) => {
                  setWeights({ ...weights, sentimentFit: Number(e.target.value) });
                  setSettingsDirty(true);
                }}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">Audience comment positivity</p>
            </div>

            {/* Authenticity Fit */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-300">Authenticity</span>
                <span className="font-mono text-white font-bold">{weights.authenticityFit}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={weights.authenticityFit}
                onChange={(e) => {
                  setWeights({ ...weights, authenticityFit: Number(e.target.value) });
                  setSettingsDirty(true);
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">Engagement & non-dropoff rates</p>
            </div>
          </div>
        </div>

        {/* CPM & Search Budget assumptions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Low CPM Assumption ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-slate-500 font-mono">$</span>
              <input
                type="number"
                min={1}
                max={500}
                value={cpm.cpmLow}
                onChange={(e) => {
                  setCpm({ ...cpm, cpmLow: Number(e.target.value) });
                  setSettingsDirty(true);
                }}
                className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              High CPM Assumption ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-slate-500 font-mono">$</span>
              <input
                type="number"
                min={1}
                max={500}
                value={cpm.cpmHigh}
                onChange={(e) => {
                  setCpm({ ...cpm, cpmHigh: Number(e.target.value) });
                  setSettingsDirty(true);
                }}
                className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Search Budget Share (0–50%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={50}
                value={searchBudgetShare}
                onChange={(e) => {
                  setSearchBudgetShare(Number(e.target.value));
                  setSettingsDirty(true);
                }}
                className="flex-1 accent-indigo-500 cursor-pointer"
              />
              <span className="font-mono text-xs font-bold text-white w-10 text-right">
                {searchBudgetShare}%
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Allocated to Google AI Max demand capture</p>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={!settingsDirty || !isWeightsValid || updateSettingsMutation.isPending}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition disabled:opacity-40"
          >
            <Save className="w-4 h-4" />
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </section>

      {/* SECTION 2: Collaborator Access Control */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Team Members & Collaborators</h2>
            <p className="text-xs text-slate-400">
              Members can review creators, briefs, and compliance reports. Maximum 10 members.
            </p>
          </div>
        </div>

        {!isOwner && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs rounded-xl flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>You have Member access to this campaign. Only the owner can manage team members.</span>
          </div>
        )}

        {/* Add member form (Owner only) */}
        {isOwner && (
          <div>
            <form onSubmit={handleAddMember} className="flex gap-2">
              <input
                type="email"
                placeholder="colleague@brand.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={members.length >= CONFIG.MAX_MEMBERS_PER_CAMPAIGN}
                className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!newEmail.trim() || members.length >= CONFIG.MAX_MEMBERS_PER_CAMPAIGN}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
                Add Member
              </button>
            </form>
            {memberError && <p className="text-xs text-rose-400 mt-1">{memberError}</p>}
          </div>
        )}

        {/* Member list */}
        <div className="space-y-2">
          {/* Owner row */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{campaign.ownerEmail}</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-semibold">
                Owner
              </span>
            </div>
          </div>

          {/* Members rows */}
          {members.map((member) => (
            <div
              key={member}
              className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="text-slate-300">{member}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-semibold">
                  Member
                </span>
              </div>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member)}
                  className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                  title="Remove Member"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: Danger Zone */}
      <section className="bg-rose-950/10 border border-rose-500/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-rose-500/20 pb-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Danger Zone</h2>
            <p className="text-xs text-rose-300">
              Actions that change the lifecycle status or accessibility of this campaign.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-1">
          {/* Archive Campaign */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Archive Campaign</p>
              <p className="text-xs text-slate-400">
                Puts campaign in read-only status and hides from active dashboard views.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setArchiveConfirmOpen(true)}
              disabled={campaign.status === 'archived'}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-40"
            >
              {campaign.status === 'archived' ? 'Already Archived' : 'Archive Campaign'}
            </button>
          </div>

          <div className="border-t border-rose-500/10" />

          {/* Move to Trash */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Move to Trash</p>
              <p className="text-xs text-slate-400">
                Soft-deletes this campaign. It can be restored anytime from Campaign Trash.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTrashConfirmOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Move to Trash
            </button>
          </div>
        </div>
      </section>

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        isOpen={archiveConfirmOpen}
        title="Archive Campaign?"
        description={`"${campaign.name}" will be marked as archived. You can return it to draft anytime.`}
        confirmLabel="Archive"
        onConfirm={handleArchiveCampaign}
        onCancel={() => setArchiveConfirmOpen(false)}
      />

      {/* Trash Confirmation Dialog */}
      <ConfirmDialog
        isOpen={trashConfirmOpen}
        isDestructive={true}
        title="Move Campaign to Trash?"
        description={`"${campaign.name}" will be soft deleted and moved to your campaign trash.`}
        confirmLabel="Move to Trash"
        onConfirm={async () => {
          await softDeleteMutation.mutateAsync({
            id: campaign.id,
            version: campaign.version,
          });
          setTrashConfirmOpen(false);
          navigate('/campaigns');
        }}
        onCancel={() => setTrashConfirmOpen(false)}
      />
    </div>
  );
}
