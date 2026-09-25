import React, { useEffect } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ToastProvider } from './lib/ToastContext';
import { CampaignsListPage } from './pages/CampaignsListPage';
import { TrashPage } from './pages/TrashPage';
import { LoginPage } from './pages/LoginPage';
import { DemoPage } from './pages/DemoPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CampaignLayout } from './components/CampaignLayout';
import { OverviewPage } from './pages/OverviewPage';
import { BriefPage } from './pages/BriefPage';
import { GuidelinesPage } from './pages/GuidelinesPage';
import { CreatorsPage } from './pages/CreatorsPage';
import { CreatorDetailPage } from './pages/CreatorDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { PhasePlaceholder } from './components/PhasePlaceholder';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 404) return false;
        return failureCount < 2;
      },
    },
  },
});

// Scroll restoration helper
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Protected Route Guard
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}

// Router configuration
const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <RouteErrorBoundary>
        <LoginPage />
      </RouteErrorBoundary>
    ),
  },
  {
    path: '/demo',
    element: (
      <RouteErrorBoundary>
        <DemoPage />
      </RouteErrorBoundary>
    ),
  },
  {
    path: '/',
    element: <Navigate to="/campaigns" replace />,
  },
  {
    path: '/campaigns',
    element: (
      <RequireAuth>
        <RouteErrorBoundary>
          <CampaignsListPage />
        </RouteErrorBoundary>
      </RequireAuth>
    ),
  },
  {
    path: '/campaigns/trash',
    element: (
      <RequireAuth>
        <RouteErrorBoundary>
          <TrashPage />
        </RouteErrorBoundary>
      </RequireAuth>
    ),
  },
  {
    path: '/campaigns/:campaignId',
    element: (
      <RequireAuth>
        <CampaignLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="overview" replace />,
      },
      {
        path: 'overview',
        element: <OverviewPage />,
      },
      {
        path: 'brief',
        element: <BriefPage />,
      },
      {
        path: 'guidelines',
        element: <GuidelinesPage />,
      },
      {
        path: 'creators',
        element: <CreatorsPage />,
      },
      {
        path: 'creators/:creatorId',
        element: <CreatorDetailPage />,
      },
      {
        path: 'premortem',
        element: (
          <PhasePlaceholder
            phase={4}
            title="Pre-Mortem Lineup Risk Simulation"
            description="Run Monte Carlo style scenario simulations on prospective creator lineups before committing budget."
            prerequisite={{ name: 'Candidate Creators', path: 'creators' }}
          />
        ),
      },
      {
        path: 'premortem/runs/:runId',
        element: (
          <PhasePlaceholder
            phase={4}
            title="Pre-Mortem Simulation Run Details"
            description="Detailed failure mode probabilities, mitigation strategies, and suggested lineup swaps."
          />
        ),
      },
      {
        path: 'briefs',
        element: (
          <PhasePlaceholder
            phase={5}
            title="Personalized Creator Briefs Generator"
            description="Generate customized briefs tailored to each creator's unique audience voice while locking core brand safety."
            prerequisite={{ name: 'Pre-Mortem Approval', path: 'premortem' }}
          />
        ),
      },
      {
        path: 'briefs/:creatorId',
        element: (
          <PhasePlaceholder
            phase={5}
            title="Individual Creator Brief View"
            description="Side-by-side brief editor with version history and exportable PDF creator pack."
          />
        ),
      },
      {
        path: 'compliance',
        element: (
          <PhasePlaceholder
            phase={6}
            title="Draft Video Compliance Review"
            description="Analyze creator video drafts, subtitles, and pinned comments against brand safety rubrics."
            prerequisite={{ name: 'Creator Briefs', path: 'briefs' }}
          />
        ),
      },
      {
        path: 'compliance/new',
        element: (
          <PhasePlaceholder
            phase={6}
            title="Submit Creator Video Draft"
            description="Upload or paste unlisted YouTube link for automated multimodal compliance analysis."
          />
        ),
      },
      {
        path: 'compliance/:submissionId',
        element: (
          <PhasePlaceholder
            phase={6}
            title="Compliance Audit Report"
            description="Timestamped risk flags, missing disclosures, and suggested editing revisions."
          />
        ),
      },
      {
        path: 'search-capture',
        element: (
          <PhasePlaceholder
            phase={7}
            title="Google AI Max for Search Demand Capture"
            description="Generate structured campaign pack to intercept organic search demand created by creator videos."
            prerequisite={{ name: 'Compliance Review', path: 'compliance' }}
          />
        ),
      },
      {
        path: 'live',
        element: (
          <PhasePlaceholder
            phase={8}
            title="Live Campaign Pulse & Video Tracking"
            description="Hourly tracking of creator video views, comments, sentiment shifts, and automated risk alerts."
            prerequisite={{ name: 'Search Demand Capture', path: 'search-capture' }}
          />
        ),
      },
      {
        path: 'report',
        element: (
          <PhasePlaceholder
            phase={8}
            title="Executive Campaign Intelligence Report"
            description="Holistic campaign ROI, creator rankings, halo search lift, and post-campaign learnings."
          />
        ),
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
