import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { PlansPage } from './pages/PlansPage';
import { WalletPage } from './pages/WalletPage';
import { SessionsPage } from './pages/SessionsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { SupportPage } from './pages/SupportPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { seedInitialPlansIfEmpty, seedSettingsIfEmpty } from './services/ledgerService';
import { AetherLedgerEmblem } from './components/AetherLedgerLogo';

function AppContent() {
  const { currentUser, loading, isAdmin } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('landing');
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Direct modal triggers for deposit / withdraw
  const [depositModalOpen, setDepositModalOpen] = useState<boolean>(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState<boolean>(false);

  // Initialize platform seeds only when admin is authenticated
  useEffect(() => {
    if (isAdmin) {
      seedInitialPlansIfEmpty(true);
      seedSettingsIfEmpty(true);
    }
  }, [isAdmin]);

  // Sync page state when user logs in / out
  useEffect(() => {
    if (!loading) {
      if (currentUser && currentPage === 'landing') {
        setCurrentPage('dashboard');
      } else if (!currentUser && currentPage !== 'landing') {
        setCurrentPage('landing');
      }
    }
  }, [currentUser, loading]);

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleNavigate = (page: string) => {
    if (!currentUser && page !== 'landing') {
      handleOpenAuth('login');
      return;
    }
    // UX protection for admin route
    if (page === 'admin' && !isAdmin) {
      setCurrentPage('dashboard');
      return;
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 p-4">
        <div className="relative mb-6">
          <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-3xl blur-lg opacity-40 animate-pulse" />
          <AetherLedgerEmblem size={64} className="relative rounded-2xl shadow-2xl" />
        </div>
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs uppercase font-mono tracking-widest text-cyan-400 font-bold">
          Connecting to AetherLedger...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950 pb-16 md:pb-0">
      {/* Top Navbar */}
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenAuth={() => handleOpenAuth('login')}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentPage === 'landing' && (
          <LandingPage onOpenAuth={handleOpenAuth} />
        )}
        {currentPage === 'dashboard' && currentUser && (
          <DashboardPage
            onNavigate={handleNavigate}
            onOpenDeposit={() => {
              setCurrentPage('wallet');
              setDepositModalOpen(true);
            }}
            onOpenWithdraw={() => {
              setCurrentPage('wallet');
              setWithdrawModalOpen(true);
            }}
          />
        )}
        {currentPage === 'plans' && (
          <PlansPage
            onNavigate={handleNavigate}
            onOpenDeposit={() => {
              setCurrentPage('wallet');
              setDepositModalOpen(true);
            }}
          />
        )}
        {currentPage === 'wallet' && (
          <WalletPage
            onNavigate={handleNavigate}
            depositModalOpen={depositModalOpen}
            withdrawModalOpen={withdrawModalOpen}
            onCloseModals={() => {
              setDepositModalOpen(false);
              setWithdrawModalOpen(false);
            }}
          />
        )}
        {currentPage === 'sessions' && (
          <SessionsPage onNavigate={handleNavigate} />
        )}
        {currentPage === 'transactions' && <TransactionsPage />}
        {currentPage === 'support' && <SupportPage />}
        {currentPage === 'profile' && (
          <ProfilePage onNavigate={handleNavigate} />
        )}
        {currentPage === 'notifications' && <NotificationsPage />}
        {currentPage === 'admin' && <AdminDashboard />}
      </main>

      {/* Mobile-First Bottom Navigation Bar */}
      <BottomNav currentPage={currentPage} onNavigate={handleNavigate} />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
