import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  Users,
  Clock,
  HelpCircle,
  Settings,
  FileText,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  PlusCircle,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Send,
  DollarSign,
  CreditCard,
  Ban,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  where,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, formatCurrency, formatDuration, formatBps } from '../../lib/firebase';
import {
  AdminLog,
  Deposit,
  InvestmentSession,
  Plan,
  PlatformSettings,
  SupportTicket,
  TicketMessage,
  Transaction,
  UserProfile,
  UserRole,
  UserStatus,
  Wallet,
  Withdrawal,
} from '../../types';
import {
  adminAdjustUserBalance,
  adminProcessWithdrawal,
  adminUpdateUserRole,
  adminUpdateUserStatus,
  adminVerifyDeposit,
  completeActiveSession,
  forceSeedDefaultPlans,
  getPlatformSettings,
  recordAdminLog,
  seedSettingsIfEmpty,
  sendTicketMessage,
  updatePlatformSettings,
  updateTicketStatus,
} from '../../services/ledgerService';

type AdminTab =
  | 'overview'
  | 'users'
  | 'deposits'
  | 'withdrawals'
  | 'plans'
  | 'sessions'
  | 'support'
  | 'settings'
  | 'logs';

interface ToastState {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary' | 'success';
  onConfirm: () => void | Promise<void>;
}

interface PromptModalState {
  isOpen: boolean;
  title: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (val: string) => void | Promise<void>;
}

export const AdminDashboard: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Real-time collections data
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [sessions, setSessions] = useState<InvestmentSession[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);

  // Filters & Search
  const [userSearch, setUserSearch] = useState('');
  const [depositFilter, setDepositFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'pending' | 'approved' | 'settled' | 'rejected'>('all');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [logFilter, setLogFilter] = useState('');

  // User details inspection modal
  const [inspectUser, setInspectUser] = useState<UserProfile | null>(null);
  const [userWallet, setUserWallet] = useState<Wallet | null>(null);
  const [userTxs, setUserTxs] = useState<Transaction[]>([]);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Manual Balance Adjustment state inside User Inspector
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustAmountStr, setAdjustAmountStr] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Plan editor modal
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planName, setPlanName] = useState('');
  const [planAmountStr, setPlanAmountStr] = useState('150');
  const [planDurationHours, setPlanDurationHours] = useState('24');
  const [planReturnBps, setPlanReturnBps] = useState('500');
  const [planDescription, setPlanDescription] = useState('');
  const [planSaving, setPlanSaving] = useState(false);

  // Support ticket inspector
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);

  // Settings form state
  const [depositUpiInput, setDepositUpiInput] = useState('');
  const [depositPayeeInput, setDepositPayeeInput] = useState('');
  const [depositQrInput, setDepositQrInput] = useState('');
  const [minWithdrawalStr, setMinWithdrawalStr] = useState('300');
  const [minDepositStr, setMinDepositStr] = useState('100');
  const [regRewardStr, setRegRewardStr] = useState('145');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [announcementInput, setAnnouncementInput] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Automation / Seeder status
  const [sweepingSessions, setSweepingSessions] = useState(false);
  const [seedingPlans, setSeedingPlans] = useState(false);
  const [seedingSettings, setSeedingSettings] = useState(false);

  // In-App Toast
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3800);
  };

  // In-App Confirm Dialog Modal
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    confirmVariant: 'primary',
    onConfirm: () => {},
  });

  const openConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    options?: { confirmLabel?: string; confirmVariant?: 'danger' | 'primary' | 'success' }
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmLabel: options?.confirmLabel || 'Confirm',
      confirmVariant: options?.confirmVariant || 'primary',
      onConfirm,
    });
  };

  const closeConfirm = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  // In-App Prompt Dialog Modal
  const [promptModal, setPromptModal] = useState<PromptModalState>({
    isOpen: false,
    title: '',
    label: '',
    placeholder: '',
    defaultValue: '',
    confirmLabel: 'Submit',
    onConfirm: () => {},
  });
  const [promptInputValue, setPromptInputValue] = useState('');

  const openPrompt = (
    title: string,
    label: string,
    onConfirm: (val: string) => void | Promise<void>,
    options?: { placeholder?: string; defaultValue?: string; confirmLabel?: string }
  ) => {
    setPromptInputValue(options?.defaultValue || '');
    setPromptModal({
      isOpen: true,
      title,
      label,
      placeholder: options?.placeholder || '',
      defaultValue: options?.defaultValue || '',
      confirmLabel: options?.confirmLabel || 'Submit',
      onConfirm,
    });
  };

  const closePrompt = () => {
    setPromptModal((prev) => ({ ...prev, isOpen: false }));
  };

  // 1. Listen to Users
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list: UserProfile[] = [];
        snap.forEach((d) => list.push(d.data() as UserProfile));
        setUsers(list);
      },
      (error) => {
        console.warn('Admin users listener notice:', error);
      }
    );
    return () => unsub();
  }, [isAdmin]);

  // 2. Listen to Plans
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(
      collection(db, 'plans'),
      (snap) => {
        const list: Plan[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Plan));
        setPlans(list);
      },
      (error) => {
        console.warn('Admin plans listener notice:', error);
      }
    );
    return () => unsub();
  }, [isAdmin]);

  // 3. Listen to Deposits
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'deposits'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Deposit[] = [];
        snap.forEach((d) => list.push(d.data() as Deposit));
        setDeposits(list);
      },
      (error) => {
        console.warn('Admin deposits listener notice:', error);
      }
    );
    return () => unsub();
  }, [isAdmin]);

  // 4. Listen to Withdrawals
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'withdrawals'), orderBy('requestedAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Withdrawal[] = [];
        snap.forEach((d) => list.push(d.data() as Withdrawal));
        setWithdrawals(list);
      },
      (error) => {
        console.warn('Admin withdrawals listener notice:', error);
      }
    );
    return () => unsub();
  }, [isAdmin]);

  // 5. Listen to Sessions
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: InvestmentSession[] = [];
        snap.forEach((d) => list.push(d.data() as InvestmentSession));
        setSessions(list);
      },
      (error) => {
        console.warn('Admin sessions listener notice:', error);
      }
    );
    return () => unsub();
  }, [isAdmin]);

  // 6. Listen to Support Tickets
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'supportTickets'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: SupportTicket[] = [];
        snap.forEach((d) => list.push(d.data() as SupportTicket));
        setTickets(list);
      },
      (error) => {
        console.warn('Admin tickets listener notice:', error);
      }
    );
    return () => unsub();
  }, [isAdmin]);

  // 7. Listen to Admin Logs
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'adminLogs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AdminLog[] = [];
        snap.forEach((d) => list.push(d.data() as AdminLog));
        setAdminLogs(list);
      },
      (error) => {
        console.warn('Admin logs listener notice:', error);
      }
    );
    return () => unsub();
  }, [isAdmin]);

  // 8. Listen to Platform Settings
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(
      doc(db, 'settings', 'platform'),
      (snap) => {
        if (snap.exists()) {
          const s = snap.data() as PlatformSettings;
          setPlatformSettings(s);
          setDepositUpiInput(s.depositUpiId || '');
          setDepositPayeeInput(s.depositPayeeName || '');
          setDepositQrInput(s.depositQrCustomUrl || '');
          setMinWithdrawalStr(((s.minWithdrawal || 30000) / 100).toString());
          setMinDepositStr(((s.minDeposit || 10000) / 100).toString());
          setRegRewardStr(((s.registrationReward || 14500) / 100).toString());
          setMaintenanceMode(!!s.maintenanceMode);
          setAnnouncementInput(s.announcementNotice || '');
        }
      },
      (err) => console.warn('Settings listener error:', err)
    );
    return () => unsub();
  }, [isAdmin]);

  // Listen to messages for selected ticket
  useEffect(() => {
    if (!selectedTicket) {
      setTicketMessages([]);
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
        setTicketMessages(list);
      },
      (error) => {
        console.warn('Admin ticket messages listener notice:', error);
      }
    );
    return () => unsub();
  }, [selectedTicket]);

  // Fetch inspected user's wallet & transactions
  const loadUserAccountData = async (uid: string) => {
    try {
      setInspectLoading(true);
      const wSnap = await getDocs(query(collection(db, 'wallets'), where('uid', '==', uid)));
      if (!wSnap.empty) {
        setUserWallet(wSnap.docs[0].data() as Wallet);
      } else {
        setUserWallet(null);
      }

      const txSnap = await getDocs(
        query(collection(db, 'transactions'), where('uid', '==', uid), orderBy('createdAt', 'desc'))
      );
      const list: Transaction[] = [];
      txSnap.forEach((d) => list.push(d.data() as Transaction));
      setUserTxs(list);
    } catch (err) {
      console.error('Inspect error', err);
    } finally {
      setInspectLoading(false);
    }
  };

  const handleInspectUser = async (u: UserProfile) => {
    setInspectUser(u);
    setAdjustType('CREDIT');
    setAdjustAmountStr('');
    setAdjustReason('');
    await loadUserAccountData(u.uid);
  };

  // Manual balance adjustment handler
  const handleApplyBalanceAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !inspectUser) return;

    const amount = parseFloat(adjustAmountStr);
    if (isNaN(amount) || amount <= 0) {
      showToast('error', 'Please enter a valid positive adjustment amount.');
      return;
    }

    if (!adjustReason.trim()) {
      showToast('error', 'Please provide a clear reason for the ledger adjustment.');
      return;
    }

    const amountUnits = Math.round(amount * 100);
    setAdjustSubmitting(true);

    const res = await adminAdjustUserBalance(
      currentUser.uid,
      currentUser.email || '',
      inspectUser.uid,
      adjustType,
      amountUnits,
      adjustReason.trim()
    );

    setAdjustSubmitting(false);

    if (res.success) {
      showToast(
        'success',
        `Successfully ${adjustType === 'CREDIT' ? 'credited' : 'debited'} ₹${amount.toFixed(2)} on user account.`
      );
      setAdjustAmountStr('');
      setAdjustReason('');
      await loadUserAccountData(inspectUser.uid);
    } else {
      showToast('error', res.error || 'Failed to adjust balance.');
    }
  };

  // Plan Management Handlers
  const handleOpenPlanModal = (p?: Plan) => {
    if (p) {
      setEditingPlan(p);
      setPlanName(p.name);
      setPlanAmountStr((p.amount / 100).toString());
      setPlanDurationHours((p.durationSeconds / 3600).toString());
      setPlanReturnBps(p.returnRateBps.toString());
      setPlanDescription(p.description);
    } else {
      setEditingPlan(null);
      setPlanName('');
      setPlanAmountStr('150');
      setPlanDurationHours('24');
      setPlanReturnBps('500');
      setPlanDescription('');
    }
    setPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const amount = parseFloat(planAmountStr);
    const hours = parseFloat(planDurationHours);
    const returnBps = parseInt(planReturnBps, 10);

    if (isNaN(amount) || amount <= 0) {
      showToast('error', 'Principal amount must be greater than zero.');
      return;
    }
    if (isNaN(hours) || hours <= 0) {
      showToast('error', 'Duration must be greater than zero hours.');
      return;
    }
    if (isNaN(returnBps) || returnBps <= 0) {
      showToast('error', 'Return rate basis points must be positive.');
      return;
    }

    const amountUnits = Math.round(amount * 100);
    const durationSeconds = Math.round(hours * 3600);

    const planId = editingPlan?.id || `plan_${Math.random().toString(36).substring(2, 9)}`;
    const planDocRef = doc(db, 'plans', planId);

    setPlanSaving(true);
    try {
      const data: Plan = {
        id: planId,
        planId,
        name: planName.trim(),
        amount: amountUnits,
        durationSeconds,
        returnRateBps: returnBps,
        enabled: editingPlan ? editingPlan.enabled : true,
        description: planDescription.trim(),
        createdAt: editingPlan?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.email || 'admin',
      };

      await setDoc(planDocRef, data);
      await recordAdminLog(
        currentUser.uid,
        currentUser.email || '',
        editingPlan ? 'ADMIN_UPDATED_PLAN' : 'ADMIN_CREATED_PLAN',
        'plan',
        planId,
        `Saved plan "${planName}" (₹${amount.toFixed(2)}, ${hours}h, +${(returnBps / 100).toFixed(2)}%)`
      );

      showToast('success', `Plan "${planName}" saved successfully.`);
      setPlanModalOpen(false);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save plan.');
    } finally {
      setPlanSaving(false);
    }
  };

  const handleTogglePlan = async (p: Plan) => {
    if (!currentUser || !p.id) return;
    try {
      const ref = doc(db, 'plans', p.id);
      await setDoc(ref, { enabled: !p.enabled, updatedAt: new Date().toISOString() }, { merge: true });
      await recordAdminLog(
        currentUser.uid,
        currentUser.email || '',
        p.enabled ? 'ADMIN_DISABLED_PLAN' : 'ADMIN_ENABLED_PLAN',
        'plan',
        p.id,
        `Toggled plan enabled to ${!p.enabled}`
      );
      showToast('info', `Plan "${p.name}" is now ${!p.enabled ? 'Enabled' : 'Disabled'}.`);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Toggle failed');
    }
  };

  const handleDeletePlan = (p: Plan) => {
    if (!currentUser || !p.id) return;
    openConfirm(
      'Delete Plan Offering',
      `Are you sure you want to permanently delete plan "${p.name}"? Active user sessions already running this plan will still mature based on their snapshot data.`,
      async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, 'plans', p.id!));
          await recordAdminLog(
            currentUser.uid,
            currentUser.email || '',
            'ADMIN_DELETED_PLAN',
            'plan',
            p.id!,
            `Deleted plan ${p.name}`
          );
          showToast('success', `Plan "${p.name}" has been deleted.`);
        } catch (err: unknown) {
          showToast('error', err instanceof Error ? err.message : 'Delete failed');
        }
      },
      { confirmLabel: 'Delete Plan', confirmVariant: 'danger' }
    );
  };

  // Seed default plans on demand
  const handleSeedDefaultPlans = async () => {
    if (!currentUser) return;
    openConfirm(
      'Seed Default Plans',
      'This will populate your catalog with default investment plans (e.g. 1-Day Flash, 3-Day Growth, 7-Day Treasury). Proceed?',
      async () => {
        closeConfirm();
        setSeedingPlans(true);
        const res = await forceSeedDefaultPlans(currentUser.uid, currentUser.email || '');
        setSeedingPlans(false);
        if (res.success) {
          showToast('success', `Successfully seeded ${res.count} default investment plans.`);
        } else {
          showToast('error', res.error || 'Failed to seed plans.');
        }
      }
    );
  };

  // Automated session sweep across all users
  const handleSweepExpiredSessions = async () => {
    setSweepingSessions(true);
    try {
      const now = Date.now();
      const active = sessions.filter((s) => s.status === 'active');
      let settledCount = 0;

      for (const s of active) {
        if (new Date(s.endsAt).getTime() <= now) {
          const res = await completeActiveSession(s);
          if (res.success) settledCount++;
        }
      }

      showToast(
        'success',
        `Sweep completed: ${settledCount} expired sessions matured and were credited to wallets.`
      );
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Sweep error');
    } finally {
      setSweepingSessions(false);
    }
  };

  // Force settle single session
  const handleForceSettleSession = (session: InvestmentSession) => {
    if (!currentUser) return;
    openConfirm(
      'Force Settle Session',
      `Settle session "${session.planName}" immediately for user ${session.uid}? This will atomically credit ₹${(session.totalCredit / 100).toFixed(2)} to their wallet.`,
      async () => {
        closeConfirm();
        const res = await completeActiveSession(session, true);
        if (res.success) {
          showToast('success', `Session settled. ₹${(session.totalCredit / 100).toFixed(2)} credited to user.`);
          await recordAdminLog(
            currentUser.uid,
            currentUser.email || '',
            'ADMIN_FORCE_SETTLED_SESSION',
            'session',
            session.sessionId,
            `Matured early by admin`
          );
        } else {
          showToast('error', res.error || 'Failed to force settle session.');
        }
      },
      { confirmLabel: 'Settle Now', confirmVariant: 'success' }
    );
  };

  // Reply to support ticket as staff
  const handleAdminTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedTicket || !adminReplyText.trim()) return;

    setReplySending(true);
    const res = await sendTicketMessage(
      selectedTicket.ticketId,
      currentUser.uid,
      'admin',
      'Support Team Staff',
      adminReplyText.trim()
    );
    setReplySending(false);

    if (res.success) {
      setAdminReplyText('');
      showToast('success', 'Reply sent to user ticket.');
    } else {
      showToast('error', res.error || 'Failed to send reply.');
    }
  };

  // Platform Settings Save
  const handleSavePlatformSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const minW = parseFloat(minWithdrawalStr);
    const minD = parseFloat(minDepositStr);
    const regR = parseFloat(regRewardStr);

    if (isNaN(minW) || minW <= 0) {
      showToast('error', 'Minimum withdrawal must be positive.');
      return;
    }
    if (isNaN(minD) || minD <= 0) {
      showToast('error', 'Minimum deposit must be positive.');
      return;
    }
    if (isNaN(regR) || regR < 0) {
      showToast('error', 'Registration reward cannot be negative.');
      return;
    }

    setSettingsSaving(true);
    const res = await updatePlatformSettings(
      {
        depositUpiId: depositUpiInput.trim(),
        depositPayeeName: depositPayeeInput.trim(),
        depositQrCustomUrl: depositQrInput.trim(),
        minWithdrawal: Math.round(minW * 100),
        minDeposit: Math.round(minD * 100),
        registrationReward: Math.round(regR * 100),
        maintenanceMode,
        announcementNotice: announcementInput.trim(),
      },
      currentUser.uid,
      currentUser.email || ''
    );
    setSettingsSaving(false);

    if (res.success) {
      showToast('success', 'Platform & Payment Gateway settings saved.');
      // Also update local storage fallback
      if (depositUpiInput.trim()) localStorage.setItem('app_deposit_upi', depositUpiInput.trim());
      if (depositPayeeInput.trim()) localStorage.setItem('app_deposit_payee', depositPayeeInput.trim());
    } else {
      showToast('error', res.error || 'Failed to save settings.');
    }
  };

  // Seed default settings on demand
  const handleSeedSettings = async () => {
    if (!currentUser) return;
    setSeedingSettings(true);
    await seedSettingsIfEmpty(true);
    setSeedingSettings(false);
    showToast('success', 'Platform settings initialized.');
  };

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-slate-400">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Administrative Access Required</h2>
        <p className="text-xs text-slate-500 mt-1">
          Your account does not hold authorization claims for administrative management.
        </p>
      </div>
    );
  }

  // Real-time metric computations
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === 'active').length;
  const pendingDeposits = deposits.filter((d) => d.status === 'pending');
  const completedDeposits = deposits.filter((d) => d.status === 'completed');
  const pendingWithdrawals = withdrawals.filter((w) => w.status === 'pending');
  const approvedWithdrawals = withdrawals.filter((w) => w.status === 'approved');
  const settledWithdrawals = withdrawals.filter((w) => w.status === 'settled');
  const activeSessionsList = sessions.filter((s) => s.status === 'active');
  const completedSessionsList = sessions.filter((s) => s.status === 'completed');
  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress');

  // Filtered deposits
  const filteredDeposits = deposits.filter((d) => {
    if (depositFilter === 'all') return true;
    return d.status === depositFilter;
  });

  // Filtered withdrawals
  const filteredWithdrawals = withdrawals.filter((w) => {
    if (withdrawalFilter === 'all') return true;
    return w.status === withdrawalFilter;
  });

  // Filtered sessions
  const filteredSessions = sessions.filter((s) => {
    if (sessionFilter === 'all') return true;
    return s.status === sessionFilter;
  });

  // Filtered tickets
  const filteredTickets = tickets.filter((t) => {
    if (ticketFilter === 'all') return true;
    return t.status === ticketFilter;
  });

  // Filtered logs
  const filteredLogs = adminLogs.filter((log) => {
    if (!logFilter.trim()) return true;
    const q = logFilter.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.adminEmail.toLowerCase().includes(q) ||
      log.targetId.toLowerCase().includes(q) ||
      (log.reason && log.reason.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 border text-xs font-semibold text-white bg-slate-900/95 border-slate-700">
          {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {toast.type === 'info' && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Admin Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Enterprise Oversight Console</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin Command Center</h1>
          <p className="text-sm text-slate-400 mt-1">
            Connected as <span className="text-amber-400 font-mono font-bold">{currentUser?.email}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSweepExpiredSessions}
            disabled={sweepingSessions}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${sweepingSessions ? 'animate-spin' : ''}`} />
            <span>Sweep Expired Sessions</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Platform Settings</span>
          </button>
        </div>
      </div>

      {/* Real-time Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => setActiveTab('users')}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition"
        >
          <span className="text-[11px] text-slate-400">Total Users</span>
          <div className="text-2xl font-black text-white mt-1">{totalUsers}</div>
          <span className="text-[10px] text-emerald-400 font-semibold">{activeUsers} Active</span>
        </div>

        <div
          onClick={() => setActiveTab('deposits')}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition"
        >
          <span className="text-[11px] text-slate-400">Pending Deposits</span>
          <div className="text-2xl font-black text-amber-400 mt-1">{pendingDeposits.length}</div>
          <span className="text-[10px] text-slate-400">{completedDeposits.length} Completed</span>
        </div>

        <div
          onClick={() => setActiveTab('withdrawals')}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition"
        >
          <span className="text-[11px] text-slate-400">Pending Withdrawals</span>
          <div className="text-2xl font-black text-red-400 mt-1">{pendingWithdrawals.length}</div>
          <span className="text-[10px] text-slate-400">{settledWithdrawals.length} Settled</span>
        </div>

        <div
          onClick={() => setActiveTab('sessions')}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition"
        >
          <span className="text-[11px] text-slate-400">Active Sessions</span>
          <div className="text-2xl font-black text-cyan-400 mt-1">{activeSessionsList.length}</div>
          <span className="text-[10px] text-slate-400">{completedSessionsList.length} Matured</span>
        </div>

        <div
          onClick={() => setActiveTab('support')}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition"
        >
          <span className="text-[11px] text-slate-400">Open Tickets</span>
          <div className="text-2xl font-black text-purple-400 mt-1">{openTickets.length}</div>
          <span className="text-[10px] text-slate-400">{tickets.length} Total</span>
        </div>
      </div>

      {/* Admin Subtabs Bar */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'users', label: `Users (${totalUsers})` },
          { id: 'deposits', label: `Deposits (${pendingDeposits.length})` },
          { id: 'withdrawals', label: `Withdrawals (${pendingWithdrawals.length})` },
          { id: 'plans', label: `Plans (${plans.length})` },
          { id: 'sessions', label: `Sessions (${activeSessionsList.length})` },
          { id: 'support', label: `Support Desk (${openTickets.length})` },
          { id: 'settings', label: 'Payment & Platform' },
          { id: 'logs', label: `Audit Trail (${adminLogs.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as AdminTab)}
            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Action Queues */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="font-bold text-white text-base">Immediate Action Items</h3>
              <div className="space-y-3">
                <div
                  onClick={() => setActiveTab('deposits')}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-amber-500/40 transition"
                >
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      {pendingDeposits.length} Deposit(s) Pending Review
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">Verify payment UTR and credit user balances</p>
                  </div>
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-lg">
                    Review
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('withdrawals')}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-red-500/40 transition"
                >
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      {pendingWithdrawals.length} Withdrawal(s) Queued
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">Compliance approval and payout settlement</p>
                  </div>
                  <span className="px-3 py-1 bg-red-500/10 text-red-400 text-xs font-bold rounded-lg">
                    Review
                  </span>
                </div>

                <div
                  onClick={() => setActiveTab('support')}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-purple-500/40 transition"
                >
                  <div>
                    <h4 className="font-bold text-sm text-white">{openTickets.length} Support Ticket(s) Open</h4>
                    <p className="text-xs text-slate-400 mt-0.5">User inquiries requiring staff response</p>
                  </div>
                  <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-xs font-bold rounded-lg">
                    Respond
                  </span>
                </div>
              </div>
            </div>

            {/* Quick System Status & Seeders */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base">Platform Quick Seeders</h3>
                <span className="text-[11px] text-emerald-400 font-mono font-bold">READY</span>
              </div>
              <p className="text-xs text-slate-400">
                Use one-click seeders to bootstrap or restore default platform configurations and plans.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleSeedDefaultPlans}
                  disabled={seedingPlans}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/40 flex flex-col gap-1 text-left transition disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Seed Default Plans</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Installs Flash (₹150), Growth (₹500), Treasury (₹1000)
                  </span>
                </button>

                <button
                  onClick={handleSeedSettings}
                  disabled={seedingSettings}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/40 flex flex-col gap-1 text-left transition disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <Settings className="w-3.5 h-3.5" />
                    <span>Seed Platform Settings</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Initializes default limits & deposit VPA in Firestore
                  </span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>Deposit Merchant UPI:</span>
                  <span className="text-white font-bold">{depositUpiInput || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Min Withdrawal:</span>
                  <span className="text-white font-bold">₹{minWithdrawalStr}</span>
                </div>
                <div className="flex justify-between">
                  <span>Signup Bonus:</span>
                  <span className="text-white font-bold">₹{regRewardStr}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user by email, name, or UID..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <span className="text-xs text-slate-400">{users.length} registered accounts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-3 rounded-l-xl">User / Email</th>
                  <th className="p-3">UID</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 rounded-r-xl text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users
                  .filter((u) => {
                    if (!userSearch.trim()) return true;
                    const q = userSearch.toLowerCase();
                    return (
                      u.email.toLowerCase().includes(q) ||
                      u.displayName?.toLowerCase().includes(q) ||
                      u.uid.toLowerCase().includes(q)
                    );
                  })
                  .map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-800/30">
                      <td className="p-3">
                        <div className="font-bold text-white">{u.displayName || 'No Name'}</div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">{u.uid.substring(0, 10)}...</td>
                      <td className="p-3">
                        <select
                          value={u.role}
                          onChange={async (e) => {
                            if (!currentUser) return;
                            const newRole = e.target.value as UserRole;
                            openConfirm(
                              'Change User Role',
                              `Change role of ${u.email} to "${newRole}"?`,
                              async () => {
                                closeConfirm();
                                const res = await adminUpdateUserRole(
                                  currentUser.uid,
                                  currentUser.email || '',
                                  u.uid,
                                  newRole,
                                  'Role changed via admin table'
                                );
                                if (res.success) {
                                  showToast('success', `Role updated to ${newRole}`);
                                } else {
                                  showToast('error', res.error || 'Failed to update role');
                                }
                              }
                            );
                          }}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs font-semibold cursor-pointer"
                        >
                          <option value="user">user</option>
                          <option value="support">support</option>
                          <option value="admin">admin</option>
                          <option value="super_admin">super_admin</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => handleInspectUser(u)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg cursor-pointer"
                        >
                          Inspect & Adjust
                        </button>
                        {u.status === 'active' ? (
                          <button
                            onClick={() => {
                              if (!currentUser) return;
                              openConfirm(
                                'Suspend Account',
                                `Suspend account for ${u.email}? They will not be able to invest or withdraw until reactivated.`,
                                async () => {
                                  closeConfirm();
                                  const res = await adminUpdateUserStatus(
                                    currentUser.uid,
                                    currentUser.email || '',
                                    u.uid,
                                    'suspended',
                                    'Administrative suspension'
                                  );
                                  if (res.success) showToast('info', `Suspended ${u.email}`);
                                  else showToast('error', res.error || 'Failed to suspend');
                                },
                                { confirmLabel: 'Suspend', confirmVariant: 'danger' }
                              );
                            }}
                            className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg cursor-pointer"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (!currentUser) return;
                              openConfirm(
                                'Reactivate Account',
                                `Reactivate account for ${u.email}?`,
                                async () => {
                                  closeConfirm();
                                  const res = await adminUpdateUserStatus(
                                    currentUser.uid,
                                    currentUser.email || '',
                                    u.uid,
                                    'active',
                                    'Administrative reactivation'
                                  );
                                  if (res.success) showToast('success', `Reactivated ${u.email}`);
                                  else showToast('error', res.error || 'Failed to reactivate');
                                },
                                { confirmLabel: 'Reactivate', confirmVariant: 'success' }
                              );
                            }}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg cursor-pointer"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DEPOSITS REVIEW */}
      {activeTab === 'deposits' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-base">Incoming Deposit Requests</h3>
              <p className="text-xs text-slate-400">Verify user payment references and credit wallet balances.</p>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              {(['all', 'pending', 'completed', 'rejected'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDepositFilter(filter)}
                  className={`px-3 py-1 rounded-lg capitalize cursor-pointer transition ${
                    depositFilter === filter
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredDeposits.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/50 rounded-xl border border-slate-800">
                No deposit requests found matching the selected filter.
              </div>
            ) : (
              filteredDeposits.map((dep) => (
                <div
                  key={dep.depositId}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{dep.userEmail || dep.uid}</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          dep.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : dep.status === 'rejected'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {dep.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Amount: <strong className="text-white">{formatCurrency(dep.amount)}</strong> • Method:{' '}
                      {dep.paymentMethod || 'UPI'} • UTR:{' '}
                      <span className="font-mono text-emerald-400 font-bold">{dep.providerReference}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Submitted: {new Date(dep.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {dep.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (!currentUser) return;
                          openConfirm(
                            'Approve Deposit & Credit Wallet',
                            `Approve deposit of ${formatCurrency(dep.amount)} for ${dep.userEmail}? This will atomically credit their wallet ledger.`,
                            async () => {
                              closeConfirm();
                              const res = await adminVerifyDeposit(
                                currentUser.uid,
                                currentUser.email || '',
                                dep.depositId,
                                true
                              );
                              if (res.success) {
                                showToast('success', `Approved and credited ${formatCurrency(dep.amount)}`);
                              } else {
                                showToast('error', res.error || 'Failed to approve deposit');
                              }
                            },
                            { confirmLabel: 'Approve & Credit', confirmVariant: 'success' }
                          );
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Verify & Credit</span>
                      </button>

                      <button
                        onClick={() => {
                          if (!currentUser) return;
                          openPrompt(
                            'Reject Deposit',
                            'Provide reason for rejection (e.g. invalid UTR, duplicate entry, payment not received):',
                            async (reason) => {
                              closePrompt();
                              const res = await adminVerifyDeposit(
                                currentUser.uid,
                                currentUser.email || '',
                                dep.depositId,
                                false,
                                reason || 'Payment not recognized'
                              );
                              if (res.success) {
                                showToast('info', 'Deposit marked as rejected.');
                              } else {
                                showToast('error', res.error || 'Failed to reject deposit');
                              }
                            },
                            { placeholder: 'Payment not found in bank statement' }
                          );
                        }}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: WITHDRAWALS REVIEW & SETTLEMENT */}
      {activeTab === 'withdrawals' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-base">Withdrawal Settlements Queue</h3>
              <p className="text-xs text-slate-400">Review payout requests, approve compliance, and settle funds.</p>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              {(['all', 'pending', 'approved', 'settled', 'rejected'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setWithdrawalFilter(filter)}
                  className={`px-3 py-1 rounded-lg capitalize cursor-pointer transition ${
                    withdrawalFilter === filter
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredWithdrawals.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/50 rounded-xl border border-slate-800">
                No withdrawal requests found matching the filter.
              </div>
            ) : (
              filteredWithdrawals.map((w) => (
                <div
                  key={w.withdrawalId}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{w.userEmail || w.uid}</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          w.status === 'settled'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : w.status === 'approved'
                            ? 'bg-cyan-500/10 text-cyan-400'
                            : w.status === 'rejected'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {w.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Amount: <strong className="text-white">{formatCurrency(w.amount)}</strong> • Destination:{' '}
                      <span className="font-mono text-slate-200">{w.destination?.value}</span> (
                      {w.destination?.type})
                    </div>
                    {w.providerReference && (
                      <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                        Settlement Ref: {w.providerReference}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500 mt-1">
                      Requested: {new Date(w.requestedAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {w.status === 'pending' && (
                      <>
                        <button
                          onClick={async () => {
                            if (!currentUser) return;
                            const res = await adminProcessWithdrawal(
                              currentUser.uid,
                              currentUser.email || '',
                              w.withdrawalId,
                              'approve'
                            );
                            if (res.success) {
                              showToast('success', 'Compliance approved. Ready to settle payout.');
                            } else {
                              showToast('error', res.error || 'Approval failed');
                            }
                          }}
                          className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Approve Compliance
                        </button>
                        <button
                          onClick={() => {
                            if (!currentUser) return;
                            openPrompt(
                              'Reject Withdrawal',
                              'Reason for rejection (funds will be unlocked and returned to user wallet):',
                              async (reason) => {
                                closePrompt();
                                const res = await adminProcessWithdrawal(
                                  currentUser.uid,
                                  currentUser.email || '',
                                  w.withdrawalId,
                                  'reject',
                                  reason || 'Discrepancy in payout details'
                                );
                                if (res.success) {
                                  showToast('info', 'Withdrawal rejected and balance unlocked.');
                                } else {
                                  showToast('error', res.error || 'Failed to reject withdrawal');
                                }
                              }
                            );
                          }}
                          className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Reject & Refund
                        </button>
                      </>
                    )}

                    {(w.status === 'pending' || w.status === 'approved') && (
                      <button
                        onClick={() => {
                          if (!currentUser) return;
                          openConfirm(
                            'Settle Payout',
                            `Confirm dispatch settlement of ${formatCurrency(w.amount)} to ${w.destination?.value}? This permanently deducts the locked balance and marks the withdrawal settled.`,
                            async () => {
                              closeConfirm();
                              const res = await adminProcessWithdrawal(
                                currentUser.uid,
                                currentUser.email || '',
                                w.withdrawalId,
                                'settle'
                              );
                              if (res.success) {
                                showToast('success', `Payout of ${formatCurrency(w.amount)} successfully settled.`);
                              } else {
                                showToast('error', res.error || 'Settlement failed');
                              }
                            },
                            { confirmLabel: 'Settle Payout', confirmVariant: 'success' }
                          );
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Settle Payout</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: PLANS MANAGEMENT */}
      {activeTab === 'plans' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-base">Plan Offerings Catalog</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure plan durations, minimum principal, and basis points yield.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSeedDefaultPlans}
                disabled={seedingPlans}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Seed Defaults</span>
              </button>

              <button
                onClick={() => handleOpenPlanModal()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create New Plan</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p) => (
              <div
                key={p.id || p.name}
                className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        p.enabled
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {p.enabled ? 'ACTIVE' : 'DISABLED'}
                    </span>
                    <span className="text-xs font-bold text-emerald-400">+{formatBps(p.returnRateBps)}</span>
                  </div>

                  <h4 className="font-bold text-base text-white mt-2">{p.name}</h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.description}</p>

                  <div className="mt-4 p-3 rounded-lg bg-slate-900 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Principal:</span>
                      <span className="font-bold text-white">{formatCurrency(p.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Duration:</span>
                      <span className="font-bold text-slate-200">{formatDuration(p.durationSeconds)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <button
                    onClick={() => handleTogglePlan(p)}
                    className="text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {p.enabled ? (
                      <ToggleRight className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-slate-500" />
                    )}
                    <span>{p.enabled ? 'Disable' : 'Enable'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenPlanModal(p)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePlan(p)}
                      className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: SESSIONS MONITOR */}
      {activeTab === 'sessions' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-base">Active & Matured Sessions</h3>
              <p className="text-xs text-slate-400">Monitor running yields or manually force-settle sessions.</p>
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              {(['all', 'active', 'completed'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSessionFilter(filter)}
                  className={`px-3 py-1 rounded-lg capitalize cursor-pointer transition ${
                    sessionFilter === filter
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredSessions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/50 rounded-xl border border-slate-800">
                No investment sessions found.
              </div>
            ) : (
              filteredSessions.map((s) => (
                <div
                  key={s.sessionId}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{s.planName}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          s.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-purple-500/10 text-purple-400'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="text-slate-400 mt-1 font-mono text-[11px]">
                      User UID: {s.uid} • Session ID: {s.sessionId}
                    </div>
                    <div className="text-slate-500 text-[10px] mt-1">
                      Starts: {new Date(s.startedAt).toLocaleString()} • Ends:{' '}
                      {new Date(s.endsAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:text-right">
                    <div>
                      <div className="font-mono text-sm font-bold text-white">
                        Principal: {formatCurrency(s.principal)}
                      </div>
                      <div className="font-mono text-xs text-emerald-400 font-bold">
                        Yield Payout: {formatCurrency(s.totalCredit)}
                      </div>
                    </div>

                    {s.status === 'active' && (
                      <button
                        onClick={() => handleForceSettleSession(s)}
                        className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        Force Settle Now
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 7: SUPPORT DESK */}
      {activeTab === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Incoming Tickets</h3>
              <select
                value={ticketFilter}
                onChange={(e) => setTicketFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-[11px] rounded-lg px-2 py-1 text-slate-300"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="space-y-2 max-h-[550px] overflow-y-auto">
              {filteredTickets.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">No tickets match this filter.</div>
              ) : (
                filteredTickets.map((t) => (
                  <div
                    key={t.ticketId}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-3 rounded-xl cursor-pointer border text-xs transition ${
                      selectedTicket?.ticketId === t.ticketId
                        ? 'bg-slate-800 border-amber-500/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-[10px] text-slate-400">{t.userEmail}</span>
                      <span
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          t.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-white">{t.subject}</h4>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {new Date(t.updatedAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between min-h-[500px]">
            {selectedTicket ? (
              <>
                <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-white">{selectedTicket.subject}</h3>
                    <div className="text-xs text-slate-400">
                      User: {selectedTicket.userEmail} • Category: {selectedTicket.category}
                    </div>
                  </div>

                  <select
                    value={selectedTicket.status}
                    onChange={async (e) => {
                      const newStat = e.target.value as any;
                      await updateTicketStatus(selectedTicket.ticketId, newStat);
                      showToast('info', `Ticket marked as ${newStat}`);
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-semibold cursor-pointer"
                  >
                    <option value="open">open</option>
                    <option value="in_progress">in_progress</option>
                    <option value="waiting_for_user">waiting_for_user</option>
                    <option value="resolved">resolved</option>
                    <option value="closed">closed</option>
                  </select>
                </div>

                <div className="flex-1 py-4 space-y-3 overflow-y-auto max-h-[380px]">
                  {ticketMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${
                        msg.senderRole === 'admin' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 px-1 mb-0.5">
                        {msg.senderName} ({msg.senderRole})
                      </span>
                      <div
                        className={`p-3 rounded-xl max-w-md text-xs ${
                          msg.senderRole === 'admin'
                            ? 'bg-amber-500 text-slate-950 font-medium'
                            : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAdminTicketReply} className="pt-3 border-t border-slate-800 flex gap-2">
                  <input
                    type="text"
                    value={adminReplyText}
                    onChange={(e) => setAdminReplyText(e.target.value)}
                    placeholder="Staff reply to ticket..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={!adminReplyText.trim() || replySending}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Reply</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
                Select a ticket on the left to review conversation and respond.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: PAYMENT GATEWAY & PLATFORM SETTINGS */}
      {activeTab === 'settings' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          <div>
            <h3 className="font-bold text-white text-base">Payment Gateway & Settlement Parameters</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              These settings synchronize live with the deposit modal, withdrawal validations, and new user bonuses.
            </p>
          </div>

          <form onSubmit={handleSavePlatformSettings} className="space-y-6">
            {/* Merchant UPI Configuration */}
            <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span>Deposit Gateway Configuration</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Official Merchant UPI ID / VPA
                  </label>
                  <input
                    type="text"
                    required
                    value={depositUpiInput}
                    onChange={(e) => setDepositUpiInput(e.target.value)}
                    placeholder="e.g. s75214573@okaxis or itsalexbro0021@okaxis"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    All users will see this VPA and generate QR codes targeting this UPI ID.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Official Payee Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={depositPayeeInput}
                    onChange={(e) => setDepositPayeeInput(e.target.value)}
                    placeholder="e.g. AetherLedger Treasury"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Shown on the user's UPI app (Google Pay, PhonePe, Paytm).
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1 text-xs">
                  Custom Static QR Code Image (Optional URL / Base64)
                </label>
                <input
                  type="text"
                  value={depositQrInput}
                  onChange={(e) => setDepositQrInput(e.target.value)}
                  placeholder="https://... or data:image/png;base64,..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Financial Limits */}
            <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>Financial Rules & Limits</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Minimum Withdrawal (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={minWithdrawalStr}
                    onChange={(e) => setMinWithdrawalStr(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Minimum Deposit (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={minDepositStr}
                    onChange={(e) => setMinDepositStr(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    New User Registration Reward (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={regRewardStr}
                    onChange={(e) => setRegRewardStr(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Platform Banner & Maintenance Mode */}
            <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Platform Broadcast & Maintenance</span>
              </h4>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Global Announcement Notice
                  </label>
                  <input
                    type="text"
                    value={announcementInput}
                    onChange={(e) => setAnnouncementInput(e.target.value)}
                    placeholder="Real-time message displayed on user dashboards..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setMaintenanceMode(!maintenanceMode)}
                    className="cursor-pointer"
                  >
                    {maintenanceMode ? (
                      <ToggleRight className="w-6 h-6 text-red-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-500" />
                    )}
                  </button>
                  <div>
                    <span className="text-xs font-bold text-white">Maintenance Mode</span>
                    <p className="text-[11px] text-slate-400">
                      When active, users will see a maintenance notice upon attempting sensitive operations.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={settingsSaving}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {settingsSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Save Platform Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 9: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-base">Immutable Audit Trail</h3>
              <p className="text-xs text-slate-400">
                All administrative actions are append-only and cryptographically logged.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                placeholder="Filter logs by action, admin, or id..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/50 rounded-xl border border-slate-800">
                No audit logs found.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id || log.action + log.createdAt}
                  className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-bold text-amber-400">{log.action}</span>
                    <div className="text-slate-300 text-[11px] mt-0.5">{log.reason}</div>
                    <div className="text-slate-500 text-[10px] mt-0.5">
                      Target: {log.targetType} ({log.targetId}) • By: {log.adminEmail}
                    </div>
                  </div>
                  <div className="text-slate-500 text-[10px] whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* PLAN CREATE / EDIT MODAL */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
            <h3 className="text-xl font-bold text-white mb-1">
              {editingPlan ? 'Edit Investment Plan' : 'Create New Plan'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              All active sessions reference plan duration and return basis points.
            </p>

            <form onSubmit={handleSavePlan} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="e.g. 1-Day Flash Session"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Principal (₹)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={planAmountStr}
                    onChange={(e) => setPlanAmountStr(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Duration (Hours)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    value={planDurationHours}
                    onChange={(e) => setPlanDurationHours(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Return Rate (Basis Points)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    required
                    value={planReturnBps}
                    onChange={(e) => setPlanReturnBps(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-emerald-400 font-bold font-mono text-sm whitespace-nowrap">
                    ={formatBps(parseInt(planReturnBps || '0', 10))}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={planDescription}
                  onChange={(e) => setPlanDescription(e.target.value)}
                  placeholder="Explain session dynamics and maturity..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={planSaving}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg cursor-pointer disabled:opacity-50"
                >
                  {planSaving ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT USER MODAL WITH MANUAL BALANCE ADJUSTMENT */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-white">Inspecting User Account</h3>
                <p className="text-xs text-slate-400">{inspectUser.email} (UID: {inspectUser.uid})</p>
              </div>
              <button
                onClick={() => setInspectUser(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Wallet balances */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400">Available Balance</span>
                <div className="text-lg font-bold text-emerald-400">
                  {formatCurrency(userWallet?.availableBalance ?? 0)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400">Locked Balance</span>
                <div className="text-lg font-bold text-amber-400">
                  {formatCurrency(userWallet?.lockedBalance ?? 0)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400">Account Status</span>
                <div className="text-lg font-bold text-white uppercase">{inspectUser.status}</div>
              </div>
            </div>

            {/* Manual Balance Adjustment Form */}
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Manual Ledger Balance Adjustment</span>
                </h4>
                <span className="text-[10px] text-slate-400">Creates an immutable audit record</span>
              </div>

              <form onSubmit={handleApplyBalanceAdjustment} className="space-y-3 text-xs">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="radio"
                      name="adjustType"
                      checked={adjustType === 'CREDIT'}
                      onChange={() => setAdjustType('CREDIT')}
                      className="accent-emerald-500"
                    />
                    <span className="text-emerald-400">Credit Balance (+)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="radio"
                      name="adjustType"
                      checked={adjustType === 'DEBIT'}
                      onChange={() => setAdjustType('DEBIT')}
                      className="accent-red-500"
                    />
                    <span className="text-red-400">Debit Balance (-)</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Adjustment Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={adjustAmountStr}
                      onChange={(e) => setAdjustAmountStr(e.target.value)}
                      placeholder="e.g. 100.00"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Adjustment Reason / Notes</label>
                    <input
                      type="text"
                      required
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="e.g. Promotional bonus, manual deposit correction..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={adjustSubmitting}
                    className={`px-4 py-2 font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                      adjustType === 'CREDIT'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        : 'bg-red-500 hover:bg-red-400 text-white'
                    }`}
                  >
                    {adjustSubmitting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Apply {adjustType} Adjustment</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Transaction Ledger for inspected user */}
            <div>
              <h4 className="font-bold text-sm text-white mb-2">Immutable Ledger Entries ({userTxs.length})</h4>
              {inspectLoading ? (
                <div className="p-4 text-center text-xs text-slate-400">Loading ledger records...</div>
              ) : userTxs.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                  No transaction history recorded for this account.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
                  {userTxs.map((t) => (
                    <div
                      key={t.transactionId}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-bold text-white">{t.description}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {t.category} • {new Date(t.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div
                        className={`font-mono font-bold ${
                          t.type === 'CREDIT' ? 'text-emerald-400' : 'text-slate-200'
                        }`}
                      >
                        {t.type === 'CREDIT' ? '+' : '-'}
                        {formatCurrency(t.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRMATION MODAL (Replaces window.confirm) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-100 space-y-4">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  confirmModal.confirmVariant === 'danger'
                    ? 'bg-red-500/20 text-red-400'
                    : confirmModal.confirmVariant === 'success'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">{confirmModal.title}</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{confirmModal.message}</p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeConfirm}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmModal.onConfirm()}
                className={`px-4 py-2 text-xs font-bold rounded-xl cursor-pointer ${
                  confirmModal.confirmVariant === 'danger'
                    ? 'bg-red-500 hover:bg-red-400 text-white'
                    : confirmModal.confirmVariant === 'success'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {confirmModal.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP PROMPT MODAL (Replaces window.prompt) */}
      {promptModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-100 space-y-4">
            <h3 className="font-bold text-white text-base">{promptModal.title}</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {promptModal.label}
              </label>
              <textarea
                rows={3}
                value={promptInputValue}
                onChange={(e) => setPromptInputValue(e.target.value)}
                placeholder={promptModal.placeholder}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closePrompt}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => promptModal.onConfirm(promptInputValue)}
                className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl cursor-pointer"
              >
                {promptModal.confirmLabel || 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
