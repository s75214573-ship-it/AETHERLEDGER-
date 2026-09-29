import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Shield,
  Zap,
  ArrowRight,
  TrendingUp,
  X,
  Lock,
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, DocumentSnapshot } from 'firebase/firestore';
import { db, formatCurrency, formatDuration, formatBps } from '../lib/firebase';
import { Plan, Wallet } from '../types';
import { purchasePlan, DEFAULT_PLANS } from '../services/ledgerService';

interface PlansPageProps {
  onNavigate: (page: string) => void;
  onOpenDeposit: () => void;
}

export const PlansPage: React.FC<PlansPageProps> = ({ onNavigate, onOpenDeposit }) => {
  const { currentUser } = useAuth();
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [confirmTerms, setConfirmTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSessionId, setSuccessSessionId] = useState<string | null>(null);

  // Real-time Plans
  useEffect(() => {
    const q = query(collection(db, 'plans'), where('enabled', '==', true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const list: Plan[] = [];
          snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Plan));
          setPlans(list);
        }
      },
      (error) => {
        console.warn('Plans listener notice:', error);
      }
    );
    return () => unsub();
  }, []);

  // Real-time Wallet
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
        console.warn('PlansPage wallet listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser]);

  const handleStartPurchase = (plan: Plan) => {
    setSelectedPlan(plan);
    setConfirmTerms(false);
    setError(null);
    setSuccessSessionId(null);
  };

  const handleConfirmPurchase = async () => {
    if (!currentUser || !selectedPlan) return;
    if (!confirmTerms) {
      setError('Please accept the session participation terms to proceed.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await purchasePlan(currentUser.uid, selectedPlan);
    setSubmitting(false);

    if (result.success && result.sessionId) {
      setSuccessSessionId(result.sessionId);
    } else {
      setError(result.error || 'Failed to activate session.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>Yield Session Catalog</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Available Sessions</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Choose a structured liquidity allocation plan. All session maturities and configured return rates
            are programmatically settled into your wallet ledger.
          </p>
        </div>

        {/* User Balance Chip */}
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">Available Balance</span>
            <span className="font-bold text-emerald-400 text-sm">
              {formatCurrency(wallet?.availableBalance ?? 0)}
            </span>
          </div>
          <button
            onClick={onOpenDeposit}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors"
          >
            + Add Funds
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const configuredReturn = Math.floor((plan.amount * plan.returnRateBps) / 10000);
          const totalCredit = plan.amount + configuredReturn;
          const hasBalance = (wallet?.availableBalance ?? 0) >= plan.amount;

          return (
            <div
              key={plan.id || plan.name}
              className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all flex flex-col justify-between relative shadow-lg group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-semibold text-[11px]">
                    {formatDuration(plan.durationSeconds)}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-xs">
                    +{formatBps(plan.returnRateBps)}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mt-4">{plan.name}</h3>
                <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                  {plan.description}
                </p>

                {/* Financial breakdown */}
                <div className="mt-6 p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Required Capital</span>
                    <span className="font-bold text-white">{formatCurrency(plan.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Configured Yield</span>
                    <span className="font-bold text-emerald-400">+{formatCurrency(configuredReturn)}</span>
                  </div>
                  <div className="border-t border-slate-800 pt-2 flex justify-between font-semibold">
                    <span className="text-slate-300">Total Settlement</span>
                    <span className="text-emerald-300 font-bold">{formatCurrency(totalCredit)}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-slate-800">
                {hasBalance ? (
                  <button
                    onClick={() => handleStartPurchase(plan)}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Deploy Session</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={onOpenDeposit}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Deposit to Unlock</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation & Purchase Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-100">
            <button
              onClick={() => setSelectedPlan(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            {successSessionId ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-white">Session Activated!</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                  Your capital has been atomically deducted from your available balance and assigned to session{' '}
                  <span className="text-emerald-400 font-mono font-bold">{successSessionId}</span>.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedPlan(null);
                      onNavigate('sessions');
                    }}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20"
                  >
                    View Live Session Ticker
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    <Shield className="w-4 h-4" />
                    <span>Session Confirmation</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white">Confirm Plan Activation</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Please review the financial terms before authorizing this ledger deduction.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Overview Box */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs mb-5">
                  <div className="flex justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Selected Plan</span>
                    <span className="font-bold text-white">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Lock Duration</span>
                    <span className="font-bold text-white">{formatDuration(selectedPlan.durationSeconds)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Principal Deduction</span>
                    <span className="font-bold text-red-400">-{formatCurrency(selectedPlan.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Configured Yield ({formatBps(selectedPlan.returnRateBps)})</span>
                    <span className="font-bold text-emerald-400">
                      +{formatCurrency(Math.floor((selectedPlan.amount * selectedPlan.returnRateBps) / 10000))}
                    </span>
                  </div>
                  <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-sm">
                    <span className="text-slate-200">Total Settlement Payout</span>
                    <span className="text-emerald-400">
                      {formatCurrency(
                        selectedPlan.amount +
                          Math.floor((selectedPlan.amount * selectedPlan.returnRateBps) / 10000)
                      )}
                    </span>
                  </div>
                </div>

                {/* Terms Checkbox */}
                <label className="flex items-start gap-2.5 cursor-pointer mb-6 select-none">
                  <input
                    type="checkbox"
                    checked={confirmTerms}
                    onChange={(e) => setConfirmTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-xs text-slate-400 leading-snug">
                    I authorize the atomic deduction of{' '}
                    <strong className="text-slate-200">{formatCurrency(selectedPlan.amount)}</strong> from my
                    available balance into this automated yield session.
                  </span>
                </label>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setSelectedPlan(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPurchase}
                    disabled={submitting || !confirmTerms}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Executing Atomic Ledger Write...' : 'Confirm & Start Session'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
