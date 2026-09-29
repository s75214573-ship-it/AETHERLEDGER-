import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Wallet as WalletIcon,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Lock,
  Clock,
  QrCode,
  Copy,
  CheckCircle,
  AlertCircle,
  X,
  CreditCard,
  Building,
  RefreshCw,
  Edit3,
  Save,
  Upload,
  Check,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db, formatCurrency } from '../lib/firebase';
import { Deposit, PlatformSettings, Transaction, Wallet, Withdrawal } from '../types';
import QRCode from 'qrcode';
import {
  createDepositRequest,
  createWithdrawalRequest,
  updatePlatformSettings,
} from '../services/ledgerService';
import { activePaymentProvider } from '../services/paymentProvider';

interface WalletPageProps {
  onNavigate: (page: string) => void;
  depositModalOpen?: boolean;
  withdrawModalOpen?: boolean;
  onCloseModals?: () => void;
}

export const WalletPage: React.FC<WalletPageProps> = ({
  onNavigate,
  depositModalOpen: externalDepositOpen,
  withdrawModalOpen: externalWithdrawOpen,
  onCloseModals,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [activeTab, setActiveTab] = useState<'transactions' | 'deposits' | 'withdrawals'>('transactions');

  // Internal Modal States (sync with props if provided)
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);

  useEffect(() => {
    if (externalDepositOpen !== undefined) setShowDepositModal(externalDepositOpen);
  }, [externalDepositOpen]);

  useEffect(() => {
    if (externalWithdrawOpen !== undefined) setShowWithdrawModal(externalWithdrawOpen);
  }, [externalWithdrawOpen]);

  const handleCloseDeposit = () => {
    setShowDepositModal(false);
    onCloseModals?.();
  };

  const handleCloseWithdraw = () => {
    setShowWithdrawModal(false);
    onCloseModals?.();
  };

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState<number>(15000); // in integer paise (₹150)
  const [customDepositStr, setCustomDepositStr] = useState<string>('150');
  const [depositMethod, setDepositMethod] = useState<'UPI' | 'NETBANKING'>('UPI');
  const [providerRef, setProviderRef] = useState<string>('');
  const [depositSubmitting, setDepositSubmitting] = useState<boolean>(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<boolean>(false);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // Configurable Merchant UPI & Payee Details
  const [merchantUpiId, setMerchantUpiId] = useState<string>(() => {
    return localStorage.getItem('app_deposit_upi') || 'itsalexbro0021@okaxis';
  });
  const [merchantPayeeName, setMerchantPayeeName] = useState<string>(() => {
    return localStorage.getItem('app_deposit_payee') || 'Alex Bro';
  });
  const [customQrImage, setCustomQrImage] = useState<string | null>(() => {
    return localStorage.getItem('app_deposit_custom_qr') || null;
  });

  const [qrViewMode, setQrViewMode] = useState<'dynamic' | 'universal' | 'custom'>('dynamic');
  const [dynamicQrUrl, setDynamicQrUrl] = useState<string>('');
  const [universalQrUrl, setUniversalQrUrl] = useState<string>('');

  // Editing state for UPI ID
  const [isEditingUpi, setIsEditingUpi] = useState<boolean>(false);
  const [editUpiInput, setEditUpiInput] = useState<string>(merchantUpiId);
  const [editPayeeInput, setEditPayeeInput] = useState<string>(merchantPayeeName);
  const [savingUpiSettings, setSavingUpiSettings] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Real-time synchronization with Firestore platform settings
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'platform'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as PlatformSettings;
          if (data.depositUpiId) {
            setMerchantUpiId(data.depositUpiId);
            setEditUpiInput(data.depositUpiId);
            localStorage.setItem('app_deposit_upi', data.depositUpiId);
          }
          if (data.depositPayeeName) {
            setMerchantPayeeName(data.depositPayeeName);
            setEditPayeeInput(data.depositPayeeName);
            localStorage.setItem('app_deposit_payee', data.depositPayeeName);
          }
          if (data.depositQrCustomUrl) {
            setCustomQrImage(data.depositQrCustomUrl);
            localStorage.setItem('app_deposit_custom_qr', data.depositQrCustomUrl);
          }
        }
      },
      (err) => console.warn('Platform settings listener notice:', err)
    );
    return () => unsub();
  }, []);

  // Dynamically generate 100% compliant, standard NPCI UPI QR codes
  useEffect(() => {
    const num = parseFloat(customDepositStr) || 150;
    const cleanUpi = merchantUpiId.trim();
    const cleanPayee = merchantPayeeName.trim();

    // 1. Dynamic QR (Pre-fills exact deposit amount)
    const dynamicUri = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(cleanPayee)}&am=${num.toFixed(2)}&cu=INR&tn=Deposit`;
    QRCode.toDataURL(dynamicUri, {
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => setDynamicQrUrl(url))
      .catch((err) => console.error('Dynamic QR gen err', err));

    // 2. Universal QR (Open amount, scanned on any UPI app)
    const universalUri = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(cleanPayee)}&cu=INR&tn=Deposit`;
    QRCode.toDataURL(universalUri, {
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => setUniversalQrUrl(url))
      .catch((err) => console.error('Universal QR gen err', err));
  }, [customDepositStr, merchantUpiId, merchantPayeeName]);

  // Withdrawal Form State
  const [withdrawAmountStr, setWithdrawAmountStr] = useState<string>('300');
  const [withdrawDestType, setWithdrawDestType] = useState<'UPI' | 'BANK'>('UPI');
  const [upiId, setUpiId] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');
  const [bankIfsc, setBankIfsc] = useState<string>('');
  const [bankHolder, setBankHolder] = useState<string>('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState<boolean>(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<boolean>(false);

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
        console.warn('WalletPage wallet listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Real-time Transactions Listener
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
        console.warn('WalletPage transactions listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Real-time Deposits Listener
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'deposits'),
      where('uid', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Deposit[] = [];
        snap.forEach((d) => list.push(d.data() as Deposit));
        setDeposits(list);
      },
      (error) => {
        console.warn('WalletPage deposits listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Real-time Withdrawals Listener
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'withdrawals'),
      where('uid', '==', currentUser.uid),
      orderBy('requestedAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Withdrawal[] = [];
        snap.forEach((d) => list.push(d.data() as Withdrawal));
        setWithdrawals(list);
      },
      (error) => {
        console.warn('WalletPage withdrawals listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Submit Deposit Request
  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const parsed = Math.round(parseFloat(customDepositStr) * 100);
    if (isNaN(parsed) || parsed <= 0) {
      setDepositError('Please enter a valid deposit amount.');
      return;
    }
    if (!providerRef.trim()) {
      setDepositError('Please enter the 12-digit UPI Reference Number / UTR.');
      return;
    }

    setDepositSubmitting(true);
    setDepositError(null);

    const res = await createDepositRequest(
      currentUser.uid,
      currentUser.email || '',
      parsed,
      depositMethod,
      providerRef.trim()
    );

    setDepositSubmitting(false);
    if (res.success) {
      setDepositSuccess(true);
    } else {
      setDepositError(res.error || 'Failed to submit deposit.');
    }
  };

  // Submit Withdrawal Request
  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const parsedUnits = Math.round(parseFloat(withdrawAmountStr) * 100);
    if (isNaN(parsedUnits) || parsedUnits < 30000) {
      setWithdrawError('Minimum withdrawal amount is ₹300.00.');
      return;
    }

    const available = wallet?.availableBalance ?? 0;
    if (parsedUnits > available) {
      setWithdrawError(`Insufficient balance. Available: ${formatCurrency(available)}`);
      return;
    }

    let destinationValue = '';
    if (withdrawDestType === 'UPI') {
      if (!upiId.trim() || !upiId.includes('@')) {
        setWithdrawError('Please enter a valid UPI VPA address (e.g. user@okhdfcbank).');
        return;
      }
      destinationValue = upiId.trim();
    } else {
      if (!bankAccount.trim() || !bankIfsc.trim() || !bankHolder.trim()) {
        setWithdrawError('Please provide complete bank account, IFSC code and account holder name.');
        return;
      }
      destinationValue = `${bankAccount.trim()} (${bankIfsc.trim()})`;
    }

    setWithdrawSubmitting(true);
    setWithdrawError(null);

    const res = await createWithdrawalRequest(
      currentUser.uid,
      currentUser.email || '',
      parsedUnits,
      {
        type: withdrawDestType,
        value: destinationValue,
        accountName: bankHolder,
        ifscOrBank: bankIfsc,
      }
    );

    setWithdrawSubmitting(false);
    if (res.success) {
      setWithdrawSuccess(true);
    } else {
      setWithdrawError(res.error || 'Failed to submit withdrawal request.');
    }
  };

  const copyUpiAddress = () => {
    navigator.clipboard.writeText(merchantUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSaveUpiDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUpiInput.trim() || !editUpiInput.includes('@')) {
      alert('Please enter a valid UPI ID (e.g. yourname@okhdfcbank or phone@paytm)');
      return;
    }
    setSavingUpiSettings(true);
    const newUpi = editUpiInput.trim();
    const newPayee = editPayeeInput.trim() || 'Alex Bro';

    setMerchantUpiId(newUpi);
    setMerchantPayeeName(newPayee);
    localStorage.setItem('app_deposit_upi', newUpi);
    localStorage.setItem('app_deposit_payee', newPayee);

    if (isAdmin) {
      await updatePlatformSettings(
        {
          depositUpiId: newUpi,
          depositPayeeName: newPayee,
          depositQrCustomUrl: customQrImage || undefined,
        },
        currentUser?.uid,
        currentUser?.email || undefined
      );
    }

    setSavingUpiSettings(false);
    setSaveSuccessMsg('UPI details updated & QR regenerated!');
    setTimeout(() => {
      setSaveSuccessMsg(null);
      setIsEditingUpi(false);
    }, 1200);
  };

  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image file size should be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setCustomQrImage(dataUrl);
      localStorage.setItem('app_deposit_custom_qr', dataUrl);
      setQrViewMode('custom');
      if (isAdmin) {
        await updatePlatformSettings(
          { depositQrCustomUrl: dataUrl },
          currentUser?.uid,
          currentUser?.email || undefined
        );
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <WalletIcon className="w-4 h-4" />
            <span>Financial Custody & Ledger</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Wallet Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative, integer-based currency balances backed by an immutable transaction ledger.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setDepositSuccess(false);
              setDepositError(null);
              setShowDepositModal(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Deposit Capital</span>
          </button>

          <button
            onClick={() => {
              setWithdrawSuccess(false);
              setWithdrawError(null);
              setShowWithdrawModal(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            <span>Withdraw Funds</span>
          </button>
        </div>
      </div>

      {/* Tri-Pane Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Available Balance */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 relative shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Available Balance</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <WalletIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {formatCurrency(wallet?.availableBalance ?? 0)}
          </div>
          <div className="mt-3 text-xs text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Liquid & immediately deployable</span>
          </div>
        </div>

        {/* Locked / Reserved Balance */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 relative shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Locked / Compliance Reserve</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {formatCurrency(wallet?.lockedBalance ?? 0)}
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>Reserved for pending payout requests</span>
          </div>
        </div>

        {/* Pending Settlement Balance */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 relative shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Pending Inflow Deposits</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {formatCurrency(
              deposits
                .filter((d) => d.status === 'pending' || d.status === 'processing')
                .reduce((acc, d) => acc + d.amount, 0)
            )}
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
            <span>{deposits.filter((d) => d.status === 'pending').length} deposits awaiting verification</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation for History */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'transactions'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Ledger Records ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('deposits')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'deposits'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Deposit Requests ({deposits.length})
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'withdrawals'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Withdrawal Settlements ({withdrawals.length})
          </button>
        </div>

        {/* Tab 1: Transactions Table */}
        {activeTab === 'transactions' && (
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                No transactions recorded yet in immutable ledger.
              </div>
            ) : (
              transactions.map((tx) => {
                const isCredit = tx.type === 'CREDIT';
                return (
                  <div
                    key={tx.transactionId}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isCredit
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white">{tx.description}</div>
                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                          <span className="font-mono text-emerald-400/90">{tx.transactionId}</span>
                          <span>•</span>
                          <span className="uppercase font-semibold text-slate-300">{tx.category}</span>
                          <span>•</span>
                          <span>{new Date(tx.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between">
                      <div
                        className={`font-mono text-base font-extrabold ${
                          isCredit ? 'text-emerald-400' : 'text-slate-200'
                        }`}
                      >
                        {isCredit ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {tx.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Deposits */}
        {activeTab === 'deposits' && (
          <div className="space-y-3">
            {deposits.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                No deposit history recorded.
              </div>
            ) : (
              deposits.map((dep) => (
                <div
                  key={dep.depositId}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Deposit via {dep.paymentMethod || 'UPI'}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          dep.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : dep.status === 'rejected'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {dep.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      UTR / Reference: <span className="font-mono text-slate-200">{dep.providerReference}</span> •{' '}
                      {new Date(dep.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="font-mono text-base font-bold text-emerald-400">
                    +{formatCurrency(dep.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Withdrawals */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-3">
            {withdrawals.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                No withdrawal requests found.
              </div>
            ) : (
              withdrawals.map((wdr) => (
                <div
                  key={wdr.withdrawalId}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        Payout to {wdr.destination?.type || 'UPI'}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          wdr.status === 'settled'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : wdr.status === 'approved'
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            : wdr.status === 'rejected'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {wdr.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Target: <span className="font-mono text-slate-200">{wdr.destination?.value}</span> •{' '}
                      {new Date(wdr.requestedAt).toLocaleString()}
                    </div>
                    {wdr.providerReference && (
                      <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                        Settlement Ref: {wdr.providerReference}
                      </div>
                    )}
                    {wdr.rejectionReason && (
                      <div className="text-[10px] text-red-400 mt-0.5">
                        Reason: {wdr.rejectionReason}
                      </div>
                    )}
                  </div>

                  <div className="font-mono text-base font-bold text-red-400">
                    -{formatCurrency(wdr.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* DEPOSIT MODAL */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={handleCloseDeposit}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            {depositSuccess ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-white">Deposit Registered</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                  Your deposit request has been logged into the verification queue. Once verified by the payment
                  gateway statement, your available balance will update atomically.
                </p>
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleCloseDeposit}
                    className="px-6 py-2.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    <CreditCard className="w-4 h-4" />
                    <span>Payment Gateway Provider</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white">Deposit Capital</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Fund your wallet via unified UPI or NetBanking. Minimum deposit: ₹100.00.
                  </p>
                </div>

                {depositError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{depositError}</span>
                  </div>
                )}

                {/* Amount presets */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Select Amount</label>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[150, 500, 1000, 2500].map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setCustomDepositStr(amt.toString())}
                        className={`py-2 rounded-xl text-xs font-bold transition-all ${
                          customDepositStr === amt.toString()
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      value={customDepositStr}
                      onChange={(e) => setCustomDepositStr(e.target.value)}
                      placeholder="Custom amount"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* QR Code Presentation Box & In-Place UPI Configurator */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 mb-5 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                      <QrCode className="w-4 h-4 text-emerald-400" />
                      <span>Deposit UPI QR Code</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* Mode Toggle Buttons */}
                      <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setQrViewMode('dynamic')}
                          className={`px-2 py-1 rounded font-semibold transition-all ${
                            qrViewMode === 'dynamic'
                              ? 'bg-emerald-500 text-slate-950 shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Dynamic ₹{customDepositStr}
                        </button>
                        <button
                          type="button"
                          onClick={() => setQrViewMode('universal')}
                          className={`px-2 py-1 rounded font-semibold transition-all ${
                            qrViewMode === 'universal'
                              ? 'bg-emerald-500 text-slate-950 shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Universal QR
                        </button>
                        {customQrImage && (
                          <button
                            type="button"
                            onClick={() => setQrViewMode('custom')}
                            className={`px-2 py-1 rounded font-semibold transition-all ${
                              qrViewMode === 'custom'
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Standee QR
                          </button>
                        )}
                      </div>

                      {/* Edit UPI Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingUpi(!isEditingUpi);
                          setEditUpiInput(merchantUpiId);
                          setEditPayeeInput(merchantPayeeName);
                        }}
                        className={`p-1.5 rounded-lg border transition-all ${
                          isEditingUpi
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="Configure Merchant UPI ID / VPA"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline UPI Configurator Panel */}
                  {isEditingUpi ? (
                    <form onSubmit={handleSaveUpiDetails} className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-700/80 space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Configure Deposit UPI & Merchant Details</span>
                        </span>
                        {saveSuccessMsg && (
                          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {saveSuccessMsg}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Merchant UPI ID / VPA <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editUpiInput}
                          onChange={(e) => setEditUpiInput(e.target.value)}
                          placeholder="e.g. itsalexbro0021@okaxis or mobile@paytm"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                        />
                        {/* Quick Bank Handle Suggestions */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {['@okaxis', '@okhdfcbank', '@oksbi', '@paytm', '@ybl', '@upi'].map((handle) => (
                            <button
                              type="button"
                              key={handle}
                              onClick={() => {
                                const base = editUpiInput.includes('@')
                                  ? editUpiInput.split('@')[0]
                                  : editUpiInput || 'itsalexbro0021';
                                setEditUpiInput(`${base}${handle}`);
                              }}
                              className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                            >
                              {handle}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Payee / Merchant Name
                          </label>
                          <input
                            type="text"
                            value={editPayeeInput}
                            onChange={(e) => setEditPayeeInput(e.target.value)}
                            placeholder="e.g. Alex Bro"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Upload Standee QR Image
                          </label>
                          <label className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 flex items-center justify-center gap-1.5 cursor-pointer truncate">
                            <Upload className="w-3 h-3 text-emerald-400" />
                            <span className="truncate">{customQrImage ? 'Replace QR Image' : 'Select QR Image'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleQrImageUpload}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingUpi(false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingUpiSettings}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{savingUpiSettings ? 'Saving...' : 'Save & Regenerate QR'}</span>
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {/* QR Image Frame */}
                  <div className="flex flex-col items-center justify-center pt-1 pb-2">
                    <div className="relative p-3.5 bg-white rounded-2xl shadow-xl shadow-emerald-950/40 border-4 border-slate-850 flex items-center justify-center group">
                      {/* Corner Target Markers */}
                      <span className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-500 pointer-events-none" />
                      <span className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-500 pointer-events-none" />
                      <span className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-500 pointer-events-none" />
                      <span className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-500 pointer-events-none" />

                      {/* Real, Verified Scannable QR Code */}
                      {qrViewMode === 'custom' && customQrImage ? (
                        <img
                          src={customQrImage}
                          alt="Custom Merchant UPI QR"
                          className="w-48 h-48 sm:w-52 sm:h-52 object-contain select-none"
                        />
                      ) : (
                        <img
                          src={qrViewMode === 'universal' ? universalQrUrl : dynamicQrUrl}
                          alt="Verified UPI Payment QR"
                          className="w-48 h-48 sm:w-52 sm:h-52 object-contain select-none"
                        />
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold font-mono">
                        {qrViewMode === 'universal'
                          ? 'Open Amount QR (Enter in UPI App)'
                          : `Amount to Pay: ₹${parseFloat(customDepositStr || '0').toFixed(2)}`}
                      </span>
                      <a
                        href={
                          qrViewMode === 'custom' && customQrImage
                            ? customQrImage
                            : qrViewMode === 'universal'
                            ? universalQrUrl
                            : dynamicQrUrl
                        }
                        download={`upi_deposit_qr_${merchantUpiId}.png`}
                        className="text-[11px] text-slate-400 hover:text-emerald-400 font-semibold underline decoration-dashed"
                      >
                        Save QR
                      </a>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Works on Google Pay, PhonePe, Paytm, BHIM, Cred, and all UPI apps
                    </span>
                  </div>

                  {/* VPA Copy & Edit Bar */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Merchant VPA Address:</span>
                      <span className="font-mono text-emerald-400 font-bold select-all">{merchantUpiId}</span>
                    </div>
                    {merchantPayeeName && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Payee Name:</span>
                        <span className="font-medium text-slate-300">{merchantPayeeName}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={copyUpiAddress}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{copiedUpi ? 'Copied VPA!' : 'Copy UPI ID'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingUpi(!isEditingUpi);
                          setEditUpiInput(merchantUpiId);
                          setEditPayeeInput(merchantPayeeName);
                        }}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isEditingUpi ? 'Close Editor' : 'Edit UPI ID'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reference Input Form */}
                <form onSubmit={handleSubmitDeposit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      12-Digit UTR / Transaction Reference Number
                    </label>
                    <input
                      type="text"
                      required
                      value={providerRef}
                      onChange={(e) => setProviderRef(e.target.value)}
                      placeholder="e.g. 427189123456 or Ref ID"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Found in your Google Pay, PhonePe, or Banking app transaction receipt.
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleCloseDeposit}
                      className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={depositSubmitting}
                      className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg disabled:opacity-50 cursor-pointer"
                    >
                      {depositSubmitting ? 'Registering...' : 'Submit Deposit Request'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* WITHDRAWAL MODAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={handleCloseWithdraw}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            {withdrawSuccess ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-white">Withdrawal Registered</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                  Your funds have been reserved into the locked ledger balance. Following compliance clearance, the
                  settlement provider will dispatch the funds to your destination.
                </p>
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleCloseWithdraw}
                    className="px-6 py-2.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Payout Settlement</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white">Request Withdrawal</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Minimum payout is ₹300.00. Funds are reserved atomically.
                  </p>
                </div>

                {withdrawError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{withdrawError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Withdrawal Amount (Min ₹300.00)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-500 font-bold text-sm">₹</span>
                      <input
                        type="number"
                        min="300"
                        required
                        value={withdrawAmountStr}
                        onChange={(e) => setWithdrawAmountStr(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                      <span>Available: {formatCurrency(wallet?.availableBalance ?? 0)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setWithdrawAmountStr(((wallet?.availableBalance ?? 0) / 100).toFixed(2))
                        }
                        className="text-emerald-400 font-bold hover:underline"
                      >
                        Use Max
                      </button>
                    </div>
                  </div>

                  {/* Destination Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">Destination Channel</label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setWithdrawDestType('UPI')}
                        className={`py-2 rounded-xl text-xs font-bold transition-all ${
                          withdrawDestType === 'UPI'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        UPI Address (VPA)
                      </button>
                      <button
                        type="button"
                        onClick={() => setWithdrawDestType('BANK')}
                        className={`py-2 rounded-xl text-xs font-bold transition-all ${
                          withdrawDestType === 'BANK'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Bank Account (NEFT/IMPS)
                      </button>
                    </div>

                    {withdrawDestType === 'UPI' ? (
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">UPI ID (e.g. mobile@upi)</label>
                        <input
                          type="text"
                          required
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          placeholder="yourname@okhdfcbank"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Account Holder Full Name</label>
                          <input
                            type="text"
                            required
                            value={bankHolder}
                            onChange={(e) => setBankHolder(e.target.value)}
                            placeholder="Alex Taylor"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Bank Account Number</label>
                          <input
                            type="text"
                            required
                            value={bankAccount}
                            onChange={(e) => setBankAccount(e.target.value)}
                            placeholder="50100412345678"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">IFSC Code</label>
                          <input
                            type="text"
                            required
                            value={bankIfsc}
                            onChange={(e) => setBankIfsc(e.target.value)}
                            placeholder="HDFC0001234"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={handleCloseWithdraw}
                      className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={withdrawSubmitting}
                      className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg disabled:opacity-50 cursor-pointer"
                    >
                      {withdrawSubmitting ? 'Reserving Balance...' : 'Confirm & Request Payout'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
