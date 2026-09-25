import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CONFIG } from '@/shared/config';
import { useToast } from '../lib/ToastContext';

export function useJob(jobId: string | null | undefined, onComplete?: (result: any) => void) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const query = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => (jobId ? api.getJob(jobId) : Promise.reject('No jobId')),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return CONFIG.JOB_POLL_INTERVAL_MS;
      if (data.status === 'running' || data.status === 'queued') {
        return CONFIG.JOB_POLL_INTERVAL_MS;
      }
      return false;
    },
  });

  const job = query.data;

  useEffect(() => {
    if (!job) return;

    if (job.status === 'succeeded') {
      showToast({
        type: 'success',
        title: 'Task Completed',
        message: job.progress?.message || 'Job finished successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['campaign', job.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-activity', job.campaignId] });
      onComplete?.(job.result);
    } else if (job.status === 'failed') {
      showToast({
        type: 'error',
        title: 'Task Failed',
        message: job.error?.message || 'Job execution encountered an error',
      });
    } else if (job.status === 'cancelled') {
      showToast({
        type: 'info',
        title: 'Task Cancelled',
        message: 'Job was cancelled',
      });
    }
  }, [job?.status]);

  const cancelMutation = useMutation({
    mutationFn: () => (jobId ? api.cancelJob(jobId) : Promise.reject('No jobId')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      showToast({
        type: 'info',
        title: 'Cancellation Requested',
        message: 'Stopping background task...',
      });
    },
  });

  return {
    job,
    isLoading: query.isLoading,
    error: query.error,
    cancelJob: cancelMutation.mutate,
    isCancelling: cancelMutation.isPending,
  };
}

export function useCampaignJobs(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-jobs', campaignId],
    queryFn: () => (campaignId ? api.getRunningJobs(campaignId) : Promise.resolve({ items: [] })),
    enabled: Boolean(campaignId),
    refetchInterval: 5000,
  });
}
