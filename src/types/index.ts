export type UserRole = 'user' | 'support' | 'admin' | 'super_admin';
export type UserStatus = 'active' | 'suspended' | 'closed';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  rewardClaimed?: boolean;
}

export interface Wallet {
  uid: string;
  availableBalance: number; // in integer currency units (cents/paise, e.g. 15000 = ₹150.00)
  pendingBalance: number;
  lockedBalance: number;
  updatedAt?: string;
}

export type TransactionType = 'CREDIT' | 'DEBIT';
export type TransactionCategory =
  | 'REGISTRATION_REWARD'
  | 'DEPOSIT'
  | 'PLAN_PURCHASE'
  | 'SESSION_RETURN'
  | 'WITHDRAWAL'
  | 'REFUND'
  | 'ADMIN_ADJUSTMENT';

export type TransactionStatus = 'completed' | 'pending' | 'failed';

export interface Transaction {
  id?: string;
  transactionId: string;
  uid: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  status: TransactionStatus;
  referenceId?: string;
  description: string;
  createdAt: string;
}

export interface Plan {
  id?: string;
  planId?: string;
  name: string;
  amount: number; // in integer units
  durationSeconds: number; // in seconds (e.g. 86400 = 1 day)
  returnRateBps: number; // Basis points: 500 = 5.00%
  enabled: boolean;
  description: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export type SessionStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export interface InvestmentSession {
  id?: string;
  sessionId: string;
  uid: string;
  planId: string;
  planName: string;
  principal: number;
  configuredReturn: number;
  totalCredit: number;
  startedAt: string;
  endsAt: string;
  completedAt?: string | null;
  status: SessionStatus;
  createdAt: string;
}

export type DepositStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'rejected';

export interface Deposit {
  id?: string;
  depositId: string;
  uid: string;
  userEmail?: string;
  amount: number;
  paymentMethod?: string;
  providerReference: string;
  status: DepositStatus;
  createdAt: string;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
}

export type WithdrawalStatus = 'pending' | 'reviewed' | 'approved' | 'settled' | 'rejected';

export interface Withdrawal {
  id?: string;
  withdrawalId: string;
  uid: string;
  userEmail?: string;
  amount: number;
  destination: {
    type: 'UPI' | 'BANK';
    value: string;
    accountName?: string;
    ifscOrBank?: string;
  };
  status: WithdrawalStatus;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  settledAt?: string | null;
  providerReference?: string | null;
  rejectionReason?: string;
}

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed';

export interface SupportTicket {
  id?: string;
  ticketId: string;
  uid: string;
  userEmail?: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
}

export interface TicketMessage {
  id?: string;
  messageId?: string;
  senderUid: string;
  senderRole: UserRole;
  senderName?: string;
  message: string;
  createdAt: string;
}

export interface AppNotification {
  id?: string;
  notificationId?: string;
  uid: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export interface AdminLog {
  id?: string;
  adminUid: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformSettings {
  registrationReward: number; // e.g. 14500 (₹145.00)
  minWithdrawal: number; // e.g. 30000 (₹300.00)
  minDeposit: number; // e.g. 10000 (₹100.00)
  maintenanceMode: boolean;
  announcementNotice?: string;
  depositUpiId?: string; // Official Deposit UPI VPA
  depositPayeeName?: string; // Official Payee/Business Name
  depositQrCustomUrl?: string; // Optional custom QR image data/url
  updatedAt?: string;
  updatedBy?: string;
}
