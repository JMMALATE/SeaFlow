// Clinic admin side (A1–A17).
import { useState } from 'react';
import { useStore, STATUSES, IN_PROGRESS, CLOSED, DUTIES, agencyName, dayOf, stamp } from '../store.jsx';
import { Shell, Chip, Field, Paged, Rows, useNav } from '../ui.jsx';
import { EndorsementCard } from './Shared.jsx';

const DAY = 24 * 3600e3;

/** A1–A2 Admin overview */
export function Overview() {
  const { state } = useStore();
  const { nav } = useNav();
  const pending = state.endorsements.filter((e) => e.status === 'Pending').length;
  const timed = state.endorsements.filter((e) => e.turnaroundMin != null);
  const average = timed.length ? Math.round(timed.reduce((sum, e) => sum + e.turnaroundMin, 0) / timed.length) : 0;
  const today = dayOf(Date.now());
  const bgToday = state.breakGlass.filter((b) => dayOf(b.ms) === today).length;
  const bgNew = state.breakGlass.filter((b) => b.status === 'New');
  const requests = state.agencies.filter((a) => a.status === 'Pending');

  return (
    <Shell title="Admin dashboard" tab="a.overview">
      <h2>Clinic at a glance</h2>
      <div className="stats">
        <div className="stat"><strong className="c-amber">{pending}</strong><small>Pending endorsements</small></div>
        <div className="stat"><strong className="c-teal">{average} min</strong><small>Average turnaround</small></div>
        <div className="stat"><strong className="c-red">{bgToday}</strong><small>Break-glass requests today</small></div>
      </div>
      <div className="btn-row">
        <button className="btn" onClick={() => nav('a.all')}>All endorsements ›</button>
        <button className="btn" onClick={() => nav('a.reports')}>Reports ›</button>
      </div>

      <h3>Access alerts</h3>
      {bgNew.length === 0 && <p className="empty">No break-glass requests waiting for review.</p>}
      {bgNew.map((b) => (
        <button key={b.id} className="card tap flag" onClick={() => nav('a.bg', { id: b.id })}>
          <div className="card-head"><b>Break-glass request</b><Chip>New</Chip></div>
          <div className="meta">{b.by} · {b.ref}</div>
          <div className="meta">{stamp(b.ms)} · {b.minutes}-minute window · Review ›</div>
        </button>
      ))}
      <button className="btn primary block" onClick={() => nav('a.audit')}>Open audit log</button>

      <h3>Agency account approvals</h3>
      {requests.length === 0 && <p className="empty">No agency requests waiting.</p>}
      {requests.map((a) => <RequestCard key={a.id} a={a} />)}
    </Shell>
  );
}

function RequestCard({ a }) {
  const { nav } = useNav();
  return (
    <div className="card flag">
      <b>{a.name}</b>
      <div className="meta">Account request · {dayOf(a.requestedMs)}</div>
      <div className="meta">{a.authorized.name} · {a.authorized.position}</div>
      <button className="btn primary block" onClick={() => nav('a.request', { id: a.id })}>Review details ›</button>
    </div>
  );
}

/** A3–A7 Manage: users, agencies, policy */
export function Manage() {
  const [tab, setTab] = useState('Users');
  return (
    <Shell title="Manage" tab="a.manage">
      <div className="seg">
        {['Users', 'Agencies', 'Policy'].map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'Users' && <Users />}
      {tab === 'Agencies' && <Agencies />}
      {tab === 'Policy' && <Policy />}
    </Shell>
  );
}

/** One clinic account: role, assignment, password reset, deactivation with a reason. */
function UserCard({ u }) {
  const { state, dispatch } = useStore();
  const { toast } = useNav();
  const [mode, setMode] = useState(null); // null | 'reset' | 'deactivate'
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const self = u.id === state.session.userId;
  const active = u.status === 'Active';
  const close = () => { setMode(null); setValue(''); setError(''); };

  const resetPassword = () => {
    if (value.length < 8) return setError('Use at least 8 characters.');
    dispatch({ type: 'resetUser', id: u.id, password: value });
    toast(`New password set for ${u.name}. Give it to them directly.`);
    return close();
  };
  const deactivate = () => {
    if (!value.trim()) return setError('Give a reason for deactivating this account.');
    dispatch({
      type: 'setUser', id: u.id, verb: 'Deactivated account', note: `Reason: ${value.trim()}`,
      patch: { status: 'Deactivated', statusReason: value.trim() },
    });
    return close();
  };
  const activate = () => dispatch({
    type: 'setUser', id: u.id, verb: 'Activated account', patch: { status: 'Active', statusReason: null },
  });

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <b>{u.name}{self ? ' (you)' : ''}</b>
          <div className="meta">{u.role}{u.role === 'Clinic Staff' ? ` · ${u.duty}` : ''}</div>
          <div className="meta">Username: {u.username}</div>
        </div>
        <Chip>{u.status}</Chip>
      </div>
      {u.statusReason && <div className="note amber"><b>Reason for deactivation</b>{u.statusReason}</div>}
      <div className="two">
        <Field label="Role">
          <select
            value={u.role}
            disabled={self}
            onChange={(ev) => dispatch({
              type: 'setUser', id: u.id, verb: 'Changed role', note: ev.target.value,
              patch: { role: ev.target.value, duty: ev.target.value === 'Clinic Staff' ? (u.duty || 'Both') : null },
            })}
          >
            <option>Clinic Staff</option>
            <option>Clinic Admin</option>
          </select>
        </Field>
        {u.role === 'Clinic Staff' && (
          <Field label="Assigned to">
            <select
              value={u.duty}
              onChange={(ev) => dispatch({
                type: 'setUser', id: u.id, verb: 'Changed assignment', note: ev.target.value,
                patch: { duty: ev.target.value },
              })}
            >
              {DUTIES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
        )}
      </div>

      {mode === 'reset' && (
        <>
          <Field label="New temporary password (min. 8 characters)" error={error}>
            <input type="text" value={value} onChange={(ev) => { setValue(ev.target.value); setError(''); }} />
          </Field>
          <div className="btn-row">
            <button className="btn primary" onClick={resetPassword}>Save new password</button>
            <button className="btn" onClick={close}>Cancel</button>
          </div>
        </>
      )}
      {mode === 'deactivate' && (
        <>
          <Field label="Reason for deactivating *" error={error}>
            <textarea value={value} placeholder="e.g. Resigned, on extended leave" onChange={(ev) => { setValue(ev.target.value); setError(''); }} />
          </Field>
          <div className="btn-row">
            <button className="btn danger" onClick={deactivate}>Confirm deactivation</button>
            <button className="btn" onClick={close}>Cancel</button>
          </div>
        </>
      )}
      {!mode && (
        <div className="btn-row">
          <button className="btn" onClick={() => setMode('reset')}>Reset password</button>
          {active
            ? <button className="btn danger" disabled={self} onClick={() => setMode('deactivate')}>Deactivate</button>
            : <button className="btn" onClick={activate}>Activate</button>}
        </div>
      )}
    </div>
  );
}

const NEW_USER = { name: '', username: '', password: '', role: 'Clinic Staff', duty: 'Both' };

function Users() {
  const { state, dispatch } = useStore();
  const { toast } = useNav();
  const [f, setF] = useState(NEW_USER);
  const [errors, setErrors] = useState({});
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value });

  // Clinic staff do not register themselves: the admin creates each account.
  const create = () => {
    const e = {};
    const username = f.username.trim();
    if (!f.name.trim()) e.name = 'Enter the full name.';
    if (!username) e.username = 'Enter a username.';
    else if (state.users.some((u) => u.username === username) || state.agencies.some((a) => a.username === username)) {
      e.username = 'That username is already taken.';
    }
    if (f.password.length < 8) e.password = 'Use at least 8 characters.';
    setErrors(e);
    if (Object.keys(e).length) return;
    dispatch({ type: 'addUser', name: f.name.trim(), username, password: f.password, role: f.role, duty: f.duty });
    toast(`Account created for ${f.name.trim()}`);
    setF(NEW_USER);
  };

  return (
    <>
      <h2>Clinic accounts</h2>
      <p className="sub">The admin creates and manages every clinic account.</p>
      {state.users.map((u) => <UserCard key={u.id} u={u} />)}

      <h3>Create clinic account</h3>
      <div className="card">
        <Field label="Full name *" error={errors.name}>
          <input type="text" value={f.name} placeholder="e.g. Maria Santos" onChange={set('name')} />
        </Field>
        <div className="two">
          <Field label="Username *" error={errors.username}>
            <input type="text" value={f.username} autoCapitalize="none" placeholder="e.g. msantos" onChange={set('username')} />
          </Field>
          <Field label="Temporary password *" error={errors.password}>
            <input type="text" value={f.password} placeholder="Min. 8 characters" onChange={set('password')} />
          </Field>
        </div>
        <div className="two">
          <Field label="Role">
            <select value={f.role} onChange={set('role')}>
              <option>Clinic Staff</option>
              <option>Clinic Admin</option>
            </select>
          </Field>
          {f.role === 'Clinic Staff' && (
            <Field label="Assigned to">
              <select value={f.duty} onChange={set('duty')}>
                {DUTIES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
          )}
        </div>
        <button className="btn primary block" onClick={create}>Create account</button>
      </div>
    </>
  );
}

/** One accredited agency. Suspending requires a reason. */
function AgencyRow({ a, total }) {
  const { dispatch } = useStore();
  const { nav } = useNav();
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const active = a.status === 'Active';

  const suspend = () => {
    if (!reason.trim()) return setError('Give a reason for suspending this agency.');
    dispatch({ type: 'agencyStatus', id: a.id, status: 'Suspended', verb: 'suspended', reason: reason.trim() });
    setReason('');
    return setSuspending(false);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <b>{a.name}</b>
          <div className="meta">{total} endorsements</div>
        </div>
        <Chip>{a.status}</Chip>
      </div>
      {a.statusReason && <div className="note amber"><b>Reason</b>{a.statusReason}</div>}
      {suspending ? (
        <>
          <Field label="Reason for suspending *" error={error}>
            <textarea value={reason} placeholder="e.g. Accreditation expired" onChange={(ev) => { setReason(ev.target.value); setError(''); }} />
          </Field>
          <div className="btn-row">
            <button className="btn danger" onClick={suspend}>Confirm suspension</button>
            <button className="btn" onClick={() => { setSuspending(false); setError(''); }}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="btn-row">
          <button className="btn" onClick={() => nav('a.agency', { id: a.id })}>View details ›</button>
          {active ? (
            <button className="btn danger" onClick={() => setSuspending(true)}>Suspend</button>
          ) : (
            <button
              className="btn"
              onClick={() => dispatch({ type: 'agencyStatus', id: a.id, status: 'Active', verb: 'reactivated' })}
            >
              Reactivate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Agencies() {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const requests = state.agencies.filter((a) => a.status === 'Pending');
  const needle = q.trim().toLowerCase();
  const list = state.agencies.filter((a) => a.status !== 'Pending' && (!needle || a.name.toLowerCase().includes(needle)));
  const total = (id) => state.endorsements.filter((e) => e.agencyId === id).length;

  return (
    <>
      <h2>Accredited agencies</h2>
      {requests.map((a) => <RequestCard key={a.id} a={a} />)}
      <Field label="Search">
        <input type="search" value={q} placeholder="Search agencies" onChange={(ev) => setQ(ev.target.value)} />
      </Field>
      <p className="hint">Showing {list.length} of {state.agencies.length - requests.length}</p>
      {list.map((a) => <AgencyRow key={a.id} a={a} total={total(a.id)} />)}
    </>
  );
}

function Policy() {
  const { state, dispatch } = useStore();
  const { toast } = useNav();
  const [p, setP] = useState(state.policy);

  return (
    <>
      <h2>Access policy</h2>
      <div className="card">
        <Field label="Clinic network (public IP or range)">
          <input type="text" value={p.network} onChange={(ev) => setP({ ...p, network: ev.target.value })} />
        </Field>
        <Field label="Break-glass access duration">
          <select value={p.breakGlassMinutes} onChange={(ev) => setP({ ...p, breakGlassMinutes: Number(ev.target.value) })}>
            {[15, 30, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </Field>
        <Field label="Auto-logout after inactivity">
          <select value={p.autoLogoutMinutes} onChange={(ev) => setP({ ...p, autoLogoutMinutes: Number(ev.target.value) })}>
            {[5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </Field>
      </div>
      <button
        className="btn primary block"
        onClick={() => { dispatch({ type: 'savePolicy', policy: p }); toast('Access policy saved'); }}
      >
        Save policy
      </button>
    </>
  );
}

function AgencyCards({ a }) {
  return (
    <div className="card">
      <Rows
        items={[
          ['Address', a.address],
          ['Username', a.username],
          ['Authorized person', `${a.authorized.name} · ${a.authorized.position}`],
          ['Authorized person contact no.', a.authorized.contact],
          ['Authorized person email', a.authorized.email],
          ['In charge of medical report and billing', `${a.billing.name} · ${a.billing.position}`],
          ['Billing contact no.', a.billing.contact],
          ['Billing email', a.billing.email],
        ]}
      />
    </div>
  );
}

/** A8 Agency request review */
export function AgencyRequest({ id }) {
  const { state, dispatch } = useStore();
  const { back, toast } = useNav();
  const a = state.agencies.find((x) => x.id === id);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const approve = () => {
    dispatch({ type: 'agencyStatus', id, status: 'Active', verb: 'approved' });
    toast(`${a.name} approved`);
    back();
  };
  const reject = () => {
    if (!reason.trim()) return setError('Give a reason for rejecting.');
    dispatch({ type: 'agencyStatus', id, status: 'Rejected', verb: 'rejected', reason: reason.trim() });
    toast(`${a.name} rejected`);
    return back();
  };

  return (
    <Shell title="Agency request" back tab="a.manage">
      <div className="card">
        <b>{a.name}</b>
        <div className="meta">Account request · {dayOf(a.requestedMs)}</div>
      </div>
      <AgencyCards a={a} />
      {rejecting ? (
        <>
          <Field label="Reason for rejecting *" error={error}>
            <textarea value={reason} onChange={(ev) => { setReason(ev.target.value); setError(''); }} />
          </Field>
          <div className="btn-row">
            <button className="btn danger" onClick={reject}>Confirm rejection</button>
            <button className="btn" onClick={() => setRejecting(false)}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="btn-row">
          <button className="btn primary" onClick={approve}>Approve</button>
          <button className="btn danger" onClick={() => setRejecting(true)}>Reject</button>
        </div>
      )}
    </Shell>
  );
}

/** A9 Agency details */
export function AgencyDetails({ id }) {
  const { state } = useStore();
  const a = state.agencies.find((x) => x.id === id);
  const total = state.endorsements.filter((e) => e.agencyId === id).length;
  return (
    <Shell title="Agency details" back tab="a.manage">
      <div className="card">
        <div className="card-head"><b>{a.name}</b><Chip>{a.status}</Chip></div>
        <div className="meta">{total} endorsements</div>
        {a.statusReason && <div className="meta">Reason: {a.statusReason}</div>}
      </div>
      <AgencyCards a={a} />
    </Shell>
  );
}

/** A10–A11 All endorsements across agencies */
export function AllEndorsements() {
  const { state } = useStore();
  const { nav } = useNav();
  const [q, setQ] = useState('');
  const [agency, setAgency] = useState('');
  const [status, setStatus] = useState('');
  const [stuckOnly, setStuckOnly] = useState(false);
  const now = Date.now();
  const stuckDays = (e) => (e.status === 'Pending' ? Math.floor((now - e.receivedMs) / DAY) : 0);
  const needle = q.trim().toLowerCase();
  const list = state.endorsements.filter(
    (e) =>
      (!agency || e.agencyId === agency) &&
      (!status || e.status === status) &&
      (!stuckOnly || stuckDays(e) >= 1) &&
      (!needle || `${e.name} ${e.ref} ${e.vessel} ${agencyName(state, e.agencyId)}`.toLowerCase().includes(needle)),
  );

  return (
    <Shell title="All endorsements" back tab="a.overview">
      <h2>All endorsements</h2>
      <Field label="Search">
        <input type="search" value={q} placeholder="Search name, ref, ship, agency" onChange={(ev) => setQ(ev.target.value)} />
      </Field>
      <div className="two">
        <Field label="Agency">
          <select value={agency} onChange={(ev) => setAgency(ev.target.value)}>
            <option value="">All agencies</option>
            {state.agencies.filter((a) => a.status !== 'Pending').map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={(ev) => setStatus(ev.target.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={stuckOnly} onChange={(ev) => setStuckOnly(ev.target.checked)} />
        Stuck cases only (new endorsements pending 1+ day)
      </label>
      <Paged
        key={`${needle}:${agency}:${status}:${stuckOnly}`}
        items={list}
        size={10}
        empty="No endorsements match."
        render={(e) => (
          <EndorsementCard
            key={e.ref}
            e={e}
            agency={agencyName(state, e.agencyId)}
            onClick={() => nav('timeline', { id: e.ref })}
            extra={stuckDays(e) >= 1 && <span className="stuck"> · Stuck {stuckDays(e)}d</span>}
          />
        )}
      />
    </Shell>
  );
}

/** A12–A13 Reports */
export function Reports() {
  const { state } = useStore();
  const [days, setDays] = useState(30);
  const now = Date.now();
  const all = state.endorsements;
  const recent = all.filter((e) => e.receivedMs >= now - days * DAY);
  const cash = recent.length ? Math.round((recent.filter((e) => e.cashBasis).length / recent.length) * 100) : 0;
  const inTreatment = all.filter((e) => IN_PROGRESS.includes(e.status)).length;
  const pending = all.filter((e) => e.status === 'Pending').length;

  // Endorsements received on each of the last 14 calendar days.
  const bars = Array.from({ length: 14 }, (_, i) => {
    const label = dayOf(now - (13 - i) * DAY);
    return all.filter((e) => dayOf(e.receivedMs) === label && e.receivedMs > now - 15 * DAY).length;
  });
  const peak = Math.max(1, ...bars);

  const byAgency = state.agencies
    .filter((a) => a.status !== 'Pending')
    .map((a) => {
      const own = all.filter((e) => e.agencyId === a.id);
      return {
        a,
        total: own.length,
        treat: own.filter((e) => IN_PROGRESS.includes(e.status)).length,
        pend: own.filter((e) => e.status === 'Pending').length,
        done: own.filter((e) => CLOSED.includes(e.status)).length,
      };
    })
    .sort((x, y) => y.total - x.total);

  return (
    <Shell title="Reports" back tab="a.overview">
      <h2>Reports</h2>
      <Field label="Period">
        <select value={days} onChange={(ev) => setDays(Number(ev.target.value))}>
          {[7, 30, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </Field>
      <div className="stats">
        <div className="stat"><strong>{recent.length}</strong><small>Received</small></div>
        <div className="stat"><strong>{(recent.length / days).toFixed(1)}</strong><small>Per day</small></div>
        <div className="stat"><strong>{cash}%</strong><small>Cash basis</small></div>
        <div className="stat"><strong>{inTreatment}</strong><small>In treatment</small></div>
        <div className="stat"><strong className="c-amber">{pending}</strong><small>Pending</small></div>
        <div className="stat"><strong className="c-red">{state.breakGlass.length}</strong><small>Break-glass</small></div>
      </div>

      <h3>Endorsements per day (last 14 days)</h3>
      <div className="card">
        <div className="bars" style={{ marginTop: 14 }}>
          {bars.map((n, i) => (
            <div key={i} style={{ height: `${(n / peak) * 100}%` }}><span>{n}</span></div>
          ))}
        </div>
        <div className="axis"><span>14 days ago</span><span>Today</span></div>
      </div>

      <h3>By agency</h3>
      {byAgency.map(({ a, total, treat, pend, done }) => (
        <div className="card" key={a.id}>
          <div className="card-head"><b>{a.name}</b><b>{total}</b></div>
          <div className="meta">{treat} in treatment · {pend} pending · {done} concluded</div>
        </div>
      ))}
    </Shell>
  );
}

/** A14 Break-glass review */
export function BreakGlassReview({ id }) {
  const { state, dispatch } = useStore();
  const { back, toast } = useNav();
  const b = state.breakGlass.find((x) => x.id === id);
  const [note, setNote] = useState(b.reviewNote || '');
  const [error, setError] = useState('');

  const finish = (status) => {
    if (status === 'Flagged' && !note.trim()) return setError('A review note is required to flag.');
    dispatch({ type: 'reviewBreakGlass', id, status, note: note.trim() });
    toast(status === 'Flagged' ? 'Flagged as inappropriate' : 'Marked as reviewed');
    return back();
  };

  return (
    <Shell title="Break-glass review" back tab="a.overview">
      <div className="card">
        <div className="card-head"><b>{b.ref}</b><Chip>{b.status}</Chip></div>
        <Rows
          items={[
            ['Requested by', `${b.by} · Clinic Staff`],
            ['When', `${stamp(b.ms)} · ${b.minutes}-minute window`],
            ['Reason', b.reason],
            ['Staff note', b.note],
            ['Records viewed in window', b.ref],
          ]}
        />
      </div>
      <Field label="Review note (required to flag)" error={error}>
        <textarea value={note} placeholder="Add a note for the record" onChange={(ev) => { setNote(ev.target.value); setError(''); }} />
      </Field>
      <div className="btn-row">
        <button className="btn primary" onClick={() => finish('Reviewed')}>Mark as reviewed</button>
        <button className="btn danger" onClick={() => finish('Flagged')}>Flag as inappropriate</button>
      </div>
    </Shell>
  );
}

const ACTION_TONE = {
  'Accepted endorsement': 'green', 'Created account': 'green', 'Activated account': 'green',
  'Break-glass': 'red', 'Flagged break-glass': 'red', 'Deactivated account': 'red',
  'Agency suspended': 'red', 'Agency rejected': 'red',
  'Submitted medical report': 'teal', 'Submitted billing statement': 'teal',
};

/** A15 Audit log (read-only). Clinic users only: agency activity is not recorded. */
export function AuditLog() {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [who, setWho] = useState('');
  const [action, setAction] = useState('');
  const people = [...new Set(state.audit.map((x) => x.who))];
  const actions = [...new Set(state.audit.map((x) => x.action))];
  const needle = q.trim().toLowerCase();
  const list = state.audit.filter(
    (x) =>
      (!who || x.who === who) &&
      (!action || x.action === action) &&
      (!needle || `${x.ref} ${x.note || ''}`.toLowerCase().includes(needle)),
  );

  return (
    <Shell title="Audit log" tab="a.audit">
      <h2>Clinic activity</h2>
      <p className="sub">
        Who did what: every medical report, billing statement and account change by clinic staff and admins.
        Manning agency activity is not included.
      </p>
      <Field label="Search">
        <input type="search" value={q} placeholder="Search reference, patient or file name" onChange={(ev) => setQ(ev.target.value)} />
      </Field>
      <div className="two">
        <Field label="Clinic user">
          <select value={who} onChange={(ev) => setWho(ev.target.value)}>
            <option value="">All clinic users</option>
            {people.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Action">
          <select value={action} onChange={(ev) => setAction(ev.target.value)}>
            <option value="">All actions</option>
            {actions.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
      </div>
      <Paged
        key={`${who}:${action}:${needle}`}
        items={list}
        size={10}
        empty="No audit entries match."
        render={(x) => (
          <div className="card" key={x.id}>
            <div className="card-head">
              <b>{x.who}</b>
              <Chip tone={ACTION_TONE[x.action] || 'amber'}>{x.action}</Chip>
            </div>
            <div className="meta">{x.role} · {x.ref}</div>
            <div className="meta">{stamp(x.ms)}</div>
            {x.note && x.note.split(' · ').map((part) => <div className="meta" key={part}>{part}</div>)}
          </div>
        )}
      />
    </Shell>
  );
}
