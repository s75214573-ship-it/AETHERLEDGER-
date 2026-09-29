import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  useImage?: boolean;
  className?: string;
  subtitle?: string;
}

export const AetherLedgerEmblem: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <defs>
        {/* Glow filter */}
        <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Outer Orbit Glow */}
        <filter id="ringGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Gradients */}
        <linearGradient id="orbitGrad" x1="20" y1="90" x2="180" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#00c0ff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
        </linearGradient>

        <linearGradient id="legLeft" x1="60" y1="140" x2="100" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="45%" stopColor="#00b4d8" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>

        <linearGradient id="legRight" x1="100" y1="40" x2="148" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0077b6" />
          <stop offset="60%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>

        <linearGradient id="apexFold" x1="88" y1="36" x2="114" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        <linearGradient id="blockTop" x1="80" y1="90" x2="120" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>

        <linearGradient id="blockFront" x1="80" y1="100" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>

      {/* Background soft dark pill container if needed */}
      <rect width="200" height="200" rx="44" fill="#040918" />

      {/* Orbiting elliptical ring (back part) */}
      <path
        d="M 35 110 C 25 78, 120 40, 172 70"
        stroke="url(#orbitGrad)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        filter="url(#ringGlow)"
        opacity="0.5"
      />

      {/* Left Leg of A */}
      <path
        d="M 52 142 L 88 48 C 91 40, 100 40, 103 48 L 115 76 L 82 142 Z"
        fill="url(#legLeft)"
      />

      {/* Right Leg of A */}
      <path
        d="M 98 48 L 148 142 L 120 142 L 88 78 Z"
        fill="url(#legRight)"
      />

      {/* Apex Fold Ribbon */}
      <path
        d="M 88 48 C 93 36, 107 36, 112 48 L 100 76 Z"
        fill="url(#apexFold)"
      />

      {/* Stacked 3D Isometric Ledger Blocks in center */}
      {/* Block 1 (Top) */}
      <g transform="translate(0, -6)">
        <polygon points="100,80 114,87 100,94 86,87" fill="#67e8f9" filter="url(#cyanGlow)" />
        <polygon points="86,87 100,94 100,99 86,92" fill="#06b6d4" />
        <polygon points="100,94 114,87 114,92 100,99" fill="#0891b2" />
      </g>

      {/* Block 2 (Middle) */}
      <g transform="translate(0, 7)">
        <polygon points="100,85 116,93 100,101 84,93" fill="#22d3ee" />
        <polygon points="84,93 100,101 100,107 84,99" fill="#06b6d4" />
        <polygon points="100,101 116,93 116,99 100,107" fill="#0e7490" />
      </g>

      {/* Block 3 (Bottom) */}
      <g transform="translate(0, 20)">
        <polygon points="100,90 118,99 100,108 82,99" fill="#06b6d4" />
        <polygon points="82,99 100,108 100,115 82,106" fill="#0891b2" />
        <polygon points="100,108 118,99 118,106 100,115" fill="#155e75" />
      </g>

      {/* Orbiting elliptical ring (front swoosh wrapping around the A) */}
      <path
        d="M 45 115 C 65 145, 150 135, 175 75 C 182 60, 160 50, 130 60"
        stroke="url(#orbitGrad)"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#ringGlow)"
      />

      {/* Orbiting satellite sphere / node at top right */}
      <circle cx="152" cy="62" r="7" fill="#a5f3fc" filter="url(#cyanGlow)" />
      <circle cx="152" cy="62" r="4.5" fill="#ffffff" />
    </svg>
  );
};

export const AetherLedgerLogo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  useImage = false,
  className = '',
  subtitle,
}) => {
  const pixelSizes = {
    sm: 28,
    md: 38,
    lg: 48,
    xl: 64,
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  const currentPixelSize = pixelSizes[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Logo Icon / Emblem */}
      {useImage ? (
        <img
          src="/logo.jpg"
          alt="AetherLedger Logo"
          referrerPolicy="no-referrer"
          className="rounded-xl object-contain shadow-lg shadow-cyan-500/20 border border-cyan-500/20"
          style={{ width: currentPixelSize, height: currentPixelSize }}
        />
      ) : (
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur-sm opacity-50 group-hover:opacity-80 transition duration-300" />
          <AetherLedgerEmblem size={currentPixelSize} className="relative" />
        </div>
      )}

      {/* Wordmark Typography */}
      {showText && (
        <div className="leading-tight">
          <div className={`font-black tracking-tight ${textSizes[size]} flex items-center`}>
            <span className="text-white drop-shadow-sm">Aether</span>
            <span className="text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]">Ledger</span>
          </div>
          {subtitle !== undefined ? (
            <div className="text-[10px] text-cyan-400/90 tracking-wider font-semibold uppercase">
              {subtitle}
            </div>
          ) : (
            <div className="text-[10px] text-cyan-400/80 tracking-wider font-semibold uppercase">
              Institutional Settlement
            </div>
          )}
        </div>
      )}
    </div>
  );
};
