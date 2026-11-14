// Shared layout and small UI building blocks.
import { createContext, useContext, useRef, useState } from 'react';
import { useStore, myAlerts } from './store.jsx';

/** Navigation context: { nav, back, reset, toast } — provided by App. */
export const NavCtx = createContext(null);
export const useNav = () => useContext(NavCtx);

const TABS = {
  agency: [
    { to: 'm.home', icon: '⌂', label: 'Home' },
    { to: 'm.list', icon: '≡', label: 'Endorsements' },
    { to: 'alerts', icon: '🔔', label: 'Alerts' },
    { to: 'profile', icon: '☺', label: 'Profile' },
  ],
  staff: [
    { to: 's.dash', icon: '⌂', label: 'Dashboard' },
    { to: 's.queue', icon: '☰', label: 'Queue' },
    { to: 's.active', icon: '◷', label: 'Active' },
    { to: 's.billing', icon: '₱', label: 'Billing' },
    { to: 'alerts', icon: '🔔', label: 'Alerts' },
    { to: 'profile', icon: '☺', label: 'Profile' },
  ],
  admin: [
    { to: 'a.overview', icon: '⌂', label: 'Overview' },
    { to: 'a.manage', icon: '⚙', label: 'Manage' },
    { to: 'a.audit', icon: '≡', label: 'Audit log' },
    { to: 'alerts', icon: '🔔', label: 'Alerts' },
    { to: 'profile', icon: '☺', label: 'Profile' },
  ],
};

/** Screen frame: navy header, scrollable body, role-based bottom tabs. */
export function Shell({ title, back, tab, children }) {
  const { state, dispatch } = useStore();
  const { back: goBack, reset } = useNav();
  const role = state.session?.role;
  const tabs = role ? TABS[role] : null;
  const hasAlerts = myAlerts(state).length > 0;

  return (
    <div className="screen">
      <header className="top">
        <div className="eyebrow">SEAFLOW / NGC CLINIC</div>
        <div className="top-row">
          <h1>
            {back && (
              <button className="back" onClick={goBack} aria-label="Back">‹</button>
            )}
            {title}
          </h1>
          {role && (
            <div className="top-actions">
              <span className="who">{state.session.name}</span>
              <button className="bell" onClick={() => reset('alerts')} aria-label="Alerts">
                🔔{hasAlerts && <i />}
              </button>
              <button className="signout" onClick={() => dispatch({ type: 'logout' })}>
                Log out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="body">{children}</main>
      {tabs && (
        <nav className="tabs">
          {tabs.map((t) => (
            <button key={t.to} className={t.to === tab ? 'on' : ''} onClick={() => reset(t.to)}>
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

const CHIP_TONE = {
  Pending: 'amber', 'Non-reporting Status': 'amber', 'Update requested': 'amber', New: 'amber', Invited: 'amber',
  Accepted: 'slate', 'Cash basis': 'slate', Reviewed: 'slate',
  'Treatment in Progress': 'teal',
  'Fit to Work': 'green', 'Fit to Work with Disability': 'green', Active: 'green', Sent: 'green',
  'Reach Maximum Medical Improvement': 'slate',
  'Stop Treatment': 'red', Expired: 'red', Suspended: 'red', Rejected: 'red', Flagged: 'red', Deactivated: 'red',
};

export function Chip({ children, tone }) {
  return <span className={`chip ${tone || CHIP_TONE[children] || 'slate'}`}>{children}</span>;
}

/** Label + control + optional error text. */
export function Field({ label, error, hint, children }) {
  return (
    <div className={`field${error ? ' bad' : ''}`}>
      <label>
        <span>{label}</span>
        {children}
      </label>
      {hint && <small>{hint}</small>}
      {error && <em>{error}</em>}
    </div>
  );
}

/** Simulated file attachment: only the file name is kept. */
export function FilePick({ file, onPick, onRemove, empty = 'No file attached', pickLabel = 'Upload' }) {
  const input = useRef(null);
  return (
    <div className="filerow">
      <span>📄 {file || empty}</span>
      {file ? (
        <button type="button" className="btn sm" onClick={onRemove}>Remove</button>
      ) : (
        <button type="button" className="btn sm" onClick={() => input.current.click()}>{pickLabel}</button>
      )}
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/*"
        hidden
        onChange={(ev) => {
          const f = ev.target.files[0];
          if (f) onPick(f.name);
          ev.target.value = '';
        }}
      />
    </div>
  );
}

/** List with "Showing x of y" and a Load more button. */
export function Paged({ items, size = 5, render, empty = 'Nothing to show.' }) {
  const [n, setN] = useState(size);
  if (items.length === 0) return <p className="empty">{empty}</p>;
  return (
    <>
      <p className="hint">Showing {Math.min(n, items.length)} of {items.length}</p>
      {items.slice(0, n).map(render)}
      {items.length > n && (
        <button className="btn ghost block" onClick={() => setN(n + size)}>
          Load more ({items.length - n} remaining)
        </button>
      )}
    </>
  );
}

/** Read-only label/value rows inside a card. */
export function Rows({ items }) {
  return (
    <div className="rows">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}
