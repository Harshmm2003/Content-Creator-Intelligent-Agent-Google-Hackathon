import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateCampaignRequestSchema, CreateCampaignRequest } from '@/shared/types';
import { Loader2, Plus, Sparkles } from 'lucide-react';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCampaignRequest) => Promise<void>;
}

export function CreateCampaignModal({ isOpen, onClose, onSubmit }: CreateCampaignModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCampaignRequest>({
    resolver: zodResolver(CreateCampaignRequestSchema),
    defaultValues: {
      name: '',
    },
  });

  if (!isOpen) return null;

  const handleFormSubmit = async (data: CreateCampaignRequest) => {
    setSubmitting(true);
    try {
      await onSubmit(data);
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Create New Campaign</h3>
            <p className="text-xs text-slate-400">Initialize a YouTube intelligence workflow</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="mb-6">
            <label htmlFor="campaign-name-input" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Campaign Name
            </label>
            <input
              id="campaign-name-input"
              {...register('name')}
              type="text"
              placeholder="e.g. Q3 Smart Home Creator Launch"
              autoFocus
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
            {errors.name && (
              <p className="mt-1.5 text-xs text-rose-400">{errors.name.message}</p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Between 3 and 80 characters. You can update this at any time in Campaign Overview.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={submitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Campaign
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
