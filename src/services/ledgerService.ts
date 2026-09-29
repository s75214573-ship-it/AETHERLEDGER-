import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  runTransaction,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  InvestmentSession,
  Plan,
  PlatformSettings,
  SupportTicket,
  TicketMessage,
  TicketPriority,
  TicketStatus,
  Transaction,
  UserRole,
  UserStatus,
  Wallet,
} from '../types';

export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'plan_rapid_1h',
    planId: 'plan_rapid_1h',
    name: '1-Hour Rapid Session (Testing)',
    amount: 15000, // ₹150.00
    durationSeconds: 3600, // 1 hour
    returnRateBps: 200, // 2.0%
    enabled: true,
    description: 'Fast-cycle testing session designed for rapid verification of ledger returns.',
    createdAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    id: 'plan_standard_1d',
    planId: 'plan_standard_1d',
    name: '1-Day Standard Growth Plan',
    amount: 15000, // ₹150.00
    durationSeconds: 86400, // 24 hours
    returnRateBps: 500, // 5.0%
    enabled: true,
    description: 'Core daily asset allocation plan with guaranteed institutional settlement upon maturity.',
    createdAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    id: 'plan_structured_3d',
    planId: 'plan_structured_3d',
    name: '3-Day Structured Reserve',
    amount: 50000, // ₹500.00
    durationSeconds: 259200, // 3 days
    returnRateBps: 1800, // 18.0%
    enabled: true,
    description: 'Medium duration automated liquidity provision session with structured returns.',
    createdAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    id: 'plan_prime_7d',
    planId: 'plan_prime_7d',
    name: '7-Day Prime Horizon',
    amount: 100000, // ₹1,000.00
    durationSeconds: 604800, // 7 days
    returnRateBps: 4500, // 45.0%
    enabled: true,
    description: 'Tier-1 treasury vault session with enhanced programmatic yield generation.',
    createdAt: new Date().toISOString(),
    createdBy: 'system',
  },
];

/**
 * Seed initial plans if /plans collection is empty and caller is authorized admin
 */
export async function seedInitialPlansIfEmpty(isAdminUser = false): Promise<void> {
  if (!isAdminUser) return;
  try {
    const plansColl = collection(db, 'plans');
    const snap = await getDocs(plansColl);
    if (snap.empty) {
      for (const p of DEFAULT_PLANS) {
        const id = p.id || `plan_${Math.random().toString(36).substring(2, 9)}`;
        await setDoc(doc(db, 'plans', id), { ...p, id, planId: id });
      }
    }
  } catch (err) {
    console.error('Plan seeding error:', err);
  }
}

/**
 * Seed default platform settings if caller is authorized admin
 */
export async function seedSettingsIfEmpty(isAdminUser = false): Promise<void> {
  if (!isAdminUser) return;
  try {
    const settingsDoc = doc(db, 'settings', 'platform');
    const snap = await getDoc(settingsDoc);
    if (!snap.exists()) {
      const defaultSettings: PlatformSettings = {
        registrationReward: 14500, // ₹145.00
        minWithdrawal: 30000, // ₹300.00
        minDeposit: 10000, // ₹100.00
        maintenanceMode: false,
        announcementNotice: 'Welcome to AetherLedger. Real-time Firebase financial settlement is active.',
        updatedAt: new Date().toISOString(),
      };
      await setDoc(settingsDoc, defaultSettings);
    }
  } catch (err) {
    console.error('Settings seeding error:', err);
  }
}

/**
 * Write append-only immutable Admin Audit Log
 */
export async function recordAdminLog(
  adminUid: string,
  adminEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  reason?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await setDoc(doc(db, 'adminLogs', logId), {
      id: logId,
      adminUid,
      adminEmail,
      action,
      targetType,
      targetId,
      reason: reason || '',
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to write admin audit log:', err);
  }
}

/**
 * Send user notification
 */
export async function createUserNotification(
  uid: string,
  title: string,
  message: string,
  type: string
): Promise<void> {
  try {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await setDoc(doc(db, 'notifications', notifId), {
      notificationId: notifId,
      uid,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}

/**
 * ATOMIC PLAN PURCHASE
 */
export async function purchasePlan(
  uid: string,
  plan: Plan
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const walletDocRef = doc(db, 'wallets', uid);
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const sessionDocRef = doc(db, 'sessions', sessionId);
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const txDocRef = doc(db, 'transactions', txId);

    const result = await runTransaction(db, async (t) => {
      // 1. Verify user profile & active status
      const userSnap = await t.get(userDocRef);
      if (!userSnap.exists()) {
        throw new Error('User account not found.');
      }
      if (userSnap.data()?.status !== 'active') {
        throw new Error('Account suspended or inactive. Transactions are disabled.');
      }

      // 2. Verify wallet available balance
      const walletSnap = await t.get(walletDocRef);
      if (!walletSnap.exists()) {
        throw new Error('Wallet not found.');
      }
      const walletData = walletSnap.data() as Wallet;
      if (walletData.availableBalance < plan.amount) {
        throw new Error(
          `Insufficient available balance. Required: ₹${(plan.amount / 100).toFixed(2)}, Available: ₹${(walletData.availableBalance / 100).toFixed(2)}`
        );
      }

      // 3. Calculate configured yield
      const configuredReturn = Math.floor((plan.amount * plan.returnRateBps) / 10000);
      const totalCredit = plan.amount + configuredReturn;
      const now = new Date();
      const endsAt = new Date(now.getTime() + plan.durationSeconds * 1000);

      // 4. Atomic balance deduction
      t.update(walletDocRef, {
        availableBalance: walletData.availableBalance - plan.amount,
        updatedAt: now.toISOString(),
      });

      // 5. Create Session record
      const newSession: InvestmentSession = {
        sessionId,
        uid,
        planId: plan.id || plan.planId || '',
        planName: plan.name,
        principal: plan.amount,
        configuredReturn,
        totalCredit,
        startedAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        completedAt: null,
        status: 'active',
        createdAt: now.toISOString(),
      };
      t.set(sessionDocRef, newSession);

      // 6. Record immutable transaction in ledger
      const newTx: Transaction = {
        transactionId: txId,
        uid,
        type: 'DEBIT',
        category: 'PLAN_PURCHASE',
        amount: plan.amount,
        status: 'completed',
        referenceId: sessionId,
        description: `Purchased session: ${plan.name} (${plan.durationSeconds / 3600}h lock)`,
        createdAt: now.toISOString(),
      };
      t.set(txDocRef, newTx);

      return { sessionId, totalCredit, endsAt };
    });

    // Notify user
    await createUserNotification(
      uid,
      'Session Activated',
      `Your session for "${plan.name}" of ₹${(plan.amount / 100).toFixed(2)} is now live until ${result.endsAt.toLocaleString()}.`,
      'SESSION_STARTED'
    );

    return { success: true, sessionId: result.sessionId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Purchase plan failed:', msg);
    return { success: false, error: msg };
  }
}

/**
 * AUTOMATIC IDEMPOTENT SESSION COMPLETION
 */
export async function completeActiveSession(
  session: InvestmentSession,
  forceEarly: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionDocRef = doc(db, 'sessions', session.sessionId);
    const walletDocRef = doc(db, 'wallets', session.uid);
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const txDocRef = doc(db, 'transactions', txId);

    await runTransaction(db, async (t) => {
      const snap = await t.get(sessionDocRef);
      if (!snap.exists()) {
        throw new Error('Session doc not found');
      }
      const data = snap.data() as InvestmentSession;
      if (data.status !== 'active') {
        // Already completed or cancelled by concurrent runner
        return;
      }

      // Check current server/local time vs endsAt unless forceEarly is approved by admin
      const now = new Date();
      if (!forceEarly && new Date(data.endsAt).getTime() > now.getTime()) {
        throw new Error('Session duration has not yet expired.');
      }

      const walletSnap = await t.get(walletDocRef);
      if (!walletSnap.exists()) {
        throw new Error('Wallet not found');
      }
      const walletData = walletSnap.data() as Wallet;

      // 1. Mark session completed atomically
      t.update(sessionDocRef, {
        status: 'completed',
        completedAt: now.toISOString(),
      });

      // 2. Credit principal + configured yield into wallet
      t.update(walletDocRef, {
        availableBalance: walletData.availableBalance + data.totalCredit,
        updatedAt: now.toISOString(),
      });

      // 3. Write immutable transaction in ledger
      const creditTx: Transaction = {
        transactionId: txId,
        uid: data.uid,
        type: 'CREDIT',
        category: 'SESSION_RETURN',
        amount: data.totalCredit,
        status: 'completed',
        referenceId: data.sessionId,
        description: `Matured session return for ${data.planName} (Principal ₹${(data.principal / 100).toFixed(2)} + Return ₹${(data.configuredReturn / 100).toFixed(2)})${forceEarly ? ' [Admin Settle]' : ''}`,
        createdAt: now.toISOString(),
      };
      t.set(txDocRef, creditTx);
    });

    // Notify user
    await createUserNotification(
      session.uid,
      'Session Matured & Credited',
      `Session "${session.planName}" completed successfully. ₹${(session.totalCredit / 100).toFixed(2)} has been credited to your available balance.`,
      'SESSION_COMPLETED'
    );

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * WITHDRAWAL WORKFLOW: User requests payout
 */
export async function createWithdrawalRequest(
  uid: string,
  userEmail: string,
  amount: number,
  destination: { type: 'UPI' | 'BANK'; value: string; accountName?: string; ifscOrBank?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (amount < 30000) {
      return { success: false, error: 'Minimum withdrawal amount is ₹300.00.' };
    }

    const walletDocRef = doc(db, 'wallets', uid);
    const userDocRef = doc(db, 'users', uid);
    const withdrawalId = `wdr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const withdrawalDocRef = doc(db, 'withdrawals', withdrawalId);

    await runTransaction(db, async (t) => {
      const userSnap = await t.get(userDocRef);
      if (!userSnap.exists() || userSnap.data()?.status !== 'active') {
        throw new Error('Account inactive or suspended. Cannot process withdrawal.');
      }

      const walletSnap = await t.get(walletDocRef);
      if (!walletSnap.exists()) {
        throw new Error('Wallet record missing.');
      }
      const wallet = walletSnap.data() as Wallet;

      if (wallet.availableBalance < amount) {
        throw new Error(
          `Insufficient available balance. Required: ₹${(amount / 100).toFixed(2)}, Available: ₹${(wallet.availableBalance / 100).toFixed(2)}`
        );
      }

      // Lock balance pending compliance review
      t.update(walletDocRef, {
        availableBalance: wallet.availableBalance - amount,
        lockedBalance: (wallet.lockedBalance || 0) + amount,
        updatedAt: new Date().toISOString(),
      });

      // Create withdrawal document
      t.set(withdrawalDocRef, {
        withdrawalId,
        uid,
        userEmail,
        amount,
        destination,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        settledAt: null,
        providerReference: null,
      });
    });

    await createUserNotification(
      uid,
      'Withdrawal Initiated',
      `Your withdrawal request of ₹${(amount / 100).toFixed(2)} has been registered and is undergoing compliance review.`,
      'WITHDRAWAL_CREATED'
    );

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * ADMIN WITHDRAWAL REVIEW: Approve, Settle or Reject
 */
export async function adminProcessWithdrawal(
  adminUid: string,
  adminEmail: string,
  withdrawalId: string,
  action: 'approve' | 'settle' | 'reject',
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const withdrawalRef = doc(db, 'withdrawals', withdrawalId);
    const snap = await getDoc(withdrawalRef);
    if (!snap.exists()) {
      return { success: false, error: 'Withdrawal not found' };
    }
    const w = snap.data();
    const walletRef = doc(db, 'wallets', w.uid);

    if (action === 'approve') {
      await updateDoc(withdrawalRef, {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        reviewedBy: adminEmail,
      });
      await recordAdminLog(
        adminUid,
        adminEmail,
        'ADMIN_APPROVED_WITHDRAWAL',
        'withdrawal',
        withdrawalId,
        'Approved by compliance officer'
      );
      await createUserNotification(
        w.uid,
        'Withdrawal Approved',
        `Your withdrawal request for ₹${(w.amount / 100).toFixed(2)} was approved and queued for payout settlement.`,
        'WITHDRAWAL_APPROVED'
      );
    } else if (action === 'settle') {
      // Settlement provider confirms payout transfer
      const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const txDocRef = doc(db, 'transactions', txId);
      const providerRef = `SETTLE_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      await runTransaction(db, async (t) => {
        const walletSnap = await t.get(walletRef);
        if (!walletSnap.exists()) throw new Error('Wallet not found');
        const wallet = walletSnap.data() as Wallet;

        // Deduct from locked balance permanently
        t.update(walletRef, {
          lockedBalance: Math.max(0, (wallet.lockedBalance || 0) - w.amount),
          updatedAt: new Date().toISOString(),
        });

        // Mark withdrawal settled
        t.update(withdrawalRef, {
          status: 'settled',
          settledAt: new Date().toISOString(),
          providerReference: providerRef,
          reviewedBy: adminEmail,
        });

        // Write immutable ledger entry
        t.set(txDocRef, {
          transactionId: txId,
          uid: w.uid,
          type: 'DEBIT',
          category: 'WITHDRAWAL',
          amount: w.amount,
          status: 'completed',
          referenceId: withdrawalId,
          description: `Withdrawal payout settled via ${w.destination?.type || 'UPI'} (${w.destination?.value || ''})`,
          createdAt: new Date().toISOString(),
        });
      });

      await recordAdminLog(
        adminUid,
        adminEmail,
        'ADMIN_SETTLED_WITHDRAWAL',
        'withdrawal',
        withdrawalId,
        `Settled via provider ref ${providerRef}`
      );
      await createUserNotification(
        w.uid,
        'Withdrawal Dispatched & Settled',
        `₹${(w.amount / 100).toFixed(2)} has been successfully transferred to your ${w.destination?.type} account. Reference: ${providerRef}`,
        'WITHDRAWAL_SETTLED'
      );
    } else if (action === 'reject') {
      // Unlock balance back to available
      await runTransaction(db, async (t) => {
        const walletSnap = await t.get(walletRef);
        if (!walletSnap.exists()) throw new Error('Wallet not found');
        const wallet = walletSnap.data() as Wallet;

        t.update(walletRef, {
          availableBalance: wallet.availableBalance + w.amount,
          lockedBalance: Math.max(0, (wallet.lockedBalance || 0) - w.amount),
          updatedAt: new Date().toISOString(),
        });

        t.update(withdrawalRef, {
          status: 'rejected',
          reviewedAt: new Date().toISOString(),
          reviewedBy: adminEmail,
          rejectionReason: reason || 'Information discrepancy or compliance rejection',
        });
      });

      await recordAdminLog(
        adminUid,
        adminEmail,
        'ADMIN_REJECTED_WITHDRAWAL',
        'withdrawal',
        withdrawalId,
        reason || 'Rejected by compliance'
      );
      await createUserNotification(
        w.uid,
        'Withdrawal Rejected',
        `Your withdrawal request of ₹${(w.amount / 100).toFixed(2)} was rejected: ${reason || 'Contact support'}. Reserved funds have been restored to your balance.`,
        'WITHDRAWAL_REJECTED'
      );
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * DEPOSIT INITIATION
 */
export async function createDepositRequest(
  uid: string,
  userEmail: string,
  amount: number,
  paymentMethod: string,
  providerReference: string
): Promise<{ success: boolean; depositId?: string; error?: string }> {
  try {
    if (amount <= 0) {
      return { success: false, error: 'Deposit amount must be greater than zero.' };
    }

    const depositId = `dep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const depositRef = doc(db, 'deposits', depositId);

    await setDoc(depositRef, {
      depositId,
      uid,
      userEmail,
      amount,
      paymentMethod,
      providerReference,
      status: 'pending',
      createdAt: new Date().toISOString(),
      verifiedAt: null,
      verifiedBy: null,
    });

    await createUserNotification(
      uid,
      'Deposit Pending Verification',
      `Deposit request for ₹${(amount / 100).toFixed(2)} (Ref: ${providerReference}) submitted. Verification will finalize balance.`,
      'DEPOSIT_RECEIVED'
    );

    return { success: true, depositId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * DEPOSIT VERIFICATION & SETTLEMENT
 */
export async function adminVerifyDeposit(
  adminUid: string,
  adminEmail: string,
  depositId: string,
  approve: boolean,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const depositRef = doc(db, 'deposits', depositId);
    const snap = await getDoc(depositRef);
    if (!snap.exists()) {
      return { success: false, error: 'Deposit record not found' };
    }
    const d = snap.data();
    if (d.status === 'completed') {
      return { success: false, error: 'Deposit already completed.' };
    }

    const walletRef = doc(db, 'wallets', d.uid);
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const txDocRef = doc(db, 'transactions', txId);

    if (approve) {
      await runTransaction(db, async (t) => {
        const walletSnap = await t.get(walletRef);
        if (!walletSnap.exists()) throw new Error('Wallet not found');
        const wallet = walletSnap.data() as Wallet;

        // 1. Credit wallet available balance
        t.update(walletRef, {
          availableBalance: wallet.availableBalance + d.amount,
          updatedAt: new Date().toISOString(),
        });

        // 2. Mark deposit completed
        t.update(depositRef, {
          status: 'completed',
          verifiedAt: new Date().toISOString(),
          verifiedBy: adminEmail,
        });

        // 3. Write immutable transaction ledger entry
        t.set(txDocRef, {
          transactionId: txId,
          uid: d.uid,
          type: 'CREDIT',
          category: 'DEPOSIT',
          amount: d.amount,
          status: 'completed',
          referenceId: depositId,
          description: `Verified deposit via ${d.paymentMethod || 'UPI'} (Ref: ${d.providerReference})`,
          createdAt: new Date().toISOString(),
        });
      });

      await recordAdminLog(
        adminUid,
        adminEmail,
        'ADMIN_VERIFIED_DEPOSIT',
        'deposit',
        depositId,
        'Payment confirmed via provider statement'
      );
      await createUserNotification(
        d.uid,
        'Deposit Confirmed & Credited',
        `₹${(d.amount / 100).toFixed(2)} has been confirmed and credited to your available balance.`,
        'DEPOSIT_COMPLETED'
      );
    } else {
      await updateDoc(depositRef, {
        status: 'rejected',
        verifiedAt: new Date().toISOString(),
        verifiedBy: adminEmail,
      });
      await recordAdminLog(
        adminUid,
        adminEmail,
        'ADMIN_REJECTED_DEPOSIT',
        'deposit',
        depositId,
        reason || 'Invalid or duplicate reference'
      );
      await createUserNotification(
        d.uid,
        'Deposit Verification Failed',
        `Your deposit of ₹${(d.amount / 100).toFixed(2)} could not be verified: ${reason || 'Check reference'}.`,
        'DEPOSIT_FAILED'
      );
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * SUPPORT TICKET OPERATIONS
 */
export async function createSupportTicket(
  uid: string,
  userEmail: string,
  subject: string,
  category: string,
  initialMessage: string,
  priority: TicketPriority = 'normal'
): Promise<{ success: boolean; ticketId?: string; error?: string }> {
  try {
    const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const ticketRef = doc(db, 'supportTickets', ticketId);
    const now = new Date().toISOString();

    await setDoc(ticketRef, {
      ticketId,
      uid,
      userEmail,
      subject,
      category,
      priority,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      lastMessage: initialMessage,
    });

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const msgRef = doc(db, 'supportTickets', ticketId, 'messages', msgId);
    await setDoc(msgRef, {
      messageId: msgId,
      senderUid: uid,
      senderRole: 'user',
      senderName: userEmail,
      message: initialMessage,
      createdAt: now,
    });

    return { success: true, ticketId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function sendTicketMessage(
  ticketId: string,
  senderUid: string,
  senderRole: UserRole,
  senderName: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const msgRef = doc(db, 'supportTickets', ticketId, 'messages', msgId);

    await setDoc(msgRef, {
      messageId: msgId,
      senderUid,
      senderRole,
      senderName,
      message,
      createdAt: now,
    });

    const ticketRef = doc(db, 'supportTickets', ticketId);
    await updateDoc(ticketRef, {
      updatedAt: now,
      lastMessage: message,
      status: senderRole === 'user' ? 'open' : 'waiting_for_user',
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  priority?: TicketPriority
): Promise<void> {
  const ticketRef = doc(db, 'supportTickets', ticketId);
  const updates: Record<string, unknown> = {
    status,
    updatedAt: new Date().toISOString(),
  };
  if (priority) updates.priority = priority;
  await updateDoc(ticketRef, updates);
}

/**
 * ADMIN USER MANAGEMENT
 */
export async function adminUpdateUserStatus(
  adminUid: string,
  adminEmail: string,
  targetUid: string,
  newStatus: UserStatus,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRef = doc(db, 'users', targetUid);
    await updateDoc(userRef, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });

    await recordAdminLog(
      adminUid,
      adminEmail,
      `ADMIN_${newStatus.toUpperCase()}_USER`,
      'user',
      targetUid,
      reason
    );

    await createUserNotification(
      targetUid,
      'Account Status Update',
      `Your account status was updated to "${newStatus}": ${reason}`,
      'ACCOUNT_STATUS_CHANGED'
    );

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function adminUpdateUserRole(
  adminUid: string,
  adminEmail: string,
  targetUid: string,
  newRole: UserRole,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRef = doc(db, 'users', targetUid);
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: new Date().toISOString(),
    });

    if (newRole === 'admin' || newRole === 'super_admin') {
      await setDoc(doc(db, 'admins', targetUid), {
        uid: targetUid,
        role: newRole,
        updatedAt: new Date().toISOString(),
      });
    }

    await recordAdminLog(
      adminUid,
      adminEmail,
      'ADMIN_UPDATED_ROLE',
      'user',
      targetUid,
      `Promoted to ${newRole}: ${reason}`
    );

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Fetch platform settings
 */
export async function getPlatformSettings(): Promise<PlatformSettings | null> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'platform'));
    if (snap.exists()) {
      return snap.data() as PlatformSettings;
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch platform settings:', err);
    return null;
  }
}

/**
 * Update platform settings (Admins only)
 */
export async function updatePlatformSettings(
  partial: Partial<PlatformSettings>,
  adminUid?: string,
  adminEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const settingsDoc = doc(db, 'settings', 'platform');
    const updateData = {
      ...partial,
      updatedAt: new Date().toISOString(),
      ...(adminUid ? { updatedBy: adminEmail || adminUid } : {}),
    };
    await setDoc(settingsDoc, updateData, { merge: true });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Manually adjust user wallet balance (Admin only)
 */
export async function adminAdjustUserBalance(
  adminUid: string,
  adminEmail: string,
  targetUid: string,
  type: 'CREDIT' | 'DEBIT',
  amountUnits: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (amountUnits <= 0) {
      return { success: false, error: 'Adjustment amount must be greater than zero.' };
    }
    const walletRef = doc(db, 'wallets', targetUid);
    const txId = `adj_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const txDocRef = doc(db, 'transactions', txId);

    await runTransaction(db, async (t) => {
      const walletSnap = await t.get(walletRef);
      if (!walletSnap.exists()) {
        throw new Error('User wallet does not exist');
      }
      const wallet = walletSnap.data() as Wallet;

      let newAvailable = wallet.availableBalance;
      if (type === 'CREDIT') {
        newAvailable += amountUnits;
      } else {
        if (wallet.availableBalance < amountUnits) {
          throw new Error(
            `Insufficient available balance (Current: ₹${(wallet.availableBalance / 100).toFixed(2)})`
          );
        }
        newAvailable -= amountUnits;
      }

      t.update(walletRef, {
        availableBalance: newAvailable,
        updatedAt: new Date().toISOString(),
      });

      t.set(txDocRef, {
        transactionId: txId,
        uid: targetUid,
        type,
        category: 'ADMIN_ADJUSTMENT',
        amount: amountUnits,
        status: 'completed',
        referenceId: adminUid,
        description: `Admin manual balance adjustment (${type === 'CREDIT' ? 'Credit' : 'Debit'}): ${reason}`,
        createdAt: new Date().toISOString(),
      });
    });

    await recordAdminLog(
      adminUid,
      adminEmail,
      `ADMIN_${type}_BALANCE`,
      'wallet',
      targetUid,
      `Amount ₹${(amountUnits / 100).toFixed(2)}: ${reason}`
    );

    await createUserNotification(
      targetUid,
      'Wallet Balance Adjusted',
      `An administrative balance adjustment of ${type === 'CREDIT' ? '+' : '-'}₹${(amountUnits / 100).toFixed(2)} was processed on your account. Note: ${reason}`,
      'WALLET_ADJUSTMENT'
    );

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Force seed default plans if needed
 */
export async function forceSeedDefaultPlans(
  adminUid: string,
  adminEmail: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    let created = 0;
    for (const p of DEFAULT_PLANS) {
      const id = p.id || `plan_${Math.random().toString(36).substring(2, 9)}`;
      await setDoc(doc(db, 'plans', id), {
        ...p,
        id,
        planId: id,
        createdAt: new Date().toISOString(),
        createdBy: adminEmail,
      });
      created++;
    }

    await recordAdminLog(
      adminUid,
      adminEmail,
      'ADMIN_SEEDED_PLANS',
      'plans',
      'batch',
      `Seeded ${created} default investment plans`
    );

    return { success: true, count: created };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, count: 0, error: msg };
  }
}
