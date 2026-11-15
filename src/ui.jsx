// Shared layout and UI components. Every screen is built from these.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useStore, myAlerts, can, ROLE_LABEL } from './store.jsx';

/** Navigation context: { nav, back, reset, toast } — provided by App. */
export const NavCtx = createContext(null);
export const useNav = () => useContext(NavCtx);

/* ---------- Icons (one consistent stroke set) ---------- */

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 19a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  settings: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M10 10v4M18 16v4',
  file: 'M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
  upload: 'M12 16V5M7 9l5-5 5 5M5 19h14',
  check: 'M5 12.5 10 17l9-10',
  alert: 'M12 4 2.5 20h19zM12 10v5M12 17.5h.01',
  back: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14M5 12h14',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  wifi: 'M3 9a14 14 0 0 1 18 0M6.5 12.5a9 9 0 0 1 11 0M10 16a3.5 3.5 0 0 1 4 0M12 19.5h.01',
  x: 'M6 6l12 12M18 6 6 18',
  wave: 'M3 9c2.5-3 5-3 7.5 0s5 3 7.5 0M3 15c2.5-3 5-3 7.5 0s5 3 7.5 0',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
};

export function Icon({ name, size = 18 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ---------- App shell ---------- */

const TABS = {
  agency: [
    { to: 'm.home', icon: 'home', label: 'Home' },
    { to: 'm.list', icon: 'list', label: 'Endorsements' },
    { to: 'm.billing', icon: 'receipt', label: 'Billing' },
    { to: 'alerts', icon: 'bell', label: 'Alerts' },
    { to: 'profile', icon: 'user', label: 'Profile' },
  ],
  staff: [
    { to: 's.dash', icon: 'home', label: 'Dashboard' },
    { to: 's.queue', icon: 'inbox', label: 'Queue', needs: 'updates' },
    { to: 's.active', icon: 'pulse', label: 'Active', needs: 'updates' },
    { to: 's.billing', icon: 'receipt', label: 'Billing', needs: 'billing' },
    { to: 'alerts', icon: 'bell', label: 'Alerts' },
    { to: 'profile', icon: 'user', label: 'Profile' },
  ],
  admin: [
    { to: 'a.overview', icon: 'home', label: 'Overview' },
    { to: 'a.manage', icon: 'settings', label: 'Manage' },
    { to: 'a.audit', icon: 'file', label: 'Audit log' },
    { to: 'alerts', icon: 'bell', label: 'Alerts' },
    { to: 'profile', icon: 'user', label: 'Profile' },
  ],
};

function Brand({ className = 'brand', sub }) {
  return (
    <div className={className}>
      <span className="mark"><Icon name="wave" size={20} /></span>
      <span>
        SeaFlow
        {sub && <small>{sub}</small>}
      </span>
    </div>
  );
}

/**
 * Page frame.
 * Signed in: sidebar (bottom tabs on phones) + top bar + scrolling content.
 * Signed out: brand panel + centred form column. `wide` widens that column.
 */
export function Shell({ title, back, tab, wide, children }) {
  const { state, dispatch } = useStore();
  const { back: goBack, reset } = useNav();
  const session = state.session;

  if (!session) {
    return (
      <div className="auth">
        <aside className="auth-art">
          <Brand />
          <div>
            <h2>Every endorsement, from referral to fit to work.</h2>
            <p>
              The patient endorsement and information access system of NGC Medical Specialists Clinic and its
              partner manning agencies.
            </p>
          </div>
          <ul>
            <li><Icon name="check" /> Agencies endorse seafarers and follow each clinic visit.</li>
            <li><Icon name="check" /> Clinic staff send a medical report and billing statement per visit.</li>
            <li><Icon name="check" /> Every access to patient information is logged.</li>
          </ul>
        </aside>
        <main className="auth-main">
          <div className={`auth-box${wide ? ' wide' : ''}`}>
            <Brand className="auth-brand" />
            {back && (
              <button className="btn ghost sm" style={{ marginBottom: 16, marginLeft: -12 }} onClick={goBack}>
                <Icon name="back" size={15} /> Back
              </button>
            )}
            {children}
          </div>
        </main>
      </div>
    );
  }

  // Staff only see the tabs that match their assignment.
  const tabs = TABS[session.role].filter((t) => !t.needs || can(session, t.needs));
  const hasAlerts = myAlerts(state).length > 0;

  return (
    <div className="app">
      <aside className="side">
        <Brand sub="NGC Medical Specialists Clinic" />
        <nav className="tabs" aria-label="Main">
          {tabs.map((t) => (
            <button key={t.to} className={t.to === tab ? 'on' : ''} onClick={() => reset(t.to)}>
              <Icon name={t.icon} />
              {t.label}
              {t.to === 'alerts' && hasAlerts && <span className="dot" />}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          Signed in as
          <b>{session.name}</b>
          {ROLE_LABEL[session.role]}{session.duty ? `, ${session.duty.toLowerCase()}` : ''}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            {back && (
              <button className="icon-btn" onClick={goBack} aria-label="Back"><Icon name="back" /></button>
            )}
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <span className="who">{session.name}</span>
            <button className="icon-btn" onClick={() => reset('alerts')} aria-label="Alerts">
              <Icon name="bell" />
              {hasAlerts && <i />}
            </button>
            <button className="btn sm danger" onClick={() => dispatch({ type: 'logout' })}>
              <Icon name="logout" size={15} /> Log out
            </button>
          </div>
        </header>
        <div className="content">
          <div className="content-in">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Page heading: title and description on the left, page actions on the right. */
export function Intro({ title, sub, children }) {
  return (
    <div className="intro">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="intro-actions">{children}</div>}
    </div>
  );
}

/** Card with an optional header row (title, description, action). */
export function Card({ title, sub, action, flush, className = '', children }) {
  return (
    <section className={`card${flush ? ' flush' : ''} ${className}`}>
      {(title || action) && (
        <header className="card-h">
          <div>
            <h3>{title}</h3>
            {sub && <p>{sub}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/* ---------- Small components ---------- */

const CHIP_TONE = {
  Pending: 'amber', 'Non-reporting Status': 'amber', 'Update requested': 'amber', New: 'amber',
  Accepted: 'blue', 'Cash basis': 'slate', Reviewed: 'slate', 'Reach Maximum Medical Improvement': 'slate',
  'Treatment in Progress': 'teal',
  'Fit to Work': 'green', 'Fit to Work with Disability': 'green', Active: 'green', Sent: 'green',
  'Stop Treatment': 'red', Expired: 'red', Suspended: 'red', Rejected: 'red', Flagged: 'red', Deactivated: 'red',
};

export function Chip({ children, tone }) {
  return <span className={`chip ${tone || CHIP_TONE[children] || 'slate'}`}>{children}</span>;
}

/** Label + control + optional hint and error text. */
export function Field({ label, error, hint, className = '', children }) {
  return (
    <div className={`field${error ? ' bad' : ''} ${className}`}>
      <label>
        <span>{label}</span>
        {children}
      </label>
      {hint && <small>{hint}</small>}
      {error && error.trim() && <em>{error}</em>}
    </div>
  );
}

/** Simulated file attachment: only the file name is kept. */
export function FilePick({ file, onPick, onRemove, empty = 'No file attached', pickLabel = 'Upload' }) {
  const input = useRef(null);
  return (
    <div className="filerow">
      <Icon name="file" size={16} />
      <span>{file || empty}</span>
      {file ? (
        <button type="button" className="btn sm" onClick={onRemove}>Remove</button>
      ) : (
        <button type="button" className="btn sm" onClick={() => input.current.click()}>
          <Icon name="upload" size={14} /> {pickLabel}
        </button>
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

/** A stored file with a View action (demo files have nothing to open). */
export function FileRow({ label, file }) {
  const { toast } = useNav();
  return (
    <div className="filerow">
      <Icon name="file" size={16} />
      <span>{label ? `${label}: ` : ''}{file}</span>
      <button className="link" onClick={() => toast(`${file} is a demo file`)}>View</button>
    </div>
  );
}

export function Note({ tone = 'amber', icon, title, className = '', children }) {
  return (
    <div className={`note ${tone} ${className}`} role={tone === 'red' ? 'alert' : undefined}>
      {icon && <Icon name={icon} size={16} />}
      <div>
        {title && <b>{title}</b>}
        {children}
      </div>
    </div>
  );
}

export function Empty({ text, icon = 'inbox' }) {
  return (
    <div className="empty">
      <span className="icon-wrap"><Icon name={icon} size={20} /></span>
      {text}
    </div>
  );
}

/** Dashboard tile. Renders a button when it leads somewhere. */
export function Stat({ value, label, tone, flag, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`stat${flag ? ` ${flag}` : ''}`} onClick={onClick}>
      <strong className={tone}>{value}</strong>
      <span>{label}</span>
    </Tag>
  );
}

/** Label/value pairs. `cols` lays them out two per row on wide screens. */
export function Details({ items, cols }) {
  return (
    <dl className={`dl${cols ? ' cols' : ''}`}>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Data display ---------- */

/**
 * Data table with paging. On phones each row becomes a stacked record.
 * columns: [{ head, cell: (row) => node, className?, stop? }]
 * `stop` keeps clicks in that cell (buttons, selects) from opening the row.
 */
export function Table({ columns, rows, rowKey, onRow, empty = 'Nothing to show.', size = 10, pager = true }) {
  const [page, setPage] = useState(0);
  if (rows.length === 0) return <Empty text={empty} />;
  const pages = Math.ceil(rows.length / size);
  const p = Math.min(page, pages - 1);
  const shown = rows.slice(p * size, p * size + size);

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>{columns.map((c) => <th key={c.head} className={c.className}>{c.head}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={rowKey(r)}
                className={onRow ? 'click' : undefined}
                tabIndex={onRow ? 0 : undefined}
                onClick={onRow ? () => onRow(r) : undefined}
                onKeyDown={onRow ? (ev) => { if (ev.key === 'Enter' && ev.target === ev.currentTarget) onRow(r); } : undefined}
              >
                {columns.map((c) => (
                  <td
                    key={c.head}
                    data-label={c.head}
                    className={c.className}
                    onClick={c.stop ? (ev) => ev.stopPropagation() : undefined}
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pager && (
        <div className="pager">
          <span>Showing {p * size + 1} to {Math.min(rows.length, (p + 1) * size)} of {rows.length}</span>
          {pages > 1 && (
            <div className="actions">
              <button className="btn sm" disabled={p === 0} onClick={() => setPage(p - 1)}>Previous</button>
              <button className="btn sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Grid of cards with a "Load more" control. */
export function Paged({ items, size = 6, render, empty = 'Nothing to show.' }) {
  const [n, setN] = useState(size);
  if (items.length === 0) return <Card><Empty text={empty} /></Card>;
  return (
    <>
      <div className="card-grid">{items.slice(0, n).map(render)}</div>
      <div className="pager">
        <span>Showing {Math.min(n, items.length)} of {items.length}</span>
        {items.length > n && (
          <button className="btn sm" onClick={() => setN(n + size)}>Load {Math.min(size, items.length - n)} more</button>
        )}
      </div>
    </>
  );
}

/* ---------- Overlays ---------- */

/** Dialog for confirmations and short forms. Esc or the backdrop closes it. */
export function Modal({ title, sub, wide, onClose, footer, children }) {
  useEffect(() => {
    const onKey = (ev) => { if (ev.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>
            <h3>{title}</h3>
            {sub && <p>{sub}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="modal-b">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}
