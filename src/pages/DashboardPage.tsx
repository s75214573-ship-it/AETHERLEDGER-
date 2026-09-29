import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Wallet as WalletIcon,
  TrendingUp,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Activity,
  ChevronRight,
  AlertCircle,
  FileText,
  Gift,
  PlusCircle,
} from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, DocumentSnapshot } from 'firebase/firestore';
import { db, formatCurrency, formatDuration, formatBps } from '../lib/firebase';
import { InvestmentSession, Plan, Transaction, Wallet } from '../types';
import { completeActiveSession, DEFAULT_PLANS } from '../services/ledgerService';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenDeposit,
  onOpenWithdraw,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [activeSessions, setActiveSessions] = useState<InvestmentSession[]>([]);
  const [completedSessionsCount, setCompletedSessionsCount] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [timeNow, setTimeNow] = useState<number>(Date.now());

  // Keep live time ticking every second for countdowns & auto-completion trigger
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Wallet Listener
  useEffect(() => {
    if (!currentUser) return;
    const walletDoc = doc(db, 'wallets', currentUser.uid);
    const unsub = onSnapshot(
      walletDoc,
      (snap) => {
        if (snap.exists()) {
          setWallet(snap.data() as Wallet);
        }
      },
      (error) => {
        console.warn('Dashboard wallet listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Real-time Active Sessions Listener & Automated Completion Worker
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'sessions'),
      where('uid', '==', currentUser.uid),
      where('status', '==', 'active')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: InvestmentSession[] = [];
        snap.forEach((d) => list.push(d.data() as InvestmentSession));
        setActiveSessions(list);

        // Automated maturity check: if any active session's endsAt <= now, auto-complete it!
        const nowMs = Date.now();
        list.forEach((s) => {
          if (new Date(s.endsAt).getTime() <= nowMs) {
            completeActiveSession(s);
          }
        });
      },
      (error) => {
        console.warn('Dashboard active sessions listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser, timeNow]);

  // Real-time Completed Sessions Count
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'sessions'),
      where('uid', '==', currentUser.uid),
      where('status', '==', 'completed')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCompletedSessionsCount(snap.size);
      },
      (error) => {
        console.warn('Dashboard completed sessions listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Real-time Recent Transactions Listener
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'transactions'),
      where('uid', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Transaction[] = [];
        snap.forEach((d) => list.push(d.data() as Transaction));
        setRecentTransactions(list);
      },
      (error) => {
        console.warn('Dashboard transactions listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Real-time Plans Listener
  useEffect(() => {
    const q = query(collection(db, 'plans'), where('enabled', '==', true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const list: Plan[] = [];
          snap.forEach((d) => list.push(d.data() as Plan));
          setPlans(list);
        }
      },
      (error) => {
        console.warn('Dashboard plans listener notice:', error);
      }
    );
    return () => unsub();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-800 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-emerald-500/5 blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
                Institutional Member
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-slate-400">{currentUser?.email}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Welcome, {userProfile?.displayName || 'Investor'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              All financial transactions are verified in real-time through the authoritative Firestore ledger.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenDeposit}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Deposit Funds</span>
            </button>
            <button
              onClick={onOpenWithdraw}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              <span>Withdraw</span>
            </button>
          </div>
        </div>
      </div>

      {/* Account Balance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Available Balance */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Available Balance</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <WalletIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {formatCurrency(wallet?.availableBalance ?? 0)}
          </div>
          <div className="mt-2 text-[11px] text-emerald-400/90 font-medium flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Authoritative ledger verified</span>
          </div>
        </div>

        {/* Locked / In-Session Balance */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Locked / In Sessions</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {formatCurrency(
              (wallet?.lockedBalance ?? 0) +
                activeSessions.reduce((acc, curr) => acc + curr.principal, 0)
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span>{activeSessions.length} active sessions running</span>
          </div>
        </div>

        {/* Completed Sessions */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Completed Sessions</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {completedSessionsCount}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span>Yield successfully settled to wallet</span>
          </div>
        </div>
      </div>

      {/* Active Sessions Live Countdown Widget */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <h2 className="text-base font-bold text-white">Live Active Sessions ({activeSessions.length})</h2>
          </div>
          <button
            onClick={() => onNavigate('sessions')}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeSessions.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">No sessions currently running</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Deploy your balance into an automated session to generate yield.
            </p>
            <button
              onClick={() => onNavigate('plans')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
            >
              Browse Available Plans
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSessions.map((session) => {
              const endsMs = new Date(session.endsAt).getTime();
              const startMs = new Date(session.startedAt).getTime();
              const totalDuration = Math.max(1, endsMs - startMs);
              const remainingMs = Math.max(0, endsMs - timeNow);
              const progressPct = Math.min(
                100,
                Math.max(0, ((totalDuration - remainingMs) / totalDuration) * 100)
              );

              const remSeconds = Math.floor(remainingMs / 1000);
              const hrs = Math.floor(remSeconds / 3600);
              const mins = Math.floor((remSeconds % 3600) / 60);
              const secs = remSeconds % 60;
              const formattedCountdown = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

              return (
                <div
                  key={session.sessionId}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white">{session.planName}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">ID: {session.sessionId}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      LIVE
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 font-mono text-[11px]">Remaining: {formattedCountdown}</span>
                      <span className="font-bold text-emerald-400">{progressPct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-xs pt-1 border-t border-slate-800/60">
                    <span className="text-slate-400">Principal: {formatCurrency(session.principal)}</span>
                    <span className="font-bold text-emerald-300">
                      Matures to: {formatCurrency(session.totalCredit)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Two Column Layout: Available Plans & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Plan Deployment */}
        <div className="lg:col-span-1 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base">Recommended Plans</h3>
            <button
              onClick={() => onNavigate('plans')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              See All
            </button>
          </div>

          <div className="space-y-3">
            {plans.slice(0, 3).map((plan) => (
              <div
                key={plan.id || plan.name}
                onClick={() => onNavigate('plans')}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-emerald-500/40 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                      {plan.name}
                    </h5>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {formatDuration(plan.durationSeconds)} • {formatCurrency(plan.amount)}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-bold text-emerald-400 bg-emerald-500/10">
                    +{formatBps(plan.returnRateBps)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Ledger Transactions */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white text-base">Recent Ledger Records</h3>
            </div>
            <button
              onClick={() => onNavigate('transactions')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              Full Ledger
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No transactions recorded yet in ledger.
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentTransactions.map((tx) => {
                const isCredit = tx.type === 'CREDIT';
                return (
                  <div
                    key={tx.transactionId}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isCredit
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white">{tx.description}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {tx.category} • {new Date(tx.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`font-mono text-sm font-bold ${
                          isCredit ? 'text-emerald-400' : 'text-slate-300'
                        }`}
                      >
                        {isCredit ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </div>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {tx.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
