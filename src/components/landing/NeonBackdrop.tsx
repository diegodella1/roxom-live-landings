export function NeonBackdrop() {
  return (
    <div className="neonBackdrop" aria-hidden="true">
      <svg viewBox="0 0 1200 800" role="img">
        <defs>
          <linearGradient id="beam" x1="0" x2="1">
            <stop offset="0%" stopColor="#ff5167" />
            <stop offset="50%" stopColor="#e9b3ff" />
            <stop offset="100%" stopColor="#74d1ff" />
          </linearGradient>
        </defs>
        <path d="M-80 650 C 220 460, 420 760, 700 500 S 1040 250, 1260 430" fill="none" stroke="url(#beam)" strokeWidth="3" />
        <path d="M40 160 L1140 700" stroke="#74d1ff" strokeOpacity=".18" />
        <path d="M180 80 L900 760" stroke="#ff5167" strokeOpacity=".16" />
        <circle cx="930" cy="180" r="92" fill="none" stroke="#e9b3ff" strokeOpacity=".24" />
      </svg>
    </div>
  );
}
