import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Shield,
  Key,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Save,
} from 'lucide-react';

interface ProfilePageProps {
  onNavigate: (page: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const { currentUser, userProfile, isAdmin, logout, updateUserProfileData } = useAuth();
  const [displayName, setDisplayName] = useState<string>(userProfile?.displayName || '');
  const [saving, setSaving] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await updateUserProfileData(displayName.trim());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
          <User className="w-4 h-4" />
          <span>Account Credentials</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Profile & Security</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your verified credentials and authentication settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="md:col-span-1 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-slate-950 text-2xl mx-auto shadow-xl">
            {userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}
          </div>

          <div>
            <h3 className="font-bold text-lg text-white">{userProfile?.displayName || 'User'}</h3>
            <p className="text-xs text-slate-400 truncate">{currentUser?.email}</p>
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Role: {userProfile?.role || 'user'}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-slate-800 text-slate-300">
              {userProfile?.status || 'active'}
            </span>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={async () => {
                await logout();
                onNavigate('landing');
              }}
              className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Profile Edit Form */}
        <div className="md:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <h3 className="font-bold text-base text-white">Profile Details</h3>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Profile updated successfully.</span>
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Registered Email (Read-Only)</label>
              <input
                type="text"
                disabled
                value={currentUser?.email || ''}
                className="w-full bg-slate-950/50 border border-slate-800/60 rounded-xl px-3 py-2 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Firebase UID</label>
              <input
                type="text"
                disabled
                value={currentUser?.uid || ''}
                className="w-full bg-slate-950/50 border border-slate-800/60 rounded-xl px-3 py-2 text-slate-500 font-mono text-xs cursor-not-allowed"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
