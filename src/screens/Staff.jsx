// Clinic staff side (S1–S21).
// Staff accounts are role-based: "Endorsements and updates", "Billing", or "Both".
import { useState } from 'react';
import {
  useStore, STATUSES, IN_PROGRESS, UPDATE_STATUSES, agencyName, dayOf, stamp, fmtDate,
  hasBreakGlass, can, visitsOf, billingDue, daysLeft,
} from '../store.jsx';
import { Shell, Chip, Field, FilePick, Paged, Rows, useNav } from '../ui.jsx';

/** Network banner with the prototype's "Demo: switch" control. */
function NetBanner() {
  const { state, dispatch } = useStore();
  const inside = state.insideNetwork;
  return (
    <div className={`note banner ${inside ? 'teal' : 'amber'}`}>
      <span>{inside ? '📶 On clinic Wi‑Fi · full access' : '📵 Outside clinic network · limited view'}</span>
      <button className="btn sm" onClick={() => dispatch({ type: 'toggleNetwork' })}>Demo: switch</button>
    </div>
  );
}

/** Shown when a staff account opens a page outside its assigned work. */
function NoAccess({ title, tab, need }) {
  return (
    <Shell title={title} tab={tab}>
      <div className="note amber">
        <b>Not part of your role</b>
        This page is for staff assigned to {need}. Ask the clinic admin if your assignment should change.
      </div>
    </Shell>
  );
}

/** Search + agency + date filters shared by the staff lists. */
function useListFilter(list) {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [agency, setAgency] = useState('');
  const [day, setDay] = useState('');
  const days = [...new Set(list.map((e) => dayOf(e.receivedMs)))];
  const needle = q.trim().toLowerCase();
  const out = list.filter(
    (e) =>
      (!agency || e.agencyId === agency) &&
      (!day || dayOf(e.receivedMs) === day) &&
      (!needle ||
        `${e.name} ${e.ref} ${e.vessel} ${e.position} ${agencyName(state, e.agencyId)}`.toLowerCase().includes(needle)),
  );
  const ui = (
    <>
      <Field label="Search">
        <input type="search" value={q} placeholder="Search name, ref, agency, ship, position" onChange={(ev) => setQ(ev.target.value)} />
      </Field>
      <div className="two">
        <Field label="Agency">
          <select value={agency} onChange={(ev) => setAgency(ev.target.value)}>
            <option value="">All agencies</option>
            {state.agencies.filter((a) => a.status === 'Active').map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Date received">
          <select value={day} onChange={(ev) => setDay(ev.target.value)}>
            <option value="">All dates</option>
            {days.map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
      </div>
    </>
  );
  return [out, ui, `${needle}:${agency}:${day}`];
}

/** Opens the patient overview and records the view in the audit log. */
function useOpenPatient() {
  const { state, dispatch } = useStore();
  const { nav } = useNav();
  return {
    open: (id) => {
      dispatch({ type: 'logView', id });
      nav('s.patient', { id });
    },
    label: (id) => (state.insideNetwork || hasBreakGlass(state, id) ? 'Full record' : '🔒 Limited view'),
  };
}

/** S1 Dashboard */
export function Dashboard() {
  const { state } = useStore();
  const { nav, reset } = useNav();
  const all = state.endorsements;
  const count = (s) => all.filter((e) => e.status === s).length;
  const billing = all.filter((e) => e.billing.state === 'toSend');
  const billingLate = billing.filter((e) => daysLeft(billingDue(e)) < 0).length;
  const updates = can(state.session, 'updates');
  const bills = can(state.session, 'billing');
  const tiles = [
    ['Accepted', 'c-slate'], ['Treatment in Progress', 'c-teal'],
    ['Non-reporting Status', 'c-amber'], ['Expired', 'c-red'],
    ['Stop Treatment', 'c-slate'], ['Reach Maximum Medical Improvement', 'c-slate'],
    ['Fit to Work', 'c-green'], ['Fit to Work with Disability', 'c-green'],
  ];

  return (
    <Shell title="Dashboard" tab="s.dash">
      <h2>Patients at a glance</h2>
      <p className="sub">Signed in as {state.session.name} · Assigned to: {state.session.duty}</p>
      <div className="stats two-col">
        {updates && (
          <button className="stat row edge" onClick={() => reset('s.queue')}>
            <strong className="c-amber">{count('Pending')}</strong>
            <small>New endorsements ›</small>
          </button>
        )}
        {updates && (
          <button className="stat row edge" onClick={() => reset('s.active')}>
            <strong className="c-amber">{all.filter((e) => e.updateRequested).length}</strong>
            <small>Updates requested ›</small>
          </button>
        )}
        {bills && (
          <button className="stat row edge-teal" onClick={() => reset('s.billing')}>
            <strong className="c-teal">{billing.length}</strong>
            <small>Billing to send ›</small>
          </button>
        )}
        {bills && (
          <button className="stat row edge-teal" onClick={() => reset('s.billing')}>
            <strong className="c-red">{billingLate}</strong>
            <small>Billing past 30 days ›</small>
          </button>
        )}
        {tiles.map(([s, tone]) => (
          <button key={s} className="stat row" onClick={() => nav('s.patients', { status: s })}>
            <strong className={tone}>{count(s)}</strong>
            <small>{s} ›</small>
          </button>
        ))}
      </div>
      <button className="btn block" onClick={() => nav('s.patients', {})}>All patients</button>
    </Shell>
  );
}

/** S2–S3 Review queue, S6 accept on a cash basis */
export function Queue() {
  const { state, dispatch } = useStore();
  const { toast } = useNav();
  const patient = useOpenPatient();
  const [cashFor, setCashFor] = useState(null);
  const pending = state.endorsements.filter((e) => e.status === 'Pending');
  const [list, filters, key] = useListFilter(pending);

  if (!can(state.session, 'updates')) {
    return <NoAccess title="Review queue" tab="s.queue" need="endorsements and updates" />;
  }

  const accept = (e, cash) => {
    dispatch({ type: 'accept', id: e.ref, cash });
    setCashFor(null);
    toast(`${e.name} accepted${cash ? ' on a cash basis' : ''} · agency notified`);
  };

  return (
    <Shell title="Review queue" tab="s.queue">
      <NetBanner />
      <h2>New endorsements</h2>
      {filters}
      <Paged
        key={key}
        items={list}
        empty="No endorsements waiting for review."
        render={(e) => (
          <div className="card" key={e.ref}>
            <div className="over">{agencyName(state, e.agencyId)}</div>
            <b>{e.name}</b>
            <div className="meta">{e.ref} · Received {stamp(e.receivedMs)}</div>
            <div className="meta">Can come to the clinic: {fmtDate(e.visitDate)}</div>
            <div className="filerow">
              <span>📄 Referral letter: {e.referral}</span>
              <button className="link" onClick={() => toast(`${e.referral} is a demo file`)}>View</button>
            </div>
            <div className="chips"><Chip>Pending</Chip></div>
            {cashFor === e.ref ? (
              <>
                <div className="note amber">
                  <b>Accept {e.name} on a cash basis?</b>
                  Self pay.
                </div>
                <div className="actions">
                  <button className="btn primary" onClick={() => accept(e, true)}>Confirm cash basis</button>
                  <button className="btn" onClick={() => setCashFor(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <div className="actions">
                <button className="btn primary" onClick={() => accept(e, false)}>Accept</button>
                <button className="btn" onClick={() => setCashFor(e.ref)}>Cash basis</button>
                <button className="btn" onClick={() => patient.open(e.ref)}>{patient.label(e.ref)}</button>
              </div>
            )}
          </div>
        )}
      />
    </Shell>
  );
}

/**
 * One active case (S7–S9).
 * Each time the patient comes to the clinic, staff record the visit by sending
 * an update with its medical report. The first one marks the patient's arrival.
 */
function ActiveCard({ e }) {
  const { state, dispatch } = useStore();
  const { nav, toast } = useNav();
  const patient = useOpenPatient();
  const [open, setOpen] = useState(e.updateRequested);
  const [status, setStatus] = useState(UPDATE_STATUSES.includes(e.status) ? e.status : 'Treatment in Progress');
  const [file, setFile] = useState('');
  const [error, setError] = useState('');
  const visits = visitsOf(e);

  const send = () => {
    if (!file) return setError('Attach the medical report before sending the update.');
    dispatch({ type: 'sendUpdate', id: e.ref, status, file });
    setFile('');
    setError('');
    setOpen(false);
    return toast(`Clinic visit ${visits + 1} recorded · agency notified`);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="over">{agencyName(state, e.agencyId)}</div>
          <b>{e.name}</b>
        </div>
        <Chip>{e.status}</Chip>
      </div>
      <div className="meta">{e.ref} · Received {stamp(e.receivedMs)}</div>
      <div className="meta">
        {visits
          ? `Clinic visits: ${visits} · Last visit ${stamp(e.lastUpdateMs)}`
          : `No clinic visit yet · Expected ${fmtDate(e.visitDate)}`}
      </div>
      {(e.updateRequested || e.cashBasis) && (
        <div className="chips">
          {e.updateRequested && <Chip>Update requested</Chip>}
          {e.cashBasis && <Chip>Cash basis</Chip>}
        </div>
      )}

      {open && (
        <div className="visit-form">
          <b>Clinic visit {visits + 1}</b>
          <div className="meta">Send the update or medical report for this visit to the agency.</div>
          {e.updateRequested && <div className="note amber">📩 Update requested by the agency</div>}
          <Field label="Status after this visit">
            <select value={status} onChange={(ev) => setStatus(ev.target.value)}>
              {UPDATE_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <div className="meta">Medical report (PDF) *</div>
          <FilePick file={file} onPick={(n) => { setFile(n); setError(''); }} onRemove={() => setFile('')} />
          {error && <p className="err">{error}</p>}
        </div>
      )}
      <div className="actions">
        {open ? (
          <>
            <button className="btn primary" onClick={send}>Send update</button>
            <button className="btn" onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
          </>
        ) : (
          <>
            <button className="btn primary" onClick={() => setOpen(true)}>Record clinic visit</button>
            <button className="btn" onClick={() => nav('timeline', { id: e.ref })}>Timeline</button>
            <button className="btn" onClick={() => patient.open(e.ref)}>{patient.label(e.ref)}</button>
          </>
        )}
      </div>
    </div>
  );
}

/** S4–S5 Active cases */
export function Active() {
  const { state } = useStore();
  // Agency requests first, then patients who have not come in yet, then the rest.
  const rank = (e) => (e.updateRequested ? 0 : e.arrivedMs ? 2 : 1);
  const active = state.endorsements
    .filter((e) => IN_PROGRESS.includes(e.status))
    .sort((a, b) => rank(a) - rank(b) || b.receivedMs - a.receivedMs);
  const [list, filters, key] = useListFilter(active);

  if (!can(state.session, 'updates')) {
    return <NoAccess title="Active patients" tab="s.active" need="endorsements and updates" />;
  }

  return (
    <Shell title="Active patients" tab="s.active">
      <NetBanner />
      <h2>Active patients</h2>
      <p className="sub">
        Send an update or medical report each time the patient comes to the clinic. Patients return weekly.
      </p>
      {filters}
      <Paged key={key} items={list} size={6} empty="No active cases." render={(e) => <ActiveCard key={e.ref} e={e} />} />
    </Shell>
  );
}

function BillingCard({ e }) {
  const { state, dispatch } = useStore();
  const { toast } = useNav();
  const [file, setFile] = useState('');
  const [error, setError] = useState('');
  const contact = state.agencies.find((a) => a.id === e.agencyId).billing;
  const due = billingDue(e);
  const left = daysLeft(due);

  const send = () => {
    if (!file) return setError('Attach the billing statement before sending.');
    dispatch({ type: 'sendBilling', id: e.ref, file });
    return toast('Billing sent · agency notified');
  };

  return (
    <div className={`card${left < 0 ? ' flag-red' : ''}`}>
      <div className="card-head">
        <b>{e.name}</b>
        {left < 0
          ? <Chip tone="red">Overdue {-left}d</Chip>
          : <Chip tone={left <= 7 ? 'amber' : 'slate'}>{left} day{left === 1 ? '' : 's'} left</Chip>}
      </div>
      <div className="meta">{agencyName(state, e.agencyId)}</div>
      <div className="meta">{e.ref} · Report sent {stamp(e.billing.reportMs)}</div>
      <div className="meta">Send by {dayOf(due)} (within 30 days of the report)</div>
      <div className="meta">Send to: {contact.name} · {contact.email}</div>
      {e.cashBasis && <div className="chips"><Chip>Cash basis</Chip></div>}
      <FilePick file={file} empty="No billing file" onPick={(n) => { setFile(n); setError(''); }} onRemove={() => setFile('')} />
      {error && <p className="err">{error}</p>}
      <button className="btn primary block" onClick={send}>Send billing</button>
    </div>
  );
}

/** S10–S12 Billing, with search */
export function Billing() {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const match = (e) =>
    !needle ||
    `${e.name} ${e.ref} ${e.vessel} ${agencyName(state, e.agencyId)} ${e.billing.file || ''}`.toLowerCase().includes(needle);
  const toSend = state.endorsements
    .filter((e) => e.billing.state === 'toSend' && match(e))
    .sort((a, b) => billingDue(a) - billingDue(b)); // closest deadline first
  const sent = state.endorsements
    .filter((e) => e.billing.state === 'sent' && match(e))
    .sort((a, b) => b.billing.sentMs - a.billing.sentMs);

  if (!can(state.session, 'billing')) {
    return <NoAccess title="Billing" tab="s.billing" need="billing" />;
  }

  return (
    <Shell title="Billing" tab="s.billing">
      <h2>Billing</h2>
      <p className="sub">
        Sending a medical report creates a billing item here. Billing must reach the agency within 30 days.
      </p>
      <Field label="Search billing">
        <input type="search" value={q} placeholder="Search patient, reference, agency or vessel" onChange={(ev) => setQ(ev.target.value)} />
      </Field>

      <h3>To send ({toSend.length})</h3>
      <Paged key={`t:${needle}`} items={toSend} size={6} empty="Nothing to send." render={(e) => <BillingCard key={e.ref} e={e} />} />

      <h3>Sent ({sent.length})</h3>
      <Paged
        key={`s:${needle}`}
        items={sent}
        size={6}
        empty="No sent billing matches."
        render={(e) => (
          <div className="card" key={e.ref}>
            <div className="card-head">
              <b>{e.name}</b>
              <Chip>Sent</Chip>
            </div>
            <div className="meta">{agencyName(state, e.agencyId)}</div>
            <div className="meta">{e.ref} · {stamp(e.billing.sentMs)}</div>
            <div className="meta">📄 {e.billing.file}</div>
          </div>
        )}
      />
    </Shell>
  );
}

/** S13 All patients / case history, filterable by status */
export function Patients({ status = '' }) {
  const { state } = useStore();
  const { nav } = useNav();
  const patient = useOpenPatient();
  const [s, setS] = useState(status);
  const base = state.endorsements.filter((e) => !s || e.status === s);
  const [list, filters, key] = useListFilter(base);

  return (
    <Shell title="Patients" back tab="s.dash">
      <NetBanner />
      <h2>{s || 'All patients'}</h2>
      <Field label="Status">
        <select value={s} onChange={(ev) => setS(ev.target.value)}>
          <option value="">All</option>
          {STATUSES.map((x) => <option key={x}>{x}</option>)}
        </select>
      </Field>
      {filters}
      <Paged
        key={`${s}:${key}`}
        items={list}
        empty="No patients match."
        render={(e) => (
          <div className="card" key={e.ref}>
            <div className="over">{agencyName(state, e.agencyId)}</div>
            <b>{e.name}</b>
            <div className="meta">{e.ref} · Received {stamp(e.receivedMs)}</div>
            <div className="chips">
              {e.cashBasis && <Chip>Cash basis</Chip>}
              <Chip>{e.status}</Chip>
            </div>
            <div className="btn-row">
              <button className="btn" onClick={() => nav('timeline', { id: e.ref })}>Timeline</button>
              <button className="btn" onClick={() => patient.open(e.ref)}>{patient.label(e.ref)}</button>
            </div>
          </div>
        )}
      />
    </Shell>
  );
}

const DETAIL_LABELS = ['Contact', 'Email', 'Birthday / age', 'Address', 'Position', 'Vessel', 'Agent', 'Date of repatriation'];

/** S14–S15 limited view (outside the network), S17–S18 full record (inside) */
export function PatientOverview({ id }) {
  const { state } = useStore();
  const { nav } = useNav();
  const e = state.endorsements.find((x) => x.ref === id);
  const grant = state.breakGlass.find(
    (b) => b.ref === id && b.by === state.session.name && b.expires > Date.now(),
  );
  const full = state.insideNetwork || !!grant;
  const agent = agencyName(state, e.agencyId);

  return (
    <Shell title="Patient overview" back tab="s.dash">
      <NetBanner />
      <div className="note teal">
        {state.insideNetwork
          ? 'Full record'
          : grant
            ? `Break-glass access active until ${new Date(grant.expires).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · logged`
            : '🔒 Your access is logged.'}
      </div>
      <div className="card">
        <b style={{ fontSize: 17 }}>{e.name}</b>
        <Rows
          items={[
            ['Status', e.status],
            ['Manning agency', agent],
            ['Case', e.case],
            ['Clinic visits', visitsOf(e) ? `${visitsOf(e)} · last on ${stamp(e.lastUpdateMs)}` : `None yet · expected ${fmtDate(e.visitDate)}`],
          ]}
        />
      </div>
      <div className="card">
        {full ? (
          <Rows
            items={[
              ['Contact', `${e.name} · ${e.contact}`],
              ['Email', e.email],
              ['Birthday / age', `${fmtDate(e.birthday)} · ${e.age}`],
              ['Address', e.address],
              ['Position', e.position],
              ['Vessel', e.vessel],
              ['Agent', agent],
              ['Date of repatriation', fmtDate(e.repatriation)],
              ['Referral letter', e.referral],
            ]}
          />
        ) : (
          <div className="rows locked">
            {DETAIL_LABELS.map((l) => (
              <div key={l}>
                <span>{l}</span>
                <b>🔒 Restricted</b>
              </div>
            ))}
          </div>
        )}
      </div>
      {!full && (
        <button className="btn primary block" onClick={() => nav('s.breakglass', { id })}>Request more access</button>
      )}
      <button className="btn block" onClick={() => nav('timeline', { id })}>Timeline</button>
    </Shell>
  );
}

const REASONS = ['Urgent hospital confirmation', 'Emergency contact needed', 'Agency verification call', 'Other'];

/** S16 Break-glass access */
export function BreakGlass({ id }) {
  const { state, dispatch } = useStore();
  const { back, toast } = useNav();
  const e = state.endorsements.find((x) => x.ref === id);
  const minutes = state.policy.breakGlassMinutes;
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const confirm = () => {
    if (!note.trim()) return setError('A supporting note is required.');
    dispatch({ type: 'breakGlass', id, reason, note: note.trim() });
    toast(`Full access for ${minutes} minutes · admin notified`);
    return back();
  };

  return (
    <Shell title="Break-glass access" back tab="s.dash">
      <div className="note amber"><b>Access lasts {minutes} minutes</b>The request is logged and the admin is notified.</div>
      <p className="hint">For {e.name} · {e.ref}</p>
      <Field label="Reason *">
        <select value={reason} onChange={(ev) => setReason(ev.target.value)}>
          {REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="Supporting note *" error={error}>
        <textarea value={note} placeholder="Add a justification" onChange={(ev) => { setNote(ev.target.value); setError(''); }} />
      </Field>
      <button className="btn primary block" onClick={confirm}>Confirm {minutes}-minute access</button>
      <button className="btn block" onClick={back}>Cancel</button>
    </Shell>
  );
}
