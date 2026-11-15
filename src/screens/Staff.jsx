// Clinic staff side.
// Staff accounts are role-based: "Endorsements and updates", "Billing", or "Both".
import { useState } from 'react';
import {
  useStore, STATUSES, IN_PROGRESS, UPDATE_STATUSES, agencyName, dayOf, stamp, fmtDate,
  hasBreakGlass, can, visitsOf, billingItems, billingDue, daysLeft,
} from '../store.jsx';
import {
  Shell, Intro, Card, Chip, Field, FilePick, FileRow, Paged, Table, Stat, Details, Note, Icon, Modal, useNav,
} from '../ui.jsx';
import { Person } from './Shared.jsx';

/** Network banner with the prototype's "Demo: switch" control. */
function NetBanner() {
  const { state, dispatch } = useStore();
  const inside = state.insideNetwork;
  return (
    <div className={`note banner ${inside ? 'teal' : 'amber'}`}>
      <Icon name={inside ? 'wifi' : 'lock'} size={16} />
      <div>
        {inside ? 'On clinic Wi‑Fi: full access to patient details.' : 'Outside clinic network: limited view of patient details.'}
      </div>
      <button className="btn sm" onClick={() => dispatch({ type: 'toggleNetwork' })}>Demo: switch</button>
    </div>
  );
}

/** Shown when a staff account opens a page outside its assigned work. */
function NoAccess({ title, tab, need }) {
  return (
    <Shell title={title} tab={tab}>
      <Note tone="amber" icon="lock" title="Not part of your role">
        This page is for staff assigned to {need}. Ask the clinic admin if your assignment should change.
      </Note>
    </Shell>
  );
}

/** Search + agency + date filters shared by the staff lists. */
function useListFilter(list, extra) {
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
    <div className="toolbar">
      <Field label="Search" className="grow">
        <input type="search" value={q} placeholder="Search name, reference, agency, ship or position" onChange={(ev) => setQ(ev.target.value)} />
      </Field>
      {extra}
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
  );
  return [out, ui, `${needle}:${agency}:${day}`];
}

/** Opens the patient overview and records the view in the audit log. */
function useOpenPatient() {
  const { state, dispatch } = useStore();
  const { nav } = useNav();
  const full = (id) => state.insideNetwork || hasBreakGlass(state, id);
  return {
    open: (id) => {
      dispatch({ type: 'logView', id });
      nav('s.patient', { id });
    },
    label: (id) => (full(id) ? 'Full record' : 'Limited view'),
    icon: (id) => (full(id) ? 'file' : 'lock'),
  };
}

function ViewButton({ id, patient }) {
  return (
    <button className="btn sm" onClick={() => patient.open(id)}>
      <Icon name={patient.icon(id)} size={14} /> {patient.label(id)}
    </button>
  );
}

/** Dashboard: what needs action first, then patients by status. */
export function Dashboard() {
  const { state } = useStore();
  const { nav, reset } = useNav();
  const all = state.endorsements;
  const count = (s) => all.filter((e) => e.status === s).length;
  // Clinic visits that were recorded without their billing statement.
  const billing = billingItems(state).filter((i) => !i.v.billing);
  const billingLate = billing.filter((i) => daysLeft(billingDue(i.v)) < 0).length;
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
      <Intro title="Patients at a glance" sub={`Signed in as ${state.session.name}. Assigned to: ${state.session.duty}`}>
        <button className="btn" onClick={() => nav('s.patients', {})}>All patients</button>
      </Intro>

      <div className="section-h"><h3>Needs action</h3></div>
      <div className="stats">
        {updates && (
          <Stat flag="attn" tone="c-amber" value={count('Pending')} label="New endorsements" onClick={() => reset('s.queue')} />
        )}
        {updates && (
          <Stat flag="attn" tone="c-amber" value={all.filter((e) => e.updateRequested).length} label="Updates requested" onClick={() => reset('s.active')} />
        )}
        {bills && (
          <Stat flag="attn-teal" tone="c-teal" value={billing.length} label="Visits awaiting billing" onClick={() => reset('s.billing')} />
        )}
        {bills && (
          <Stat flag="attn-teal" tone="c-red" value={billingLate} label="Billing past 30 days" onClick={() => reset('s.billing')} />
        )}
      </div>

      <div className="section">
        <div className="section-h"><h3>Patients by status</h3><p>Select a status to list its patients.</p></div>
        <div className="stats">
          {tiles.map(([s, tone]) => (
            <Stat key={s} tone={tone} value={count(s)} label={s} onClick={() => nav('s.patients', { status: s })} />
          ))}
        </div>
      </div>
    </Shell>
  );
}

/** Review queue: accept new endorsements, optionally on a cash basis. */
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
      <Intro title="New endorsements" sub="Check the referral letter, then accept the endorsement." />
      <NetBanner />
      {filters}
      <Paged
        key={key}
        items={list}
        empty="No endorsements are waiting for review."
        render={(e) => (
          <Card key={e.ref}>
            <div className="card-h">
              <div>
                <div className="over">{agencyName(state, e.agencyId)}</div>
                <div className="card-name">{e.name}</div>
              </div>
              <Chip>Pending</Chip>
            </div>
            <Details
              cols
              items={[
                ['Reference', e.ref],
                ['Received', stamp(e.receivedMs)],
                ['Can come to the clinic', fmtDate(e.visitDate)],
                ['Case', e.case],
              ]}
            />
            <div style={{ marginTop: 16 }}>
              <FileRow label="Referral letter" file={e.referral} />
            </div>
            <div className="card-foot">
              <button className="btn primary sm" onClick={() => accept(e, false)}>Accept</button>
              <button className="btn sm" onClick={() => setCashFor(e)}>Cash basis</button>
              <ViewButton id={e.ref} patient={patient} />
            </div>
          </Card>
        )}
      />

      {cashFor && (
        <Modal
          title={`Accept ${cashFor.name} on a cash basis?`}
          sub={`${cashFor.ref}, ${agencyName(state, cashFor.agencyId)}`}
          onClose={() => setCashFor(null)}
          footer={(
            <>
              <button className="btn" onClick={() => setCashFor(null)}>Cancel</button>
              <button className="btn primary" onClick={() => accept(cashFor, true)}>Confirm cash basis</button>
            </>
          )}
        >
          <p>Cash basis means the patient pays the clinic directly (self pay). The agency is notified.</p>
        </Modal>
      )}
    </Shell>
  );
}

/**
 * Dialog for recording a clinic visit.
 * Every visit is one record: the new status, its medical report and its
 * billing statement. A status can only change by recording a visit.
 */
function VisitDialog({ e, onClose }) {
  const { state, dispatch } = useStore();
  const { toast } = useNav();
  const [status, setStatus] = useState(UPDATE_STATUSES.includes(e.status) ? e.status : 'Treatment in Progress');
  const [report, setReport] = useState('');
  const [billing, setBilling] = useState('');
  const [errors, setErrors] = useState({});
  const next = visitsOf(e).length + 1;
  // Staff assigned to billing attach the billing statement here, with the report.
  const handlesBilling = can(state.session, 'billing');

  const send = () => {
    const er = {};
    if (!report) er.report = 'Attach the medical report for this visit.';
    if (handlesBilling && !billing) er.billing = 'Attach the billing statement for this visit.';
    setErrors(er);
    if (Object.keys(er).length) return;
    dispatch({ type: 'recordVisit', id: e.ref, status, report, billing: handlesBilling ? billing : null });
    toast(`Clinic visit ${next} recorded · agency notified`);
    onClose();
  };

  return (
    <Modal
      title={`Clinic visit ${next}`}
      sub={`${e.name}, ${e.ref}`}
      onClose={onClose}
      footer={(
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={send}>Send visit update</button>
        </>
      )}
    >
      <div className="visit-form form">
        <p className="meta">A visit sets the new status and sends its medical report and billing statement to the agency.</p>
        {e.updateRequested && <Note tone="amber" icon="mail">The agency requested a medical update for this patient.</Note>}
        <Field label="Status for this visit">
          <select value={status} onChange={(ev) => setStatus(ev.target.value)}>
            {UPDATE_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <div className="field">
          <label><span>Medical report (PDF) *</span></label>
          <FilePick file={report} empty="No medical report" onPick={(n) => { setReport(n); setErrors({ ...errors, report: undefined }); }} onRemove={() => setReport('')} />
          {errors.report && <p className="err">{errors.report}</p>}
        </div>
        {handlesBilling ? (
          <div className="field">
            <label><span>Billing statement (PDF) *</span></label>
            <FilePick file={billing} empty="No billing statement" onPick={(n) => { setBilling(n); setErrors({ ...errors, billing: undefined }); }} onRemove={() => setBilling('')} />
            {errors.billing && <p className="err">{errors.billing}</p>}
          </div>
        ) : (
          <Note tone="teal" icon="receipt">
            The billing statement for this visit is attached by billing staff. It will appear in their Billing list.
          </Note>
        )}
      </div>
    </Modal>
  );
}

/** Active cases: record a clinic visit each time the patient comes in. */
export function Active() {
  const { state } = useStore();
  const { nav } = useNav();
  const patient = useOpenPatient();
  const [visitFor, setVisitFor] = useState(null);
  // Agency requests first, then patients who have not come in yet, then the rest.
  const rank = (e) => (e.updateRequested ? 0 : visitsOf(e).length ? 2 : 1);
  const active = state.endorsements
    .filter((e) => IN_PROGRESS.includes(e.status))
    .sort((a, b) => rank(a) - rank(b) || b.receivedMs - a.receivedMs);
  const [list, filters, key] = useListFilter(active);

  if (!can(state.session, 'updates')) {
    return <NoAccess title="Active patients" tab="s.active" need="endorsements and updates" />;
  }

  return (
    <Shell title="Active patients" tab="s.active">
      <Intro
        title="Active patients"
        sub="Record a clinic visit each time the patient comes in. Every visit carries a status, a medical report and a billing statement."
      />
      <NetBanner />
      {filters}
      <Paged
        key={key}
        items={list}
        empty="No active cases."
        render={(e) => {
          const visits = visitsOf(e);
          const last = visits[visits.length - 1];
          return (
            <Card key={e.ref} className={e.updateRequested ? 'flag' : ''}>
              <div className="card-h">
                <div>
                  <div className="over">{agencyName(state, e.agencyId)}</div>
                  <div className="card-name">{e.name}</div>
                </div>
                <Chip>{e.status}</Chip>
              </div>
              <Details
                cols
                items={[
                  ['Reference', e.ref],
                  ['Received', stamp(e.receivedMs)],
                  ['Clinic visits', last ? String(visits.length) : 'None yet'],
                  [last ? 'Last visit' : 'Expected', last ? stamp(last.ms) : fmtDate(e.visitDate)],
                ]}
              />
              {(e.updateRequested || e.cashBasis) && (
                <div className="chips" style={{ marginTop: 12 }}>
                  {e.updateRequested && <Chip>Update requested</Chip>}
                  {e.cashBasis && <Chip>Cash basis</Chip>}
                </div>
              )}
              <div className="card-foot">
                <button className="btn primary sm" onClick={() => setVisitFor(e)}>Record clinic visit</button>
                <button className="btn sm" onClick={() => nav('timeline', { id: e.ref })}>Timeline</button>
                <ViewButton id={e.ref} patient={patient} />
              </div>
            </Card>
          );
        }}
      />
      {visitFor && <VisitDialog e={visitFor} onClose={() => setVisitFor(null)} />}
    </Shell>
  );
}

/** A clinic visit whose billing statement has not been attached yet. */
function BillingCard({ e, v }) {
  const { state, dispatch } = useStore();
  const { toast } = useNav();
  const [file, setFile] = useState('');
  const [error, setError] = useState('');
  const contact = state.agencies.find((a) => a.id === e.agencyId).billing;
  const due = billingDue(v);
  const left = daysLeft(due);

  const send = () => {
    if (!file) return setError('Attach the billing statement before sending.');
    dispatch({ type: 'sendBilling', id: e.ref, n: v.n, file });
    return toast(`Billing for clinic visit ${v.n} sent · agency notified`);
  };

  return (
    <Card className={left < 0 ? 'flag-red' : ''}>
      <div className="card-h">
        <div>
          <div className="over">{agencyName(state, e.agencyId)}</div>
          <div className="card-name">{e.name}</div>
          <div className="meta">{e.ref} · Clinic visit {v.n} · {v.label}</div>
        </div>
        {left < 0
          ? <Chip tone="red">Overdue {-left}d</Chip>
          : <Chip tone={left <= 7 ? 'amber' : 'slate'}>{left} day{left === 1 ? '' : 's'} left</Chip>}
      </div>
      <Details
        cols
        items={[
          ['Visit', `${stamp(v.ms)}, report by ${v.reportBy}`],
          ['Send by', `${dayOf(due)} (within 30 days of the visit)`],
          ['Send to', `${contact.name}, ${contact.email}`],
          ['Payment', e.cashBasis ? 'Cash basis' : 'Agency'],
        ]}
      />
      <div style={{ marginTop: 16 }}>
        <FilePick file={file} empty="No billing statement" onPick={(n) => { setFile(n); setError(''); }} onRemove={() => setFile('')} />
        {error && <p className="err">{error}</p>}
      </div>
      <div className="card-foot">
        <button className="btn primary sm" onClick={send}>Send billing</button>
      </div>
    </Card>
  );
}

/** Billing: one billing statement per clinic visit, with search. */
export function Billing() {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const items = billingItems(state).filter(
    ({ e, v }) =>
      !needle ||
      `${e.name} ${e.ref} ${e.vessel} ${agencyName(state, e.agencyId)} ${v.billing || ''}`.toLowerCase().includes(needle),
  );
  const toSend = items.filter((i) => !i.v.billing).sort((a, b) => a.v.ms - b.v.ms); // oldest visit first
  const sent = items.filter((i) => i.v.billing).sort((a, b) => b.v.billingMs - a.v.billingMs);

  if (!can(state.session, 'billing')) {
    return <NoAccess title="Billing" tab="s.billing" need="billing" />;
  }

  return (
    <Shell title="Billing" tab="s.billing">
      <Intro
        title="Billing"
        sub="Every clinic visit comes with a billing statement. Visits recorded without one wait here, and must be billed within 30 days."
      />
      <div className="toolbar">
        <Field label="Search billing" className="grow">
          <input type="search" value={q} placeholder="Search patient, reference, agency or vessel" onChange={(ev) => setQ(ev.target.value)} />
        </Field>
      </div>

      <div className="section-h"><h3>Waiting for a billing statement ({toSend.length})</h3></div>
      <Paged
        key={`t:${needle}`}
        items={toSend}
        empty="Every visit has its billing statement."
        render={({ e, v }) => <BillingCard key={`${e.ref}:${v.n}`} e={e} v={v} />}
      />

      <div className="section">
        <div className="section-h"><h3>Sent ({sent.length})</h3></div>
        <Card flush>
          <Table
            key={`s:${needle}`}
            columns={[
              { head: 'Patient', cell: ({ e }) => <><span className="strong">{e.name}</span><span className="meta">{agencyName(state, e.agencyId)}</span></> },
              { head: 'Reference', cell: ({ e }) => e.ref, className: 'nowrap' },
              { head: 'Clinic visit', cell: ({ v }) => `Visit ${v.n}, ${v.label}` },
              { head: 'Sent', cell: ({ v }) => stamp(v.billingMs), className: 'nowrap' },
              { head: 'Sent by', cell: ({ v }) => v.billingBy },
              { head: 'Billing statement', cell: ({ v }) => v.billing },
            ]}
            rows={sent}
            rowKey={({ e, v }) => `${e.ref}:${v.n}`}
            empty="No sent billing matches."
          />
        </Card>
      </div>
    </Shell>
  );
}

/** All patients, filterable by status. */
export function Patients({ status = '' }) {
  const { state } = useStore();
  const { nav } = useNav();
  const patient = useOpenPatient();
  const [s, setS] = useState(status);
  const base = state.endorsements.filter((e) => !s || e.status === s);
  const [list, filters, key] = useListFilter(base, (
    <Field label="Status">
      <select value={s} onChange={(ev) => setS(ev.target.value)}>
        <option value="">All statuses</option>
        {STATUSES.map((x) => <option key={x}>{x}</option>)}
      </select>
    </Field>
  ));

  return (
    <Shell title="Patients" back tab="s.dash">
      <Intro title={s || 'All patients'} sub="Open the timeline for clinic visits, or the record for patient details." />
      <NetBanner />
      {filters}
      <Card flush>
        <Table
          key={`${s}:${key}`}
          columns={[
            { head: 'Patient', cell: (e) => <Person e={e} /> },
            { head: 'Manning agency', cell: (e) => agencyName(state, e.agencyId) },
            { head: 'Reference', cell: (e) => e.ref, className: 'nowrap' },
            { head: 'Received', cell: (e) => stamp(e.receivedMs), className: 'nowrap' },
            {
              head: 'Status',
              cell: (e) => (
                <div className="chips">
                  <Chip>{e.status}</Chip>
                  {e.cashBasis && <Chip>Cash basis</Chip>}
                </div>
              ),
            },
            {
              head: '', stop: true, className: 'right',
              cell: (e) => (
                <div className="actions">
                  <button className="btn sm" onClick={() => nav('timeline', { id: e.ref })}>Timeline</button>
                  <ViewButton id={e.ref} patient={patient} />
                </div>
              ),
            },
          ]}
          rows={list}
          rowKey={(e) => e.ref}
          empty="No patients match."
        />
      </Card>
    </Shell>
  );
}

const DETAIL_LABELS = ['Contact', 'Email', 'Birthday / age', 'Address', 'Position', 'Vessel', 'Agent', 'Date of repatriation', 'Referral letter'];

/** Patient overview: limited outside the clinic network, full inside or with break-glass. */
export function PatientOverview({ id }) {
  const { state } = useStore();
  const { nav } = useNav();
  const e = state.endorsements.find((x) => x.ref === id);
  const grant = state.breakGlass.find(
    (b) => b.ref === id && b.by === state.session.name && b.expires > Date.now(),
  );
  const full = state.insideNetwork || !!grant;
  const agent = agencyName(state, e.agencyId);
  const visits = visitsOf(e);

  return (
    <Shell title="Patient overview" back tab="s.dash">
      <Intro title={e.name} sub={`${e.ref}, ${agent}`}>
        {!full && (
          <button className="btn primary" onClick={() => nav('s.breakglass', { id })}>
            <Icon name="lock" size={16} /> Request more access
          </button>
        )}
        <button className="btn" onClick={() => nav('timeline', { id })}>Timeline</button>
      </Intro>
      <NetBanner />
      <div className="split aside-left">
        <Card title="Case" action={<Chip>{e.status}</Chip>}>
          <Details
            items={[
              ['Status', e.status],
              ['Manning agency', agent],
              ['Case', e.case],
              ['Clinic visits', visits.length
                ? `${visits.length}, last on ${stamp(visits[visits.length - 1].ms)}`
                : `None yet, expected ${fmtDate(e.visitDate)}`],
            ]}
          />
        </Card>
        <Card
          title="Patient details"
          sub={state.insideNetwork
            ? 'Full record'
            : grant
              ? `Break-glass access active until ${new Date(grant.expires).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. Your access is logged.`
              : 'Restricted outside the clinic network. Your access is logged.'}
        >
          {full ? (
            <Details
              cols
              items={[
                ['Contact', `${e.name}, ${e.contact}`],
                ['Email', e.email],
                ['Birthday / age', `${fmtDate(e.birthday)} (${e.age})`],
                ['Address', e.address],
                ['Position', e.position],
                ['Vessel', e.vessel],
                ['Agent', agent],
                ['Date of repatriation', fmtDate(e.repatriation)],
                ['Referral letter', e.referral],
              ]}
            />
          ) : (
            <dl className="dl cols">
              {DETAIL_LABELS.map((l) => (
                <div className="locked" key={l}>
                  <dt>{l}</dt>
                  <dd><Icon name="lock" size={14} /> Restricted</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>
    </Shell>
  );
}

const REASONS = ['Urgent hospital confirmation', 'Emergency contact needed', 'Agency verification call', 'Other'];

/** Break-glass access request. */
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
      <Intro title="Request full access" sub={`For ${e.name}, ${e.ref}`} />
      <Card className="narrow">
        <div className="form">
          <Note tone="amber" icon="alert" title={`Access lasts ${minutes} minutes`}>
            The request is logged and the clinic admin is notified.
          </Note>
          <Field label="Reason *">
            <select value={reason} onChange={(ev) => setReason(ev.target.value)}>
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Supporting note *" error={error}>
            <textarea value={note} placeholder="Add a justification" onChange={(ev) => { setNote(ev.target.value); setError(''); }} />
          </Field>
        </div>
        <div className="card-foot">
          <button className="btn primary" onClick={confirm}>Confirm {minutes}-minute access</button>
          <button className="btn" onClick={back}>Cancel</button>
        </div>
      </Card>
    </Shell>
  );
}
