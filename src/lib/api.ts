import { getIdToken, signOutUser } from './firebase';
import {
  Campaign,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  PaginatedResult,
  CampaignExport,
  Activity,
  Job,
  HealthResponse,
  CampaignBrief,
  CampaignSettings,
  Guideline,
  CandidateCreator,
  BulkCreateCreatorsResponse,
} from '@/shared/types';
import { SplitGuidelineItem } from '@/shared/guidelineSplitter';

export class ApiClientError extends Error {
  public code: string;
  public status: number;
  public details?: any;
  public currentDocument?: any;

  constructor(status: number, code: string, message: string, details?: any, currentDocument?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.currentDocument = currentDocument;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorData: any = {};
    try {
      errorData = await res.json();
    } catch {
      errorData = { error: { message: res.statusText, code: 'HTTP_ERROR' } };
    }

    const err = errorData.error || {};

    if (res.status === 401) {
      // Sign out and forward to login if unauthenticated
      await signOutUser();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?returnTo=${returnTo}`;
      }
    }

    throw new ApiClientError(
      res.status,
      err.code || 'UNKNOWN_ERROR',
      err.message || 'Request failed',
      err.details,
      err.currentDocument
    );
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

export const api = {
  // Health
  getHealth: async (): Promise<HealthResponse> => {
    const res = await fetch('/api/v1/health');
    return await res.json();
  },

  // Campaigns
  listCampaigns: async (params?: {
    status?: string;
    search?: string;
    sort?: string;
    order?: string;
    cursor?: string;
  }): Promise<PaginatedResult<Campaign>> => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set('status', params.status);
    if (params?.search) sp.set('search', params.search);
    if (params?.sort) sp.set('sort', params.sort);
    if (params?.order) sp.set('order', params.order);
    if (params?.cursor) sp.set('cursor', params.cursor);
    return request<PaginatedResult<Campaign>>(`/api/v1/campaigns?${sp.toString()}`);
  },

  listTrashCampaigns: async (): Promise<PaginatedResult<Campaign>> => {
    return request<PaginatedResult<Campaign>>('/api/v1/campaigns/trash');
  },

  getCampaign: async (id: string): Promise<Campaign> => {
    return request<Campaign>(`/api/v1/campaigns/${id}`);
  },

  createCampaign: async (data: CreateCampaignRequest): Promise<Campaign> => {
    return request<Campaign>('/api/v1/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateCampaign: async (id: string, data: UpdateCampaignRequest): Promise<Campaign> => {
    return request<Campaign>(`/api/v1/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  softDeleteCampaign: async (id: string, version: number): Promise<{ success: boolean; campaign: Campaign }> => {
    return request<{ success: boolean; campaign: Campaign }>(`/api/v1/campaigns/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ version }),
    });
  },

  restoreCampaign: async (id: string): Promise<Campaign> => {
    return request<Campaign>(`/api/v1/campaigns/${id}/restore`, {
      method: 'POST',
    });
  },

  permanentDeleteCampaign: async (id: string): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/api/v1/campaigns/${id}/permanent`, {
      method: 'DELETE',
    });
  },

  duplicateCampaign: async (id: string): Promise<Campaign> => {
    return request<Campaign>(`/api/v1/campaigns/${id}/duplicate`, {
      method: 'POST',
    });
  },

  exportCampaign: async (id: string): Promise<CampaignExport> => {
    return request<CampaignExport>(`/api/v1/campaigns/${id}/export`);
  },

  importCampaign: async (data: CampaignExport): Promise<Campaign> => {
    return request<Campaign>('/api/v1/campaigns/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getActivity: async (id: string): Promise<{ items: Activity[] }> => {
    return request<{ items: Activity[] }>(`/api/v1/campaigns/${id}/activity`);
  },

  // ----------------------------------------------------
  // Campaign Brief (Phase 2)
  // ----------------------------------------------------
  getBrief: async (campaignId: string): Promise<{ brief: CampaignBrief | null; version: number }> => {
    return request<{ brief: CampaignBrief | null; version: number }>(`/api/v1/campaigns/${campaignId}/brief`);
  },

  updateBrief: async (
    campaignId: string,
    brief: CampaignBrief,
    version: number
  ): Promise<{ brief: CampaignBrief; version: number; campaign: Campaign }> => {
    return request<{ brief: CampaignBrief; version: number; campaign: Campaign }>(
      `/api/v1/campaigns/${campaignId}/brief`,
      {
        method: 'PUT',
        body: JSON.stringify({ brief, version }),
      }
    );
  },

  patchBrief: async (
    campaignId: string,
    brief: Partial<CampaignBrief>,
    version: number
  ): Promise<{ brief: CampaignBrief; version: number; campaign: Campaign }> => {
    return request<{ brief: CampaignBrief; version: number; campaign: Campaign }>(
      `/api/v1/campaigns/${campaignId}/brief`,
      {
        method: 'PATCH',
        body: JSON.stringify({ brief, version }),
      }
    );
  },

  // ----------------------------------------------------
  // Brand Guidelines (Phase 2)
  // ----------------------------------------------------
  listGuidelines: async (campaignId: string): Promise<{ items: Guideline[]; count: number }> => {
    return request<{ items: Guideline[]; count: number }>(`/api/v1/campaigns/${campaignId}/guidelines`);
  },

  getGuideline: async (campaignId: string, guidelineId: string): Promise<Guideline> => {
    return request<Guideline>(`/api/v1/campaigns/${campaignId}/guidelines/${guidelineId}`);
  },

  createGuideline: async (
    campaignId: string,
    data: { title: string; text: string }
  ): Promise<Guideline> => {
    return request<Guideline>(`/api/v1/campaigns/${campaignId}/guidelines`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateGuideline: async (
    campaignId: string,
    guidelineId: string,
    data: { title?: string; text?: string; active?: boolean; order?: number },
    version: number
  ): Promise<Guideline> => {
    return request<Guideline>(`/api/v1/campaigns/${campaignId}/guidelines/${guidelineId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...data, version }),
    });
  },

  deleteGuideline: async (campaignId: string, guidelineId: string): Promise<{ success: boolean; id: string }> => {
    return request<{ success: boolean; id: string }>(
      `/api/v1/campaigns/${campaignId}/guidelines/${guidelineId}`,
      {
        method: 'DELETE',
      }
    );
  },

  reorderGuidelines: async (campaignId: string, orderedIds: string[]): Promise<{ items: Guideline[] }> => {
    return request<{ items: Guideline[] }>(`/api/v1/campaigns/${campaignId}/guidelines/reorder`, {
      method: 'POST',
      body: JSON.stringify({ orderedIds }),
    });
  },

  importGuidelinesPreview: async (
    campaignId: string,
    text: string
  ): Promise<{ rules: SplitGuidelineItem[]; count: number }> => {
    return request<{ rules: SplitGuidelineItem[]; count: number }>(
      `/api/v1/campaigns/${campaignId}/guidelines/import-text`,
      {
        method: 'POST',
        body: JSON.stringify({ text }),
      }
    );
  },

  confirmImportGuidelines: async (
    campaignId: string,
    rules: { title: string; text: string }[]
  ): Promise<{ items: Guideline[]; addedCount: number }> => {
    return request<{ items: Guideline[]; addedCount: number }>(
      `/api/v1/campaigns/${campaignId}/guidelines/import-text/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({ rules }),
      }
    );
  },

  // ----------------------------------------------------
  // Candidate Creators (Phase 2)
  // ----------------------------------------------------
  listCreators: async (
    campaignId: string,
    params?: { status?: string; selected?: boolean; sort?: string }
  ): Promise<{ items: CandidateCreator[]; count: number }> => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set('status', params.status);
    if (params?.selected !== undefined) sp.set('selected', String(params.selected));
    if (params?.sort) sp.set('sort', params.sort);
    return request<{ items: CandidateCreator[]; count: number }>(
      `/api/v1/campaigns/${campaignId}/creators?${sp.toString()}`
    );
  },

  getCreator: async (campaignId: string, creatorId: string): Promise<CandidateCreator> => {
    return request<CandidateCreator>(`/api/v1/campaigns/${campaignId}/creators/${creatorId}`);
  },

  createCreator: async (campaignId: string, input: string): Promise<CandidateCreator> => {
    return request<CandidateCreator>(`/api/v1/campaigns/${campaignId}/creators`, {
      method: 'POST',
      body: JSON.stringify({ input }),
    });
  },

  bulkCreateCreators: async (
    campaignId: string,
    inputs: string[]
  ): Promise<BulkCreateCreatorsResponse> => {
    return request<BulkCreateCreatorsResponse>(`/api/v1/campaigns/${campaignId}/creators/bulk`, {
      method: 'POST',
      body: JSON.stringify({ inputs }),
    });
  },

  updateCreator: async (
    campaignId: string,
    creatorId: string,
    data: { notes?: string; tags?: string[]; selected?: boolean; plannedPublishDate?: string | null },
    version: number
  ): Promise<CandidateCreator> => {
    return request<CandidateCreator>(`/api/v1/campaigns/${campaignId}/creators/${creatorId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...data, version }),
    });
  },

  deleteCreator: async (campaignId: string, creatorId: string): Promise<{ success: boolean; id: string }> => {
    return request<{ success: boolean; id: string }>(
      `/api/v1/campaigns/${campaignId}/creators/${creatorId}`,
      {
        method: 'DELETE',
      }
    );
  },

  // ----------------------------------------------------
  // Campaign Settings & Members (Phase 2)
  // ----------------------------------------------------
  updateSettings: async (
    campaignId: string,
    settings: CampaignSettings,
    version: number
  ): Promise<{ settings: CampaignSettings; version: number; campaign: Campaign }> => {
    return request<{ settings: CampaignSettings; version: number; campaign: Campaign }>(
      `/api/v1/campaigns/${campaignId}/settings`,
      {
        method: 'PATCH',
        body: JSON.stringify({ settings, version }),
      }
    );
  },

  updateMembers: async (
    campaignId: string,
    memberEmails: string[],
    version: number
  ): Promise<{ memberEmails: string[]; version: number; campaign: Campaign }> => {
    return request<{ memberEmails: string[]; version: number; campaign: Campaign }>(
      `/api/v1/campaigns/${campaignId}/members`,
      {
        method: 'PATCH',
        body: JSON.stringify({ memberEmails, version }),
      }
    );
  },

  // Jobs
  getJob: async (jobId: string): Promise<Job> => {
    return request<Job>(`/api/v1/jobs/${jobId}`);
  },

  cancelJob: async (jobId: string): Promise<Job> => {
    return request<Job>(`/api/v1/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
  },

  getRunningJobs: async (campaignId: string): Promise<{ items: Job[] }> => {
    return request<{ items: Job[] }>(`/api/v1/campaigns/${campaignId}/jobs`);
  },
};
