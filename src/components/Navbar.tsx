import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/firebase';
import { AetherLedgerLogo } from './AetherLedgerLogo';
import {
  Wallet as WalletIcon,
  Bell,
  Menu,
  X,
  TrendingUp,
  Clock,
  HelpCircle,
  FileText,
  User,
  LogOut,
  ChevronDown,
  ShieldAlert,
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppNotification, Wallet } from '../types';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate, onOpenAuth }) => {
  const { currentUser, userProfile, isAdmin, logout } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState<boolean>(false);

  // Listen to user wallet
  useEffect(() => {
    if (!currentUser) {
      setWallet(null);
      return;
    }
    const walletDoc = doc(db, 'wallets', currentUser.uid);
    const unsub = onSnapshot(
      walletDoc,
      (snap) => {
        if (snap.exists()) {
          setWallet(snap.data() as Wallet);
        }
      },
      (error) => {
        console.warn('Navbar wallet listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Listen to unread notifications
  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }
    const notifQuery = query(
      collection(db, 'notifications'),
      where('uid', '==', currentUser.uid),
      where('read', '==', false)
    );
    const unsub = onSnapshot(
      notifQuery,
      (snap) => {
        setUnreadCount(snap.size);
      },
      (error) => {
        console.warn('Navbar notifications listener notice:', error);
      }
    );
    return () => unsub();
  }, [currentUser]);

  const navLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'plans', label: 'Sessions & Plans', icon: Clock },
    { id: 'wallet', label: 'Wallet', icon: WalletIcon },
    { id: 'transactions', label: 'Ledger', icon: FileText },
    { id: 'support', label: 'Support', icon: HelpCircle },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            onClick={() => onNavigate(currentUser ? 'dashboard' : 'landing')}
            className="cursor-pointer select-none"
          >
            <AetherLedgerLogo size="md" />
          </div>

          {/* Desktop Navigation */}
          {currentUser && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = currentPage === link.id;
                return (
                  <button
                    key={link.id}
                    onClick={() => onNavigate(link.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-slate-800 text-emerald-400 shadow-inner'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </button>
                );
              })}

              {isAdmin && (
                <button
                  onClick={() => onNavigate('admin')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    currentPage === 'admin'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'text-amber-400 hover:bg-amber-500/10'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Admin Panel</span>
                </button>
              )}
            </nav>
          )}

          {/* Right Header: Wallet pill, Notifications & Profile */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <>
                {/* Balance Badge */}
                <div
                  onClick={() => onNavigate('wallet')}
                  className="cursor-pointer hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 hover:border-emerald-500/40 transition-all text-xs"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-slate-400">Available:</span>
                  <span className="font-bold text-emerald-400">
                    {formatCurrency(wallet?.availableBalance ?? 0)}
                  </span>
                </div>

                {/* Notifications Bell */}
                <button
                  onClick={() => onNavigate('notifications')}
                  className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center animate-bounce">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Profile Menu Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800 transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center font-bold text-white text-xs shadow">
                      {userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                  </button>

                  {profileDropdownOpen && (
                    <div
                      onMouseLeave={() => setProfileDropdownOpen(false)}
                      className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50 text-sm"
                    >
                      <div className="px-4 py-2 border-b border-slate-800">
                        <div className="font-semibold text-slate-100 truncate">
                          {userProfile?.displayName || 'User'}
                        </div>
                        <div className="text-xs text-slate-400 truncate">{currentUser.email}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                            {userProfile?.role || 'user'}
                          </span>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                            {userProfile?.status || 'active'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onNavigate('profile');
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2.5"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        <span>Profile & Security</span>
                      </button>

                      <button
                        onClick={() => {
                          onNavigate('wallet');
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2.5"
                      >
                        <WalletIcon className="w-4 h-4 text-slate-400" />
                        <span>Wallet & Payouts</span>
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => {
                            onNavigate('admin');
                            setProfileDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-amber-500/10 text-amber-400 flex items-center gap-2.5"
                        >
                          <ShieldAlert className="w-4 h-4 text-amber-400" />
                          <span>Admin Console</span>
                        </button>
                      )}

                      <div className="border-t border-slate-800 my-1" />

                      <button
                        onClick={async () => {
                          setProfileDropdownOpen(false);
                          await logout();
                          onNavigate('landing');
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-red-500/10 text-red-400 flex items-center gap-2.5"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile Hamburger Toggle */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenAuth}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20"
                >
                  Sign In / Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && currentUser && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900/98 px-4 pt-3 pb-5 space-y-1">
          <div className="p-3 mb-2 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
            <span className="text-xs text-slate-400">Available Balance:</span>
            <span className="font-bold text-emerald-400 text-sm">
              {formatCurrency(wallet?.availableBalance ?? 0)}
            </span>
          </div>

          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = currentPage === link.id;
            return (
              <button
                key={link.id}
                onClick={() => {
                  onNavigate(link.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-slate-800 text-emerald-400'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{link.label}</span>
              </button>
            );
          })}

          {isAdmin && (
            <button
              onClick={() => {
                onNavigate('admin');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-amber-400 bg-amber-500/10"
            >
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <span>Admin Console</span>
            </button>
          )}

          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={async () => {
                setMobileMenuOpen(false);
                await logout();
                onNavigate('landing');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
