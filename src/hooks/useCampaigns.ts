import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  CreateCampaignRequest,
  UpdateCampaignRequest,
  CampaignExport,
  CampaignBrief,
  CampaignSettings,
  Guideline,
  CandidateCreator,
} from '@/shared/types';
import { useToast } from '../lib/ToastContext';

export function useCampaigns(params?: {
  status?: string;
  search?: string;
  sort?: string;
  order?: string;
  cursor?: string;
}) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: () => api.listCampaigns(params),
  });
}

export function useTrashCampaigns() {
  return useQuery({
    queryKey: ['campaigns', 'trash'],
    queryFn: () => api.listTrashCampaigns(),
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: () => (id ? api.getCampaign(id) : Promise.reject('No ID provided')),
    enabled: Boolean(id),
  });
}

export function useCampaignActivity(id: string | undefined) {
  return useQuery({
    queryKey: ['campaign-activity', id],
    queryFn: () => (id ? api.getActivity(id) : Promise.resolve({ items: [] })),
    enabled: Boolean(id),
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data: CreateCampaignRequest) => api.createCampaign(data),
    onSuccess: (newCampaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      showToast({
        type: 'success',
        title: 'Campaign Created',
        message: `"${newCampaign.name}" was successfully initialized.`,
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Creation Failed',
        message: err.message || 'Unable to create campaign.',
      });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCampaignRequest }) =>
      api.updateCampaign(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-activity', updated.id] });
      showToast({
        type: 'success',
        title: 'Campaign Updated',
        message: 'Changes saved successfully.',
      });
    },
    onError: (err: any) => {
      if (err.status === 409) {
        // Concurrency handling will be triggered by dialog
        return;
      }
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Unable to update campaign.',
      });
    },
  });
}

export function useSoftDeleteCampaign() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.softDeleteCampaign(id, version),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      showToast({
        type: 'info',
        title: 'Campaign Moved to Trash',
        message: `Campaign was moved to trash.`,
        action: {
          label: 'Undo Restore',
          onClick: async () => {
            try {
              await api.restoreCampaign(variables.id);
              queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            } catch (e: any) {
              showToast({
                type: 'error',
                title: 'Restore Failed',
                message: e.message || 'Could not restore.',
              });
            }
          },
        },
      });
    },
  });
}

export function useRestoreCampaign() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.restoreCampaign(id),
    onSuccess: (restored) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      showToast({
        type: 'success',
        title: 'Campaign Restored',
        message: `"${restored.name}" has been restored from trash.`,
      });
    },
  });
}

export function usePermanentDeleteCampaign() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.permanentDeleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'trash'] });
      showToast({
        type: 'success',
        title: 'Permanently Deleted',
        message: 'Campaign and all associated data permanently removed.',
      });
    },
  });
}

export function useDuplicateCampaign() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.duplicateCampaign(id),
    onSuccess: (duplicate) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      showToast({
        type: 'success',
        title: 'Campaign Duplicated',
        message: `Created "${duplicate.name}".`,
      });
    },
  });
}

export function useImportCampaign() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (exportData: CampaignExport) => api.importCampaign(exportData),
    onSuccess: (imported) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      showToast({
        type: 'success',
        title: 'Campaign Imported',
        message: `Successfully imported "${imported.name}".`,
      });
    },
  });
}

// ----------------------------------------------------
// Brief Hooks
// ----------------------------------------------------
export function useBrief(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-brief', campaignId],
    queryFn: () => (campaignId ? api.getBrief(campaignId) : Promise.reject('No campaign ID')),
    enabled: Boolean(campaignId),
  });
}

export function useUpdateBrief() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({
      campaignId,
      brief,
      version,
    }: {
      campaignId: string;
      brief: CampaignBrief;
      version: number;
    }) => api.updateBrief(campaignId, brief, version),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-brief', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-activity', variables.campaignId] });
      showToast({
        type: 'success',
        title: 'Brief Saved',
        message: 'Campaign brief and approved claims updated.',
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not save brief.',
      });
    },
  });
}

export function usePatchBrief() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({
      campaignId,
      brief,
      version,
    }: {
      campaignId: string;
      brief: Partial<CampaignBrief>;
      version: number;
    }) => api.patchBrief(campaignId, brief, version),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-brief', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      showToast({
        type: 'success',
        title: 'Brief Updated',
        message: 'Brief updates saved.',
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update brief.',
      });
    },
  });
}

// ----------------------------------------------------
// Guidelines Hooks
// ----------------------------------------------------
export function useGuidelines(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-guidelines', campaignId],
    queryFn: () => (campaignId ? api.listGuidelines(campaignId) : Promise.resolve({ items: [], count: 0 })),
    enabled: Boolean(campaignId),
  });
}

export function useCreateGuideline() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ campaignId, data }: { campaignId: string; data: { title: string; text: string } }) =>
      api.createGuideline(campaignId, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-guidelines', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      showToast({
        type: 'success',
        title: 'Guideline Added',
        message: `Created ${data.code}: "${data.title}"`,
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Creation Failed',
        message: err.message || 'Unable to add guideline.',
      });
    },
  });
}

export function useUpdateGuideline() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({
      campaignId,
      guidelineId,
      data,
      version,
    }: {
      campaignId: string;
      guidelineId: string;
      data: { title?: string; text?: string; active?: boolean; order?: number };
      version: number;
    }) => api.updateGuideline(campaignId, guidelineId, data, version),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-guidelines', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      showToast({
        type: 'success',
        title: 'Guideline Updated',
        message: `Saved changes to ${data.code}.`,
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update guideline.',
      });
    },
  });
}

export function useDeleteGuideline() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ campaignId, guidelineId }: { campaignId: string; guidelineId: string }) =>
      api.deleteGuideline(campaignId, guidelineId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-guidelines', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      showToast({
        type: 'info',
        title: 'Guideline Removed',
        message: 'Brand rule deleted.',
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not delete guideline.',
      });
    },
  });
}

export function useReorderGuidelines() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, orderedIds }: { campaignId: string; orderedIds: string[] }) =>
      api.reorderGuidelines(campaignId, orderedIds),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-guidelines', variables.campaignId] });
    },
  });
}

export function useConfirmImportGuidelines() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({
      campaignId,
      rules,
    }: {
      campaignId: string;
      rules: { title: string; text: string }[];
    }) => api.confirmImportGuidelines(campaignId, rules),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-guidelines', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      showToast({
        type: 'success',
        title: 'Guidelines Imported',
        message: `Successfully imported ${data.addedCount} rules.`,
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Import Failed',
        message: err.message || 'Could not import rules.',
      });
    },
  });
}

// ----------------------------------------------------
// Creators Hooks
// ----------------------------------------------------
export function useCreators(
  campaignId: string | undefined,
  params?: { status?: string; selected?: boolean; sort?: string }
) {
  return useQuery({
    queryKey: ['campaign-creators', campaignId, params],
    queryFn: () => (campaignId ? api.listCreators(campaignId, params) : Promise.resolve({ items: [], count: 0 })),
    enabled: Boolean(campaignId),
  });
}

export function useCreator(campaignId: string | undefined, creatorId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-creator', campaignId, creatorId],
    queryFn: () =>
      campaignId && creatorId ? api.getCreator(campaignId, creatorId) : Promise.reject('Missing params'),
    enabled: Boolean(campaignId && creatorId),
  });
}

export function useCreateCreator() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ campaignId, input }: { campaignId: string; input: string }) =>
      api.createCreator(campaignId, input),
    onSuccess: (creator, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-creators', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      showToast({
        type: 'success',
        title: 'Creator Added',
        message: `Added ${creator.input}`,
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Add Failed',
        message: err.message || 'Could not add creator.',
      });
    },
  });
}

export function useBulkCreateCreators() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ campaignId, inputs }: { campaignId: string; inputs: string[] }) =>
      api.bulkCreateCreators(campaignId, inputs),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-creators', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      showToast({
        type: 'success',
        title: 'Creators Added',
        message: `Added ${res.addedCount} creators (${res.duplicateCount} duplicates, ${res.invalidCount} invalid).`,
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Bulk Add Failed',
        message: err.message || 'Could not add creators.',
      });
    },
  });
}

export function useUpdateCreator() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({
      campaignId,
      creatorId,
      data,
      version,
    }: {
      campaignId: string;
      creatorId: string;
      data: { notes?: string; tags?: string[]; selected?: boolean; plannedPublishDate?: string | null };
      version: number;
    }) => api.updateCreator(campaignId, creatorId, data, version),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-creators', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-creator', variables.campaignId, variables.creatorId] });
      showToast({
        type: 'success',
        title: 'Creator Updated',
        message: 'Details updated.',
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update creator.',
      });
    },
  });
}

export function useDeleteCreator() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ campaignId, creatorId }: { campaignId: string; creatorId: string }) =>
      api.deleteCreator(campaignId, creatorId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-creators', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      showToast({
        type: 'info',
        title: 'Creator Removed',
        message: 'Creator removed from campaign.',
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not delete creator.',
      });
    },
  });
}

// ----------------------------------------------------
// Settings & Members Hooks
// ----------------------------------------------------
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({
      campaignId,
      settings,
      version,
    }: {
      campaignId: string;
      settings: CampaignSettings;
      version: number;
    }) => api.updateSettings(campaignId, settings, version),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      showToast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Scoring weights, CPM assumptions, and search budget saved.',
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Settings Update Failed',
        message: err.message || 'Could not save settings.',
      });
    },
  });
}

export function useUpdateMembers() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({
      campaignId,
      memberEmails,
      version,
    }: {
      campaignId: string;
      memberEmails: string[];
      version: number;
    }) => api.updateMembers(campaignId, memberEmails, version),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      showToast({
        type: 'success',
        title: 'Members Updated',
        message: 'Team members list updated.',
      });
    },
    onError: (err: any) => {
      showToast({
        type: 'error',
        title: 'Members Update Failed',
        message: err.message || 'Could not update members.',
      });
    },
  });
}
