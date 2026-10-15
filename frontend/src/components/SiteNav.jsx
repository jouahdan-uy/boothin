import { useState } from "react";

import { AboutDialog, ContactDialog, FeedbackDialog, HowToDialog } from "./SiteDialogs";

const icon = (children) => (
  <svg
    className="nav-icon"
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const ICONS = {
  about: icon(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>,
  ),
  how: icon(
    <>
      <path d="M2 5.5C2 5.2 2.2 5 2.5 5H8a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2.5a.5.5 0 0 1-.5-.5z" />
      <path d="M22 5.5c0-.3-.2-.5-.5-.5H16a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h6.5c.3 0 .5-.2.5-.5z" />
    </>,
  ),
  contact: icon(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>,
  ),
  feedback: icon(
    <>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20.5l1.4-5.1A8.5 8.5 0 1 1 21 11.5z" />
      <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
    </>,
  ),
};

const ITEMS = [
  ["about", "About", AboutDialog],
  ["how", "How to use", HowToDialog],
  ["contact", "Contact", ContactDialog],
  ["feedback", "Feedback", FeedbackDialog],
];

/**
 * Navigasi atas (Welcome & halaman share): About, How to use, Contact, Feedback.
 * Semuanya dialog, jadi pengunjung tidak keluar dari booth.
 * Di layar sempit pill menjadi ikon saja (label tetap ada untuk pembaca layar).
 */
export default function SiteNav() {
  const [open, setOpen] = useState(null);
  const close = () => setOpen(null);

  return (
    <>
      <nav className="site-nav" aria-label="Site">
        {ITEMS.map(([id, label]) => (
          <button
            type="button"
            key={id}
            className="nav-pill"
            aria-haspopup="dialog"
            title={label}
            onClick={() => setOpen(id)}
          >
            {ICONS[id]}
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>

      {ITEMS.map(([id, , Content]) => (open === id ? <Content key={id} onClose={close} /> : null))}
    </>
  );
}
