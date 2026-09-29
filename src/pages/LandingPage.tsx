import React, { useState } from 'react';
import { AetherLedgerLogo, AetherLedgerEmblem } from '../components/AetherLedgerLogo';
import {
  ShieldCheck,
  TrendingUp,
  Lock,
  Zap,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Clock,
  Layers,
  FileCheck,
  Award,
  ChevronRight,
  Shield,
  CreditCard,
} from 'lucide-react';
import { formatCurrency, formatDuration, formatBps } from '../lib/firebase';
import { DEFAULT_PLANS } from '../services/ledgerService';

interface LandingPageProps {
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onSelectPlan?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth, onSelectPlan }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does the session lifecycle operate on AetherLedger?',
      a: 'Users allocate available wallet balances into programmatic sessions with predefined time locks and yield parameters. All financial movements are recorded into an immutable Firestore ledger.',
    },
    {
      q: 'What is the Registration Welcome Balance?',
      a: 'Every newly created account is automatically provisioned with an initial ₹145.00 promotional balance atomically upon first registration. This balance can be deployed towards eligible sessions.',
    },
    {
      q: 'What is the minimum withdrawal threshold and settlement process?',
      a: 'The minimum withdrawal is ₹300.00. Once requested, your funds are safely reserved in a locked state while our automated compliance checks review account status before routing to UPI or bank settlement.',
    },
    {
      q: 'Are client balances protected from client-side tampering?',
      a: 'Yes. The frontend client is never authoritative for financial balances or yields. All operations are strictly evaluated server-side using atomic Firestore transactions with comprehensive attribute-based security rules.',
    },
  ];

  return (
    <div className="text-slate-100 min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto">
            {/* New Official Brand Logo Emblem */}
            <div className="flex justify-center mb-6">
              <div className="relative group cursor-pointer" onClick={() => onOpenAuth('register')}>
                <div className="absolute -inset-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 rounded-3xl blur-md opacity-60 group-hover:opacity-90 transition duration-500" />
                <AetherLedgerEmblem size={88} className="relative shadow-2xl rounded-2xl" />
              </div>
            </div>

            {/* Pill Banner */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-semibold text-cyan-400 mb-6 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Real-Time Firebase Firestore & Ledger Active</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Institutional Asset &{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Session Management
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Experience production-grade financial session tracking backed by an immutable transaction ledger,
              atomic balance verification, and real-time Firebase Authentication.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                onClick={() => onOpenAuth('register')}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Get Started & Claim ₹145</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => onOpenAuth('login')}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-base transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Sign In to Dashboard</span>
              </button>
            </div>

            {/* Micro stats banner */}
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto pt-8 border-t border-slate-800/80">
              <div className="text-center">
                <div className="text-2xl font-bold text-white tracking-tight">₹145.00</div>
                <div className="text-xs text-slate-400 mt-0.5">Welcome Credit</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400 tracking-tight">100%</div>
                <div className="text-xs text-slate-400 mt-0.5">Ledger Traceability</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white tracking-tight">₹300.00</div>
                <div className="text-xs text-slate-400 mt-0.5">Min Payout</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-teal-400 tracking-tight">Real-time</div>
                <div className="text-xs text-slate-400 mt-0.5">Firestore Sync</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-slate-900/60 border-y border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs uppercase font-bold text-emerald-400 tracking-wider">Operational Lifecycle</h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1">How AetherLedger Operates</h3>
            <p className="text-sm text-slate-400 mt-2">
              Every balance movement is mathematically validated and logged into an append-only ledger.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Register & Setup',
                desc: 'Sign in with Google or Email. Your profile and wallet are atomically initialized with ₹145.00.',
                icon: ShieldCheck,
              },
              {
                step: '02',
                title: 'Select Session Plan',
                desc: 'Review yield parameters, durations (from 1-Hour testing to 7-Day Prime), and confirm deployment.',
                icon: Clock,
              },
              {
                step: '03',
                title: 'Automated Maturity',
                desc: 'The backend lifecycle engine checks expiration and credits both principal & returns directly.',
                icon: Zap,
              },
              {
                step: '04',
                title: 'Verified Settlement',
                desc: 'Initiate withdrawal to your UPI or Bank. Funds are locked and settled following compliance review.',
                icon: CreditCard,
              },
            ].map((step, idx) => {
              const Icon = step.icon;
              return (
                <div
                  key={idx}
                  className="relative p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all group"
                >
                  <div className="text-3xl font-black text-slate-800 group-hover:text-emerald-500/30 transition-colors mb-3">
                    {step.step}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold text-white">{step.title}</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Plans Preview */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10">
            <div>
              <h2 className="text-xs uppercase font-bold text-emerald-400 tracking-wider">Product Offerings</h2>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1">Available Allocation Plans</h3>
            </div>
            <button
              onClick={() => onOpenAuth('register')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold flex items-center gap-2 border border-slate-700"
            >
              <span>Explore All Plans</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {DEFAULT_PLANS.map((plan, idx) => {
              const configuredYield = Math.floor((plan.amount * plan.returnRateBps) / 10000);
              const totalPayout = plan.amount + configuredYield;

              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition-all flex flex-col justify-between relative overflow-hidden"
                >
                  {idx === 1 && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider">
                      Popular
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {formatDuration(plan.durationSeconds)} Duration
                    </div>
                    <h4 className="text-lg font-bold text-white mt-1">{plan.name}</h4>
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">{plan.description}</p>

                    <div className="mt-6 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Principal</span>
                        <span className="font-bold text-white">{formatCurrency(plan.amount)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Configured Return</span>
                        <span className="font-bold text-emerald-400">+{formatBps(plan.returnRateBps)}</span>
                      </div>
                      <div className="border-t border-slate-800 pt-2 flex justify-between text-xs font-semibold">
                        <span className="text-slate-300">Total at Maturity</span>
                        <span className="text-emerald-300">{formatCurrency(totalPayout)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenAuth('login')}
                    className="mt-6 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Deploy Session</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security Architecture */}
      <section className="py-16 bg-slate-900/40 border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400 mb-4">
                <Shield className="w-3.5 h-3.5" />
                <span>Zero-Trust Security Engine</span>
              </div>
              <h3 className="text-3xl font-bold text-white tracking-tight">
                Architected with Multi-Tier Access Control
              </h3>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                The platform enforces strict separation between identity, data persistence, and transaction validation.
                Client applications never have direct write access to monetary ledgers or session state outcomes.
              </p>

              <div className="mt-6 space-y-4">
                {[
                  {
                    title: 'Atomic Firestore Transactions',
                    desc: 'Balance deductions and session activations happen within a single atomic commit, eliminating race conditions.',
                  },
                  {
                    title: 'Dual-Gate Withdrawal Review',
                    desc: 'Capital withdrawals lock balances instantly before compliance evaluation and settlement provider verification.',
                  },
                  {
                    title: 'Immutable Admin Audit Trails',
                    desc: 'Every administrative intervention (approvals, suspensions, plan adjustments) is recorded permanently.',
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-bold text-white">{item.title}</h5>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl relative">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center justify-between">
                <span>System Architecture Flow</span>
                <span className="text-emerald-400">Live Enforced</span>
              </div>
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">1. Client Request</span>
                  <span className="text-slate-500">HTTPS / TLS 1.3</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">2. Firebase Authentication</span>
                  <span className="text-emerald-400">JWT Token Verified</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">3. Security Rules ABAC</span>
                  <span className="text-cyan-400">Strict Match</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">4. Immutable Ledger Record</span>
                  <span className="text-emerald-400">Atomic Write</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">5. Settlement Provider</span>
                  <span className="text-amber-400">HMAC Webhook</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-xs uppercase font-bold text-emerald-400 tracking-wider">Frequently Asked</h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1">Platform Questions</h3>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between text-sm font-semibold text-slate-200 hover:text-white"
                >
                  <span>{faq.q}</span>
                  <ChevronRight
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      openFaq === idx ? 'rotate-90 text-emerald-400' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-800 bg-slate-950 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <AetherLedgerLogo size="sm" />

          <div className="text-center md:text-right text-slate-500 max-w-xl">
            Financial asset allocation and session participation involve institutional risk.
            All settlements are subject to compliance verification and provider authorization.
          </div>
        </div>
      </footer>
    </div>
  );
};
