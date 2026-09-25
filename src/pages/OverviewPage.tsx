import React, { useState, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Campaign, CampaignStatusType, ALLOWED_STATUS_TRANSITIONS } from '@/shared/types';
import {
  useUpdateCampaign,
  useCampaignActivity,
  useGuidelines,
  useCreators,
} from '../hooks/useCampaigns';
import { getCampaignProgress } from '@/shared/progress';
import { ConflictModal } from '../components/ConflictModal';
import { formatRelativeTime } from '@/shared/formatters';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Edit2,
  Check,
  X,
  Activity as ActivityIcon,
  ShieldAlert,
  Users,
  AlertTriangle,
  Send,
  FileText,
  Search,
  Radio,
  Lock,
} from 'lucide-react';

interface ContextType {
  campaign: Campaign;
}

export function OverviewPage() {
  const { campaign } = useOutletContext<ContextType>();
  const updateMutation = useUpdateCampaign();
  const { data: activityData } = useCampaignActivity(campaign.id);
  const { data: guidelinesData } = useGuidelines(campaign.id);
  const { data: creatorsData } = useCreators(campaign.id);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(campaign.name);
  const [conflictOpen, setConflictOpen] = useState(false);

  const activities = activityData?.items || [];

  // Subcollection counts for progress
  const counts = useMemo(
    () => ({
      activeBrandRulesCount:
        guidelinesData?.items.filter((g) => g.type === 'brand' && g.active).length || 0,
      creatorsCount: creatorsData?.items.length ?? (campaign.approvedLineup?.length || 0),
    }),
    [guidelinesData, creatorsData, campaign.approvedLineup]
  );

  const progressSummary = useMemo(() => {
    return getCampaignProgress(campaign, counts);
  }, [campaign, counts]);

  // Allowed transitions
  const allowedNextStatuses =
    ALLOWED_STATUS_TRANSITIONS[campaign.status as CampaignStatusType] || [];

  const handleNameSave = async () => {
    if (nameValue.trim().length < 3 || nameValue.trim() === campaign.name) {
      setIsEditingName(false);
      setNameValue(campaign.name);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: campaign.id,
        data: {
          name: nameValue.trim(),
          version: campaign.version,
        },
      });
      setIsEditingName(false);
    } catch (err: any) {
      if (err.status === 409) {
        setConflictOpen(true);
      }
    }
  };

  const handleStatusChange = async (newStatus: CampaignStatusType) => {
    try {
      await updateMutation.mutateAsync({
        id: campaign.id,
        data: {
          status: newStatus,
          version: campaign.version,
        },
      });
    } catch (err: any) {
      if (err.status === 409) {
        setConflictOpen(true);
      }
    }
  };

  const nextStep = progressSummary.nextStep;
  const nextStepPath = `/campaigns/${campaign.id}/${nextStep.key}`;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Campaign Header & Status Transition */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-mono">
                Campaign ID: {campaign.id}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-indigo-400 font-mono">v{campaign.version}</span>
            </div>

            {isEditingName ? (
              <div className="flex items-center gap-2 max-w-lg">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-indigo-500 rounded-xl text-lg font-bold text-white focus:outline-none w-full"
                  autoFocus
                />
                <button
                  onClick={handleNameSave}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setNameValue(campaign.name);
                    setIsEditingName(false);
                  }}
                  className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 group">
                <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1.5 text-slate-500 hover:text-indigo-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  title="Rename Campaign"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <p className="text-xs text-slate-400 mt-1">
              Created {formatRelativeTime(campaign.createdAt)} by {campaign.ownerEmail}
            </p>
          </div>

          {/* Status badge & Allowed Status Transitions */}
          <div className="flex flex-col sm:items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Current Status:</span>
              <span className="text-xs uppercase font-mono px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                {campaign.status}
              </span>
            </div>

            {allowedNextStatuses.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 mr-1">Move to:</span>
                {allowedNextStatuses.map((nextStatus) => (
                  <button
                    key={nextStatus}
                    onClick={() => handleStatusChange(nextStatus)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700 text-slate-200 text-xs rounded-lg transition capitalize cursor-pointer font-medium"
                  >
                    → {nextStatus}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hero "Continue where you left off" CTA */}
      <div className="bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border border-indigo-500/30 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-2">
            <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            Next Recommended Step
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{nextStep.name}</h2>
          <p className="text-xs text-slate-300 max-w-xl">
            {nextStep.reason} • {progressSummary.completedStepsCount} of{' '}
            {progressSummary.totalStepsCount} workflow milestones completed ({progressSummary.overallPercent}%).
          </p>
        </div>

        <Link
          to={nextStepPath}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition shadow-lg shadow-indigo-600/30 shrink-0"
        >
          Continue where you left off
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Progress Checklist & Activity Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checklist */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
            <span>Workflow Checklist</span>
            <span className="text-xs text-slate-400 font-normal">
              {progressSummary.overallPercent}% Complete
            </span>
          </h3>

          <div className="space-y-2">
            {progressSummary.steps
              .filter((s) => s.key !== 'settings' && s.key !== 'report')
              .map((step) => {
                const isComplete = step.state === 'complete';
                const isLocked = step.state === 'locked';

                return (
                  <Link
                    key={step.key}
                    to={`/campaigns/${campaign.id}/${step.key}`}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition group ${
                      isLocked
                        ? 'border-slate-900 bg-slate-950/40 opacity-70 hover:border-slate-800'
                        : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          isComplete
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : isLocked
                            ? 'bg-slate-900 text-slate-600 border border-slate-800'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : isLocked ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <span
                          className={`text-xs font-medium block ${
                            isComplete ? 'text-white' : isLocked ? 'text-slate-500' : 'text-slate-200'
                          }`}
                        >
                          {step.name}
                        </span>
                        <span className="text-[11px] text-slate-500 block">{step.reason}</span>
                      </div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition" />
                  </Link>
                );
              })}
          </div>
        </div>

        {/* Recent Activity Stream */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <ActivityIcon className="w-4 h-4 text-indigo-400" />
            Recent Activity
          </h3>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-[360px] pr-1">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-500">No activity logged yet.</p>
            ) : (
              activities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs"
                >
                  <div className="font-semibold text-slate-200 mb-1">{act.summary}</div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate max-w-[130px]">{act.actorEmail}</span>
                    <span>{formatRelativeTime(act.at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Optimistic concurrency conflict modal */}
      <ConflictModal
        isOpen={conflictOpen}
        onReload={() => {
          setConflictOpen(false);
          window.location.reload();
        }}
        onDismiss={() => setConflictOpen(false)}
      />
    </div>
  );
}
