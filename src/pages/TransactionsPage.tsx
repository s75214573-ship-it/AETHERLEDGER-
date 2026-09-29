import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  ShieldCheck,
  Calendar,
  Tag,
  Copy,
  CheckCircle,
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, formatCurrency } from '../lib/firebase';
import { Transaction } from '../types';

export const TransactionsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'transactions'),
      where('uid', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Transaction[] = [];
        snap.forEach((d) => list.push(d.data() as Transaction));
        setTransactions(list);
      },
      (error) => {
        console.warn('TransactionsPage listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser]);

  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = transactions.filter((tx) => {
    if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
    if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = tx.transactionId?.toLowerCase().includes(q);
      const matchDesc = tx.description?.toLowerCase().includes(q);
      const matchRef = tx.referenceId?.toLowerCase().includes(q);
      if (!matchId && !matchDesc && !matchRef) return false;
    }
    return true;
  });

  const categories = [
    { id: 'ALL', label: 'All Categories' },
    { id: 'REGISTRATION_REWARD', label: 'Rewards' },
    { id: 'DEPOSIT', label: 'Deposits' },
    { id: 'PLAN_PURCHASE', label: 'Purchases' },
    { id: 'SESSION_RETURN', label: 'Yield Returns' },
    { id: 'WITHDRAWAL', label: 'Withdrawals' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
          <FileText className="w-4 h-4" />
          <span>Authoritative Financial Records</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Transaction Ledger</h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
          Every balance alteration is permanently archived into this immutable double-entry ledger. Records
          cannot be altered or removed.
        </p>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Transaction ID, description, or reference..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                typeFilter === 'ALL'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('CREDIT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                typeFilter === 'CREDIT'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Credits (+)
            </button>
            <button
              onClick={() => setTypeFilter('DEBIT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                typeFilter === 'DEBIT'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Debits (-)
            </button>
          </div>
        </div>

        {/* Categories scrollable pill list */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                categoryFilter === c.id
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Records Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            No transactions found matching your criteria.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filtered.map((tx) => {
              const isCredit = tx.type === 'CREDIT';
              return (
                <div
                  key={tx.transactionId}
                  className="p-4 sm:p-5 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isCredit
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="font-bold text-sm text-white">{tx.description}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <button
                          onClick={() => copyToClipboard(tx.transactionId)}
                          className="font-mono text-emerald-400/90 hover:underline flex items-center gap-1"
                        >
                          <span>{tx.transactionId}</span>
                          {copiedId === tx.transactionId ? (
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-500" />
                          )}
                        </button>
                        <span>•</span>
                        <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {tx.category}
                        </span>
                        {tx.referenceId && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[11px] text-slate-400">
                              Ref: {tx.referenceId}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(tx.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between">
                    <div
                      className={`font-mono text-lg font-black tracking-tight ${
                        isCredit ? 'text-emerald-400' : 'text-slate-100'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                      {formatCurrency(tx.amount)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {tx.status}
                      </span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
