import React, { useEffect, useMemo } from 'react';
import { NavLink, useParams, useLocation, Link, Outlet } from 'react-router-dom';
import { useCampaign, useGuidelines, useCreators } from '../hooks/useCampaigns';
import { getCampaignProgress } from '@/shared/progress';
import { Header } from './Header';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import {
  LayoutDashboard,
  FileText,
  ShieldAlert,
  Users,
  AlertTriangle,
  Send,
  CheckCircle,
  Search,
  Activity,
  BarChart3,
  Settings,
  Lock,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

interface StepDef {
  key: string;
  name: string;
  phase: number;
  icon: React.ComponentType<{ className?: string }>;
}

const WORKFLOW_STEPS: StepDef[] = [
  { key: 'overview', name: 'Overview', phase: 1, icon: LayoutDashboard },
  { key: 'brief', name: '1. Brief', phase: 2, icon: FileText },
  { key: 'guidelines', name: '2. Guidelines', phase: 2, icon: ShieldAlert },
  { key: 'creators', name: '3. Creators', phase: 3, icon: Users },
  { key: 'premortem', name: '4. Pre-Mortem', phase: 4, icon: AlertTriangle },
  { key: 'briefs', name: '5. Creator Briefs', phase: 5, icon: Send },
  { key: 'compliance', name: '6. Compliance', phase: 6, icon: CheckCircle },
  { key: 'search-capture', name: '7. Search Capture', phase: 7, icon: Search },
  { key: 'live', name: '8. Live Pulse', phase: 8, icon: Activity },
  { key: 'report', name: 'Campaign Report', phase: 8, icon: BarChart3 },
  { key: 'settings', name: 'Settings', phase: 1, icon: Settings },
];

export function CampaignLayout() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const location = useLocation();
  const { data: campaign, isLoading, error } = useCampaign(campaignId);
  const { data: guidelinesData } = useGuidelines(campaignId);
  const { data: creatorsData } = useCreators(campaignId);

  const counts = useMemo(
    () => ({
      activeBrandRulesCount:
        guidelinesData?.items.filter((g) => g.type === 'brand' && g.active).length || 0,
      creatorsCount: creatorsData?.items.length ?? (campaign?.approvedLineup?.length || 0),
    }),
    [guidelinesData, creatorsData, campaign?.approvedLineup]
  );

  const progress = useMemo(() => {
    return campaign ? getCampaignProgress(campaign, counts) : null;
  }, [campaign, counts]);

  // Set document title with breadcrumbs
  useEffect(() => {
    const currentPath = location.pathname.split('/').pop() || 'overview';
    const step = WORKFLOW_STEPS.find((s) => s.key === currentPath);
    const title = `${step?.name || 'Workflow'} · ${campaign?.name || 'Campaign'} · CCIA`;
    document.title = title;
  }, [location.pathname, campaign?.name]);

  // Current active step index
  const currentStepKey = location.pathname.split('/')[3] || 'overview';
  const currentIndex = WORKFLOW_STEPS.findIndex((s) => s.key === currentStepKey);
  const prevStep = currentIndex > 0 ? WORKFLOW_STEPS[currentIndex - 1] : null;
  const nextStep =
    currentIndex >= 0 && currentIndex < WORKFLOW_STEPS.length - 1
      ? WORKFLOW_STEPS[currentIndex + 1]
      : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading campaign workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Campaign Not Found</h2>
            <p className="text-sm text-slate-400 mb-6">
              The requested campaign does not exist or you do not have permission to view it.
            </p>
            <Link
              to="/campaigns"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition"
            >
              Back to Campaigns List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header currentCampaignId={campaign.id} currentCampaignName={campaign.name} />

      <div className="flex-1 flex flex-col md:flex-row max-w-[1700px] w-full mx-auto">
        {/* Left Workflow Stepper Sidebar */}
        <aside className="w-full md:w-64 lg:w-72 border-r border-slate-800 bg-slate-950/60 p-4 shrink-0 flex flex-col">
          {/* Breadcrumb widget */}
          <div className="mb-4 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Link to="/campaigns" className="hover:text-indigo-400 transition">
                Campaigns
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-white font-medium truncate max-w-[120px]">
                {campaign.name}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white mt-1 truncate">{campaign.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {campaign.status}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">v{campaign.version}</span>
            </div>
          </div>

          {/* Stepper Navigation */}
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2 px-2">
            Intelligence Workflow
          </div>

          <nav className="space-y-1 flex-1 overflow-y-auto">
            {WORKFLOW_STEPS.map((step) => {
              const Icon = step.icon;
              const stepProgress = progress?.steps.find((s) => s.key === step.key);
              const isLocked = stepProgress?.state === 'locked';
              const isComplete = stepProgress?.state === 'complete';

              return (
                <NavLink
                  key={step.key}
                  to={`/campaigns/${campaign.id}/${step.key}`}
                  title={stepProgress?.reason}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : isLocked
                        ? 'text-slate-500 hover:bg-slate-900/60 hover:text-slate-400 opacity-60'
                        : isComplete
                        ? 'text-slate-200 hover:bg-slate-900 hover:text-white'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{step.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    {isComplete && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    {isLocked && (
                      <Lock className="w-3 h-3 text-slate-500" />
                    )}
                  </div>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area with RouteErrorBoundary */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-900/30 p-4 md:p-8">
          <RouteErrorBoundary>
            <div className="flex-1">
              <Outlet context={{ campaign }} />
            </div>

            {/* Stepper Footer Buttons (Prev / Next) */}
            <div className="mt-12 pt-6 border-t border-slate-800/80 flex items-center justify-between">
              {prevStep ? (
                <Link
                  to={`/campaigns/${campaign.id}/${prevStep.key}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-300 hover:text-white text-xs font-medium transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Previous: {prevStep.name}
                </Link>
              ) : (
                <div />
              )}

              {nextStep && (
                <Link
                  to={`/campaigns/${campaign.id}/${nextStep.key}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
                >
                  Next: {nextStep.name}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  );
}
