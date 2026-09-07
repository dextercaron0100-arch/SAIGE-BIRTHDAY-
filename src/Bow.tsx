export function Bow({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`bow ${className}`}
      viewBox="0 0 220 150"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M105 64C83 51 36 4 25 24C11 50 28 77 52 78C76 79 94 69 105 64Z"
        fill="#edbdc7"
        stroke="#b97589"
        strokeWidth="1.3"
      />
      <path
        d="M114 64C137 50 181 5 194 24C211 50 192 77 169 78C146 79 126 70 114 64Z"
        fill="#edbdc7"
        stroke="#b97589"
        strokeWidth="1.3"
      />
      <path
        d="M101 68C85 91 72 108 49 134L71 129L81 142C91 119 106 95 110 71"
        fill="#e9adbd"
        stroke="#b97589"
        strokeWidth="1.3"
      />
      <path
        d="M117 68C131 92 146 108 169 134L148 129L138 142C128 118 115 96 110 71"
        fill="#e9adbd"
        stroke="#b97589"
        strokeWidth="1.3"
      />
      <path
        d="M29 27C53 32 75 48 104 64M31 66C57 58 85 61 104 64M191 27C167 32 142 49 117 64M189 66C164 58 138 61 117 64M99 76L78 126M121 77L144 125"
        stroke="#b97589"
        strokeWidth="1"
        opacity=".65"
      />
      <rect
        x="99"
        y="54"
        width="23"
        height="23"
        rx="8"
        fill="#e6a6b7"
        stroke="#b97589"
        strokeWidth="1.3"
      />
      <path d="M106 58L106 72M114 58L115 72" stroke="#fae2e6" strokeWidth="2" />
    </svg>
  );
}

export function Icon({
  kind,
}: {
  kind: 'calendar' | 'clock' | 'pin' | 'heart';
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="icon"
    >
      {kind === 'calendar' && (
        <>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M8 3v4m8-4v4M4 11h16M8 15h2m4 0h2m-8 3h2" />
        </>
      )}
      {kind === 'clock' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6l4 2" />
        </>
      )}
      {kind === 'pin' && (
        <>
          <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1114 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </>
      )}
      {kind === 'heart' && (
        <path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 3 11 8 15 5-4 13-10 8-15Z" />
      )}
    </svg>
  );
}
