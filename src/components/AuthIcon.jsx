// Centered badge icon for the account-recovery / reset-password auth screens.
// A shield with a keyhole reads better than a lone emoji and stays perfectly centered.
export default function AuthIcon() {
  return (
    <span className="auth-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
        <path
          d="M12 2.5 4.5 5.3v5.6c0 4.7 3.2 8 7.5 10.6 4.3-2.6 7.5-5.9 7.5-10.6V5.3L12 2.5Z"
          fill="#ffffff"
          fillOpacity="0.18"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="10.5" r="2.1" fill="#ffffff" />
        <path d="M12 12.4v3.1" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  )
}
