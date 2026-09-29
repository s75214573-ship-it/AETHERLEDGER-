import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType, testFirestoreConnection } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSupport: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfileData: (displayName: string, photoURL?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BOOTSTRAP_ADMIN_EMAILS = [
  'itsalexbro0021@gmail.com',
  's75214573@gmail.com',
];

export const isBootstrapAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const target = email.toLowerCase().trim();
  return BOOTSTRAP_ADMIN_EMAILS.some((adm) => adm.toLowerCase().trim() === target);
};

const REGISTRATION_REWARD_UNITS = 14500; // ₹145.00

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initial connection test
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Ensure user profile & wallet setup occurs atomically
        await initializeUserAccount(user);

        // Subscribe to user profile document for real-time role / status updates
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeDoc = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile(docSnap.data() as UserProfile);
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          }
        );

        setLoading(false);
        return () => unsubscribeDoc();
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Server-like idempotent account initializer
  const initializeUserAccount = async (user: FirebaseUser) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const walletDocRef = doc(db, 'wallets', user.uid);

      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userDocRef);

        const isSuperAdminEmail = isBootstrapAdminEmail(user.email);

        if (!userSnap.exists()) {
          // 1. Create User Document
          const initialRole: UserRole = isSuperAdminEmail ? 'super_admin' : 'user';
          const newUser: UserProfile = {
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Member',
            email: user.email || '',
            photoURL: user.photoURL || null,
            role: initialRole,
            status: 'active',
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            rewardClaimed: true,
          };
          transaction.set(userDocRef, newUser);

          // 2. Create Wallet Document with registration reward
          transaction.set(walletDocRef, {
            uid: user.uid,
            availableBalance: REGISTRATION_REWARD_UNITS,
            pendingBalance: 0,
            lockedBalance: 0,
            updatedAt: new Date().toISOString(),
          });

          // 3. Create initial immutable transaction in ledger
          const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const txDocRef = doc(db, 'transactions', txId);
          transaction.set(txDocRef, {
            transactionId: txId,
            uid: user.uid,
            type: 'CREDIT',
            category: 'REGISTRATION_REWARD',
            amount: REGISTRATION_REWARD_UNITS,
            status: 'completed',
            referenceId: 'WELCOME_BONUS',
            description: 'New account registration welcome reward (₹145.00)',
            createdAt: new Date().toISOString(),
          });

          // 4. Create welcome notification
          const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const notifDocRef = doc(db, 'notifications', notifId);
          transaction.set(notifDocRef, {
            notificationId: notifId,
            uid: user.uid,
            title: 'Welcome Reward Credited',
            message: 'Your ₹145.00 signup bonus has been securely credited to your wallet ledger.',
            type: 'REGISTRATION',
            read: false,
            createdAt: new Date().toISOString(),
          });

          // Also set admins record if super admin email
          if (isSuperAdminEmail) {
            const adminDocRef = doc(db, 'admins', user.uid);
            transaction.set(adminDocRef, {
              uid: user.uid,
              email: user.email,
              role: 'super_admin',
              grantedAt: new Date().toISOString(),
            });
          }
        } else {
          // If already exists, update last login & sync super admin role if bootstrap admin
          const existingData = userSnap.data() as UserProfile;
          const updates: Partial<UserProfile> = {
            lastLoginAt: new Date().toISOString(),
          };
          if (isSuperAdminEmail && existingData.role !== 'super_admin') {
            updates.role = 'super_admin';
          }
          transaction.update(userDocRef, updates);
        }
      });
    } catch (err) {
      console.error('Account initialization error:', err);
    }
  };

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google Sign-in failed', error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error('Email sign in failed', error);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, pass: string, displayName: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (cred.user) {
        await updateProfile(cred.user, { displayName });
      }
    } catch (error) {
      console.error('Email registration failed', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset failed', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out failed', error);
      throw error;
    }
  };

  const updateUserProfileData = async (displayName: string, photoURL?: string) => {
    if (!currentUser) return;
    try {
      await updateProfile(currentUser, { displayName, photoURL });
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(
        userRef,
        {
          displayName,
          photoURL: photoURL || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  };

  const isSuperAdminEmail = isBootstrapAdminEmail(currentUser?.email);

  const isAdmin =
    isSuperAdminEmail ||
    userProfile?.role === 'admin' ||
    userProfile?.role === 'super_admin';

  const isSupport =
    isAdmin || userProfile?.role === 'support';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isAdmin,
        isSupport,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
        updateUserProfileData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
