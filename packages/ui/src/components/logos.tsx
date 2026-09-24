/** Inline SVG logo components — correct brand colors, no CSS filter hacks. */

export function ClaudeLogo({ size = 20 }: { size?: number }) {
  // Anthropic asterisk — 6 tapered arms at 60° intervals, coral/terracotta brand color
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <rect
          key={deg}
          x="10.75"
          y="1.5"
          width="2.5"
          height="9"
          rx="1.25"
          fill="#CC785C"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

export function CopilotLogo({ size = 20 }: { size?: number }) {
  // GitHub Copilot octicon — official paths from github.com/features/copilot
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#8957E5"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M23.922 16.992c-.861 1.495-5.859 5.023-11.922 5.023-6.063 0-11.061-3.528-11.922-5.023A.641.641 0 0 1 0 16.736v-2.869a.841.841 0 0 1 .053-.22c.372-.935 1.347-2.292 2.605-2.656.167-.429.414-1.055.644-1.517a10.195 10.195 0 0 1-.052-1.086c0-1.331.282-2.499 1.132-3.368.397-.406.89-.717 1.474-.952 1.399-1.136 3.392-2.093 6.122-2.093 2.731 0 4.767.957 6.166 2.093.584.235 1.077.546 1.474.952.85.869 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086.23.462.477 1.088.644 1.517 1.258.364 2.233 1.721 2.605 2.656a.832.832 0 0 1 .053.22v2.869a.641.641 0 0 1-.078.256ZM12.172 11h-.344a4.323 4.323 0 0 1-.355.508C10.703 12.455 9.555 13 7.965 13c-1.725 0-2.989-.359-3.782-1.259a2.005 2.005 0 0 1-.085-.104L4 11.741v6.585c1.435.779 4.514 2.179 8 2.179 3.486 0 6.565-1.4 8-2.179v-6.585l-.098-.104s-.033.045-.085.104c-.793.9-2.057 1.259-3.782 1.259-1.59 0-2.738-.545-3.508-1.492a4.323 4.323 0 0 1-.355-.508h-.016.016Zm.641-2.935c.136 1.057.403 1.913.878 2.497.442.544 1.134.938 2.344.938 1.573 0 2.292-.337 2.657-.751.384-.435.558-1.15.558-2.361 0-1.14-.243-1.847-.705-2.319-.477-.488-1.319-.862-2.824-1.025-1.487-.161-2.192.138-2.533.529-.269.307-.437.808-.438 1.578v.021c0 .265.021.562.063.893Zm-1.626 0c.042-.331.063-.628.063-.894v-.02c-.001-.77-.169-1.271-.438-1.578-.341-.391-1.046-.69-2.533-.529-1.505.163-2.347.537-2.824 1.025-.462.472-.705 1.179-.705 2.319 0 1.211.175 1.926.558 2.361.365.414 1.084.751 2.657.751 1.21 0 1.902-.394 2.344-.938.475-.584.742-1.44.878-2.497Z" />
      <path d="M14.5 14.25a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0v-2a1 1 0 0 1 1-1Zm-5 0a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0v-2a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function CodexLogo({ size = 20 }: { size?: number }) {
  // OpenAI logo — the interlocked bloom/gear shape
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="white"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.032.067L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.05 14.518A4.5 4.5 0 0 1 2.34 7.896zm16.597 3.855-5.833-3.387 2.02-1.168a.076.076 0 0 1 .071 0l4.774 2.938a4.491 4.491 0 0 1-.676 8.098v-5.573a.795.795 0 0 0-.356-.908zm2.01-3.055-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.2V6.868a.08.08 0 0 1 .032-.067l4.765-2.752a4.5 4.5 0 0 1 6.7 4.653v.044zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.392.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z" />
    </svg>
  );
}

/** Simple original mark for DeepSeek (not an official brand asset). */
export function DeepSeekLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 13.2c2.1-4.2 4.8-6.4 7.8-6.4 2.3 0 4 1.1 5.3 2.6.9.2 2 .7 2.4 2-.8.3-1.5 1-1.5 2.1 0 1.3 1 2.1 2 2.4-1.1 2.1-3.2 3.3-5.8 3.3-3.1 0-6-1.5-7.9-4-1.1-1.1-1.8-1.7-2.3-2Z"
        fill="#4D6BFE"
      />
      <circle cx="9.1" cy="12.1" r="0.85" fill="#fff" />
    </svg>
  );
}

/** Simple original mark for Kimi / Moonshot AI (not an official brand asset). */
export function KimiLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15.5 3a9 9 0 1 0 5.5 16.1A9 9 0 0 1 15.5 3Z"
        fill="#2DD4BF"
      />
    </svg>
  );
}

/** Simple monochrome mark for Grok (not an official brand asset). */
export function GrokLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.75" />
      <path
        d="M8 13.5c1.2 1.6 2.5 2.4 4 2.4s2.8-.8 4-2.4"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="9" cy="10" r="1.1" fill="#fff" />
      <circle cx="15" cy="10" r="1.1" fill="#fff" />
    </svg>
  );
}

/** Simple original mark for Cursor (not an official brand asset). */
export function CursorLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2.5 20.5 7.3v9.4L12 21.5l-8.5-4.8V7.3L12 2.5Z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3.8 7.4 12 12l8.2-4.6M12 12v9.2" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 12 20.2 7.4 12 2.8Z" fill="#fff" />
    </svg>
  );
}

/** Simple original four-point mark for Gemini (not an official brand asset). */
export function GeminiLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="aq-gemini" x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4f8dfd" />
          <stop offset="1" stopColor="#c58af9" />
        </linearGradient>
      </defs>
      <path d="M12 2c.6 5.3 4.7 9.4 10 10-5.3.6-9.4 4.7-10 10-.6-5.3-4.7-9.4-10-10 5.3-.6 9.4-4.7 10-10Z" fill="url(#aq-gemini)" />
    </svg>
  );
}
