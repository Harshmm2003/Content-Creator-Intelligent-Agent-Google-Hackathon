import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
import { HealthResponse } from '@/shared/types';
import {
  Sparkles,
  LogOut,
  ChevronDown,
  Trash2,
  FolderOpen,
  Activity,
  Layers,
} from 'lucide-react';

interface HeaderProps {
  currentCampaignId?: string;
  currentCampaignName?: string;
}

export function Header({ currentCampaignId, currentCampaignName }: HeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getHealth()
      .then((h) => {
        if (mounted) setHealth(h);
      })
      .catch((e) => console.error('Health fetch failed:', e));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between">
      {/* Brand & Campaign Switcher */}
      <div className="flex items-center gap-6">
        <Link to="/campaigns" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 group-hover:scale-105 transition">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              Creator Campaign AI
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                P1
              </span>
            </span>
          </div>
        </Link>

        {currentCampaignId && (
          <div className="hidden md:flex items-center gap-2 pl-6 border-l border-slate-800 text-sm">
            <span className="text-slate-500">Campaign:</span>
            <span className="font-semibold text-slate-200 max-w-[200px] truncate">
              {currentCampaignName || currentCampaignId}
            </span>
            <Link
              to="/campaigns"
              className="text-xs text-indigo-400 hover:text-indigo-300 ml-1 underline underline-offset-2"
            >
              Switch
            </Link>
          </div>
        )}
      </div>

      {/* Right controls: Health dot, Demo badge, User Profile */}
      <div className="flex items-center gap-4">
        {health?.demoMode && (
          <div className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Demo Data
          </div>
        )}

        {/* API Health indicator */}
        <div
          title={
            health
              ? `API Status: ${health.status.toUpperCase()} | DB: ${health.database} | Quota: ${health.youtubeQuotaUsedToday}`
              : 'Connecting to API...'
          }
          className="flex items-center gap-1.5 text-xs text-slate-400 cursor-help"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              health?.status === 'ok'
                ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                : health?.status === 'degraded'
                ? 'bg-amber-500 ring-2 ring-amber-500/20'
                : 'bg-rose-500 ring-2 ring-rose-500/20'
            }`}
          />
          <span className="hidden sm:inline font-mono text-[11px]">
            {health?.status === 'ok' ? 'API Online' : 'API Connecting'}
          </span>
        </div>

        {/* User menu */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition cursor-pointer"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-700"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-xs ring-1 ring-indigo-500/40">
                  {user.email ? user.email.slice(0, 1).toUpperCase() : 'U'}
                </div>
              )}
              <span className="text-xs font-medium text-slate-300 hidden md:inline max-w-[120px] truncate">
                {user.displayName || user.email}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-40 py-1.5 text-xs animate-in fade-in">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <p className="font-semibold text-white truncate">{user.displayName || 'Signed In'}</p>
                    <p className="text-slate-400 truncate text-[11px]">{user.email}</p>
                  </div>

                  <Link
                    to="/campaigns"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                    All Campaigns
                  </Link>

                  <Link
                    to="/campaigns/trash"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    Trash & Archive
                  </Link>

                  <div className="border-t border-slate-800 my-1" />

                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                      navigate('/login');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 transition cursor-pointer text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link
            to="/login"
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
