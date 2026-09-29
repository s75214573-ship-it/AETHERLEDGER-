import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  HelpCircle,
  PlusCircle,
  MessageSquare,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Shield,
  ChevronLeft,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SupportTicket, TicketMessage, TicketPriority } from '../types';
import { createSupportTicket, sendTicketMessage } from '../services/ledgerService';

export const SupportPage: React.FC = () => {
  const { currentUser, userProfile, isAdmin, isSupport } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [replyText, setReplyText] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // New ticket form
  const [subject, setSubject] = useState<string>('');
  const [category, setCategory] = useState<string>('deposit');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [initialMessage, setInitialMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Listen to user tickets
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'supportTickets'),
      where('uid', '==', currentUser.uid),
      orderBy('updatedAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: SupportTicket[] = [];
        snap.forEach((d) => list.push(d.data() as SupportTicket));
        setTickets(list);

        // Keep selected ticket up to date if open
        if (selectedTicket) {
          const found = list.find((t) => t.ticketId === selectedTicket.ticketId);
          if (found) setSelectedTicket(found);
        }
      },
      (error) => {
        console.warn('SupportPage tickets listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Listen to messages for selected ticket
  useEffect(() => {
    if (!selectedTicket) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, 'supportTickets', selectedTicket.ticketId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: TicketMessage[] = [];
        snap.forEach((d) => list.push(d.data() as TicketMessage));
        setMessages(list);
      },
      (error) => {
        console.warn('SupportPage messages listener notice:', error);
      }
    );
    return () => unsub();
  }, [selectedTicket]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!subject.trim() || !initialMessage.trim()) {
      setError('Please provide both a subject and an explanation.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await createSupportTicket(
      currentUser.uid,
      currentUser.email || '',
      subject.trim(),
      category,
      initialMessage.trim(),
      priority
    );

    setSubmitting(false);
    if (res.success && res.ticketId) {
      setShowCreateModal(false);
      setSubject('');
      setInitialMessage('');
      // Auto-select newly created ticket
      const newTkt: SupportTicket = {
        ticketId: res.ticketId,
        uid: currentUser.uid,
        userEmail: currentUser.email || '',
        subject: subject.trim(),
        category,
        priority,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSelectedTicket(newTkt);
    } else {
      setError(res.error || 'Failed to submit support ticket.');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedTicket || !replyText.trim()) return;

    const senderRole = userProfile?.role || 'user';
    const senderName = userProfile?.displayName || currentUser.email || 'User';

    const text = replyText.trim();
    setReplyText('');

    await sendTicketMessage(selectedTicket.ticketId, currentUser.uid, senderRole, senderName, text);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <HelpCircle className="w-4 h-4" />
            <span>Support Desk</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Assistance & Tickets</h1>
          <p className="text-sm text-slate-400 mt-1">
            Direct communication channel with platform compliance and support personnel.
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setShowCreateModal(true);
          }}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Support Ticket</span>
        </button>
      </div>

      {/* Main Grid: Ticket List & Conversation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className="lg:col-span-1 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center justify-between">
            <span>Your Tickets</span>
            <span className="text-xs text-slate-400 font-normal">{tickets.length} total</span>
          </h3>

          {tickets.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              No tickets submitted yet.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {tickets.map((t) => {
                const isSelected = selectedTicket?.ticketId === t.ticketId;
                return (
                  <div
                    key={t.ticketId}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-slate-800 border-emerald-500/50 shadow-md'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {t.category}
                      </span>
                      <span
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          t.status === 'open'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : t.status === 'resolved'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-white line-clamp-1">{t.subject}</h4>
                    <p className="text-xs text-slate-400 line-clamp-1 mt-1">{t.lastMessage}</p>
                    <div className="text-[10px] text-slate-500 mt-2">
                      {new Date(t.updatedAt).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Conversation Thread */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between min-h-[500px]">
          {selectedTicket ? (
            <>
              {/* Ticket Top bar */}
              <div className="pb-4 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-white">{selectedTicket.subject}</h3>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-emerald-400">{selectedTicket.ticketId}</span>
                      <span>•</span>
                      <span className="uppercase text-[10px] font-bold text-slate-300">
                        {selectedTicket.priority} Priority
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-xs uppercase font-bold px-2.5 py-1 rounded-full ${
                      selectedTicket.status === 'open'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : selectedTicket.status === 'resolved'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {selectedTicket.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Messages list */}
              <div className="flex-1 py-4 space-y-4 overflow-y-auto max-h-[400px]">
                {messages.map((msg, idx) => {
                  const isUser = msg.senderRole === 'user';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 px-1">
                        <span className="font-bold text-slate-300">{msg.senderName || msg.senderRole}</span>
                        {!isUser && (
                          <span className="px-1 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-400 font-bold uppercase">
                            Staff
                          </span>
                        )}
                        <span>•</span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div
                        className={`p-3.5 rounded-2xl max-w-lg text-xs leading-relaxed ${
                          isUser
                            ? 'bg-emerald-600 text-white rounded-tr-none shadow-md'
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/60 shadow-md'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Input Form */}
              <form onSubmit={handleSendReply} className="pt-4 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your response to support..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
              <MessageSquare className="w-10 h-10 mb-2 stroke-1" />
              <span>Select a support ticket from the list or create a new inquiry.</span>
            </div>
          )}
        </div>
      </div>

      {/* CREATE TICKET MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-100">
            <h3 className="text-xl font-bold text-white mb-1">Create Support Ticket</h3>
            <p className="text-xs text-slate-400 mb-4">
              Our compliance and operations team typically responds within 2-4 hours.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Inquiry Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="deposit">Deposit Verification & UTR</option>
                  <option value="withdrawal">Withdrawal Settlement & Compliance</option>
                  <option value="session">Session Lifecycle & Returns</option>
                  <option value="account">Account & KYC Verification</option>
                  <option value="other">General Platform Query</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Deposit not verified after 30 minutes"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Message Details</label>
                <textarea
                  rows={4}
                  required
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="Describe your issue with reference IDs if applicable..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
