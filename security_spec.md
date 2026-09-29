# Security Specification & Threat Model — AetherLedger

## 1. Data Invariants
1. Identity Isolation: A user cannot modify another user's profile, wallet, transactions, sessions, deposits, withdrawals, support tickets, or notifications.
2. RBAC Immutability: Standard users cannot elevate their role to `support`, `admin`, or `super_admin`, nor modify account `status`.
3. Financial Ledger Integrity: Wallet balance mutations cannot occur without authentic ledger transactions. Balances must be non-negative integers.
4. Terminal State Protection: Completed or rejected deposits, withdrawals, and sessions cannot be reopened or mutated.
5. System-Only & Administrative Gates: Settings, plans, and administrative audit logs can only be created or modified by verified administrators (`itsalexbro0021@gmail.com` or verified role).
6. Temporal Integrity: `createdAt` and `updatedAt` timestamps must strictly validate against server time.
7. Denial of Wallet / Resource Bounding: All string fields must adhere to strict max lengths; no oversized arrays or untyped data.
8. Query Privacy: List operations must enforce owner UID matches; no blanket cross-tenant scraping.

## 2. The Dirty Dozen Payloads
1. **Privilege Escalation on User Creation**: Creating a user document with `role: "super_admin"`.
2. **Account Status Manipulation**: Regular user updating status to `"suspended"` or `"active"`.
3. **Wallet Direct Balance Forgery**: Direct client write setting `availableBalance: 99999999`.
4. **Negative Balance Exploitation**: Setting `availableBalance: -5000`.
5. **Cross-Tenant Wallet Read/Write**: User A attempting to read or write `/wallets/UserB`.
6. **Cross-Tenant Transaction Forgery**: User A creating a CREDIT transaction in User B's ledger.
7. **Session Expiry Manipulation**: User modifying `endsAt` or manually setting `status: "completed"`.
8. **Unauthorized Plan Alteration**: Non-admin modifying plan `amount` or `returnRateBps`.
9. **Deposit Self-Verification**: User setting deposit `status: "completed"` without admin/payment webhook verification.
10. **Withdrawal Terminal Replay**: Attempting to alter a `settled` or `rejected` withdrawal.
11. **Admin Audit Log Tampering**: Deleting or editing records in `/adminLogs`.
12. **Settings Override**: Non-admin updating platform fees or min-withdrawal thresholds in `/settings/platform`.

## 3. Security Verification Checklist
- [x] Catch-all default deny `match /{document=**} { allow read, write: if false; }`
- [x] Helper `isAdmin()` checks email `itsalexbro0021@gmail.com` with `email_verified == true` or role check.
- [x] Immutability guards on `createdAt` and `uid`.
- [x] Context-aware guards preventing null `request.resource` in read/delete blocks.
