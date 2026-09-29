import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  CheckCircle2,
  Activity,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, formatCurrency } from '../lib/firebase';
import { InvestmentSession } from '../types';
import { completeActiveSession } from '../services/ledgerService';

interface SessionsPageProps {
  onNavigate: (page: string) => void;
}

export const SessionsPage: React.FC<SessionsPageProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState<InvestmentSession[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [timeNow, setTimeNow] = useState<number>(Date.now());

  // Second-by-second ticker for live countdowns & auto settlement
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Sessions Listener
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'sessions'),
      where('uid', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: InvestmentSession[] = [];
        snap.forEach((d) => list.push(d.data() as InvestmentSession));
        setSessions(list);

        // Check auto completion
        const now = Date.now();
        list.forEach((s) => {
          if (s.status === 'active' && new Date(s.endsAt).getTime() <= now) {
            completeActiveSession(s);
          }
        });
      },
      (error) => {
        console.warn('SessionsPage listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser, timeNow]);

  const filtered = sessions.filter((s) => {
    if (filter === 'active') return s.status === 'active';
    if (filter === 'completed') return s.status === 'completed';
    return true;
  });

  const activeCount = sessions.filter((s) => s.status === 'active').length;
  const completedCount = sessions.filter((s) => s.status === 'completed').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <Activity className="w-4 h-4" />
            <span>Automated Yield Engines</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Financial Sessions</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time tracking of active and matured yield sessions. Automatic settlement executes upon maturity.
          </p>
        </div>

        <button
          onClick={() => onNavigate('plans')}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <span>Start New Session</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            filter === 'active'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Active Tickers ({activeCount})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            filter === 'completed'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Matured History ({completedCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            filter === 'all'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          All Sessions ({sessions.length})
        </button>
      </div>

      {/* Sessions Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 p-8 rounded-2xl bg-slate-900 border border-slate-800">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">No sessions in this view</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-5">
            {filter === 'active'
              ? 'You do not have any sessions currently accumulating yield.'
              : 'No completed session records logged yet.'}
          </p>
          <button
            onClick={() => onNavigate('plans')}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl"
          >
            Explore Available Plans
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((s) => {
            const endsMs = new Date(s.endsAt).getTime();
            const startMs = new Date(s.startedAt).getTime();
            const totalDuration = Math.max(1, endsMs - startMs);
            const remainingMs = Math.max(0, endsMs - timeNow);
            const progressPct =
              s.status === 'completed'
                ? 100
                : Math.min(100, Math.max(0, ((totalDuration - remainingMs) / totalDuration) * 100));

            const remSeconds = Math.floor(remainingMs / 1000);
            const hrs = Math.floor(remSeconds / 3600);
            const mins = Math.floor((remSeconds % 3600) / 60);
            const secs = remSeconds % 60;
            const formattedCountdown = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            return (
              <div
                key={s.sessionId}
                className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        s.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}
                    >
                      {s.status === 'active' ? 'IN PROGRESS' : 'SETTLED & MATURED'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]">
                      {s.sessionId}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white">{s.planName}</h3>

                  {/* Countdown Ticker Box */}
                  <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">
                        {s.status === 'active' ? 'Time Remaining:' : 'Status:'}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          s.status === 'active' ? 'text-emerald-400 text-sm' : 'text-slate-200'
                        }`}
                      >
                        {s.status === 'active' ? formattedCountdown : 'Completed'}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          s.status === 'active'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : 'bg-purple-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Financials */}
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Allocated Capital</span>
                      <span className="font-bold text-white">{formatCurrency(s.principal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Configured Yield</span>
                      <span className="font-bold text-emerald-400">+{formatCurrency(s.configuredReturn)}</span>
                    </div>
                    <div className="border-t border-slate-800 pt-2 flex justify-between font-semibold text-sm">
                      <span className="text-slate-200">Total Settlement</span>
                      <span className="text-emerald-300 font-bold">{formatCurrency(s.totalCredit)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Maturity: {new Date(s.endsAt).toLocaleTimeString()}</span>
                  <div className="flex items-center gap-1 text-emerald-400/90 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Auto-Settling</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
