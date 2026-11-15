// Central state for the SeaFlow prototype.
// Everything lives in memory (useReducer + context). Replace the reducer
// actions with API calls when a real backend is added.
import { createContext, useContext, useReducer } from 'react';

/* ---------- constants ---------- */

export const CLOSED = [
  'Fit to Work',
  'Fit to Work with Disability',
  'Reach Maximum Medical Improvement',
  'Stop Treatment',
  'Expired',
];
export const IN_PROGRESS = ['Accepted', 'Treatment in Progress', 'Non-reporting Status'];
export const STATUSES = ['Pending', ...IN_PROGRESS, ...CLOSED];
// Statuses clinic staff can set when sending an update.
export const UPDATE_STATUSES = ['Treatment in Progress', 'Non-reporting Status', ...CLOSED];

export const ROLE_LABEL = { agency: 'Manning Agency', staff: 'Clinic Staff', admin: 'Clinic Admin' };
export const DEMO_PASSWORD = 'demo1234';

// What a Clinic Staff account is allowed to handle.
export const DUTIES = ['Endorsements and updates', 'Billing', 'Both'];

const HOUR = 3600e3;
const DAY = 24 * HOUR;
export const UPDATE_EVERY = 7 * DAY; // weekly medical updates, counted from arrival at the clinic
export const BILLING_WINDOW = 30 * DAY; // billing must reach the agency within 30 days

/* ---------- helpers ---------- */

export const dayOf = (ms) =>
  new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const stamp = (ms = Date.now()) =>
  `${dayOf(ms)} · ${new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

/** "2026-11-16" -> "Nov 16, 2026" */
export const fmtDate = (iso) =>
  (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export const refOf = (n) => `SF-2026-${String(n).padStart(4, '0')}`;

export const agencyName = (state, id) => state.agencies.find((a) => a.id === id)?.name ?? '—';

export const isClosed = (e) => CLOSED.includes(e.status);

/** Whole days until a deadline (negative when it has passed). */
export const daysLeft = (ms) => Math.ceil((ms - Date.now()) / DAY);

/** When the next weekly update is due. Null until the patient has arrived. */
export const updateDue = (e) =>
  (e.arrivedMs && IN_PROGRESS.includes(e.status) ? (e.lastUpdateMs ?? e.arrivedMs) + UPDATE_EVERY : null);

/** Deadline for sending the billing statement. Null when nothing is waiting. */
export const billingDue = (e) => (e.billing.state === 'toSend' ? e.billing.reportMs + BILLING_WINDOW : null);

/** Role-based access for clinic staff: what = 'updates' or 'billing'. */
export function can(session, what) {
  if (session?.role !== 'staff') return false;
  if (session.duty === 'Both') return true;
  return what === 'billing' ? session.duty === 'Billing' : session.duty === DUTIES[0];
}

/** Alerts addressed to the signed-in user. */
export function myAlerts(state) {
  const s = state.session;
  if (!s) return [];
  const to = s.role === 'agency' ? `agency:${s.agencyId}` : s.role;
  return state.alerts.filter((a) => a.to === to);
}

/** True when the signed-in staff member has an unexpired break-glass grant. */
export function hasBreakGlass(state, id) {
  return state.breakGlass.some(
    (b) => b.ref === id && b.by === state.session?.name && b.expires > Date.now(),
  );
}

/* ---------- seed data (all fictional) ---------- */

function seed() {
  const NOW = Date.now();

  const agency = (id, name, address, status, authorized, billing, username, daysAgo) => ({
    id, name, address, status, authorized, billing, username,
    password: DEMO_PASSWORD,
    requestedMs: NOW - daysAgo * DAY,
  });
  const person = (name, position, contact, email) => ({ name, position, contact, email });

  const agencies = [
    agency('a1', 'Pacific Crew Manning Agency', 'Pacific Tower, Roxas Blvd., Manila', 'Active',
      person('Antonio Villar', 'President', '0917 555 0101', 'a.villar@pacificcrew.demo'),
      person('Marites Cruz', 'Medical Report & Billing Officer', '0917 555 0102', 'billing@pacificcrew.demo'),
      'agency.demo', 90),
    agency('a2', 'Harbor Crew Manning Agency', '2/F Port Area Bldg., Manila', 'Active',
      person('Lorna Diaz', 'General Manager', '0917 555 0111', 'l.diaz@harborcrew.demo'),
      person('Paolo Reyes', 'Billing Officer', '0917 555 0112', 'billing@harborcrew.demo'),
      'harbor.demo', 60),
    agency('a3', 'Blue Anchor Maritime Services', 'Anchor Plaza, Makati', 'Active',
      person('Grace Tan', 'Operations Head', '0917 555 0121', 'g.tan@blueanchor.demo'),
      person('Nico Ong', 'Billing Officer', '0917 555 0122', 'billing@blueanchor.demo'),
      'blueanchor.demo', 45),
    agency('a4', 'Northstar Crewing Inc.', 'Northstar Center, Pasay', 'Active',
      person('Victor Sy', 'President', '0917 555 0131', 'v.sy@northstar.demo'),
      person('Ana Lim', 'Billing Officer', '0917 555 0132', 'billing@northstar.demo'),
      'northstar.demo', 40),
    agency('a5', 'Island Spirit Crewing Corp.', '4/F Harbor Center, Roxas Blvd., Ermita, Manila', 'Pending',
      person('Carla Mendoza', 'General Manager', '0917 555 0188', 'carla.mendoza@islandspirit.demo'),
      person('Joy Lim', 'Billing Officer', '0917 555 0190', 'billing@islandspirit.demo'),
      'islandspirit', 0.5),
    agency('a6', 'Seabridge Crewing Corp.', 'Seabridge Bldg., Intramuros, Manila', 'Pending',
      person('Rey Dizon', 'Operations Director', '0917 555 0201', 'rey.dizon@seabridge.demo'),
      person('Mia Santos', 'Billing Officer', '0917 555 0202', 'billing@seabridge.demo'),
      'seabridge', 1.5),
  ];

  const user = (id, name, role, duty, username) => ({
    id, name, role, duty, username, status: 'Active', password: DEMO_PASSWORD,
  });
  const users = [
    user('u1', 'R. Santos', 'Clinic Staff', 'Both', 'staff.demo'),
    user('u2', 'L. Garcia', 'Clinic Staff', 'Billing', 'billing.demo'),
    user('u3', 'M. Reyes', 'Clinic Staff', DUTIES[0], 'updates.demo'),
    user('u4', 'A. Gomez', 'Clinic Admin', null, 'admin.demo'),
  ];

  // Build one endorsement with a timeline that matches its status.
  const mk = (n, name, position, vessel, agencyId, status, hoursAgo, kase, extra = {}) => {
    const id = refOf(n);
    const receivedMs = NOW - hoursAgo * HOUR;
    const timeline = [{ label: 'Received', ms: receivedMs }];
    let turnaroundMin = null;
    let arrivedMs = null;
    let lastUpdateMs = null;
    let billing = { state: 'none' };
    if (status !== 'Pending') {
      turnaroundMin = 8 + (n % 5) * 4;
      timeline.push({ label: 'Accepted', ms: receivedMs + turnaroundMin * 60e3 });
      if (status !== 'Accepted') {
        // The patient has reported to the clinic, so weekly updates have started.
        arrivedMs = receivedMs + 2 * HOUR;
        timeline.push({ label: 'Arrived at clinic', ms: arrivedMs });
        const closed = CLOSED.includes(status);
        const ms = closed ? receivedMs + 72 * HOUR : Math.max(arrivedMs + HOUR, NOW - ((n % 9) + 1) * DAY);
        lastUpdateMs = ms;
        timeline.push({
          label: status, ms, kind: 'report',
          file: closed ? `Final_Medical_Report_${id}.pdf` : `Medical_Report_${id}.pdf`,
        });
        if (closed) {
          billing = { state: 'sent', file: `Billing_${id}.pdf`, reportMs: ms, sentMs: ms + HOUR };
          timeline.push({ label: 'Billing statement sent', ms: ms + HOUR, kind: 'billing', file: `Billing_${id}.pdf` });
        } else {
          billing = { state: 'toSend', reportMs: ms };
        }
      }
    }
    return {
      ref: id, name, position, vessel, agencyId, status, receivedMs, timeline, turnaroundMin, billing,
      arrivedMs, lastUpdateMs,
      case: kase,
      birthday: `19${70 + (n % 28)}-0${1 + (n % 9)}-1${n % 9}`,
      age: 2026 - (1970 + (n % 28)),
      address: '123 Taft Ave., Malate, Manila',
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@mail.demo`,
      contact: `0917 000 ${String(n).padStart(4, '0')}`,
      repatriation: new Date(receivedMs - 4 * DAY).toISOString().slice(0, 10),
      visitDate: new Date(receivedMs + DAY).toISOString().slice(0, 10), // when the patient can come to the clinic
      referral: `Referral_Letter_${id}.pdf`,
      cashBasis: false,
      updateRequested: false,
      ...extra,
    };
  };

  // Turn a sent billing back into "waiting to be sent" (for demo variety).
  const unsendBilling = (e) => {
    e.timeline = e.timeline.filter((t) => t.kind !== 'billing');
    e.billing = { state: 'toSend', reportMs: e.lastUpdateMs };
  };

  const named = [
    mk(142, 'Juan Dela Cruz', '3rd Officer', 'MV Pacific Star', 'a1', 'Accepted', 3, 'Chest pain'),
    mk(141, 'Maria Lopez', 'Bosun', 'MV Ocean Grace', 'a1', 'Pending', 30, 'Lower back pain'),
    mk(139, 'Ramon Garcia', 'Able Seaman', 'MV Harbor Line', 'a2', 'Pending', 4, 'Hand laceration'),
    mk(138, 'Joel Aquino', 'Oiler', 'MV Harbor Line', 'a2', 'Treatment in Progress', 52, 'Knee injury', { cashBasis: true }),
    mk(137, 'Dennis Cruz', 'Messman', 'MV Northstar Pioneer', 'a4', 'Non-reporting Status', 44, 'Hypertension'),
    mk(135, 'Carlo Mendoza', 'Chief Cook', 'MV Blue Anchor 3', 'a3', 'Treatment in Progress', 22, 'Burn, left forearm'),
    mk(134, 'Ella Mercado', '2nd Engineer', 'MV Northstar Pioneer', 'a4', 'Pending', 2, 'Eye irritation'),
    mk(133, 'Rico Bautista', 'Fitter', 'MV Harbor Line', 'a2', 'Pending', 6, 'Shoulder strain'),
    mk(132, 'Mark Villanueva', '2nd Mate', 'MV Ocean Grace', 'a3', 'Treatment in Progress', 9, 'Fractured wrist'),
    mk(130, 'Pedro Ramos', 'Oiler', 'MV Pacific Star', 'a1', 'Fit to Work', 150, 'Dermatitis'),
  ];
  unsendBilling(named[named.length - 1]); // Pedro Ramos: report sent, billing still waiting

  // Older records for Pacific Crew so lists, paging and reports have volume.
  const first = ['Jose', 'Ana', 'Liza', 'Noel', 'Rosa', 'Arnel', 'Tina', 'Ben', 'Cora', 'Dino', 'Elmer', 'Faye'];
  const last = ['Navarro', 'Garcia', 'Santos', 'Reyes', 'Flores', 'Castro', 'Rivera', 'Torres', 'Ramos', 'Aquino'];
  const posts = ['Able Seaman', 'Bosun', 'Oiler', '3rd Engineer', 'Chief Cook', 'Messman', '2nd Mate', 'Fitter'];
  const ships = ['MV Pacific Star', 'MV Ocean Grace', 'MV Pacific Dawn', 'MV Coral Trader', 'MV Island Pearl', 'MV Pacific Voyager'];
  const cases = ['Back strain', 'Gastritis', 'Ankle sprain', 'Flu-like symptoms', 'Dental pain', 'Finger injury'];
  const cycle = ['Fit to Work', 'Fit to Work', 'Fit to Work', 'Treatment in Progress', 'Fit to Work',
    'Fit to Work with Disability', 'Fit to Work', 'Reach Maximum Medical Improvement', 'Fit to Work',
    'Stop Treatment', 'Expired', 'Non-reporting Status'];
  const filler = Array.from({ length: 119 }, (_, i) =>
    mk(1000 + i, `${first[i % first.length]} ${last[(i * 7) % last.length]}`, posts[i % posts.length],
      ships[i % ships.length], 'a1', cycle[i % cycle.length], 90 + i * 10, cases[i % cases.length]));
  unsendBilling(filler[100]); // one old case whose billing is past the 30-day window

  const endorsements = [...named, ...filler].sort((a, b) => b.receivedMs - a.receivedMs);

  const juan = named[0];
  return {
    session: null,
    insideNetwork: false, // demo toggle: outside vs inside the clinic network
    policy: { network: '203.0.113.24', breakGlassMinutes: 30, autoLogoutMinutes: 5 },
    agencies,
    users,
    endorsements,
    nextRef: 143,
    alerts: [
      { id: 3, to: 'agency:a1', text: `${juan.ref} was accepted by the clinic.`, ms: juan.timeline[1].ms },
      { id: 2, to: 'staff', text: 'New endorsement from Harbor Crew Manning Agency.', ms: NOW - 4 * HOUR },
      { id: 1, to: 'admin', text: 'New agency access request from Island Spirit Crewing Corp.', ms: NOW - 12 * HOUR },
    ],
    breakGlass: [],
    // The audit log records clinic users only (staff and admin).
    audit: [
      { id: 2, who: 'R. Santos', role: 'Clinic Staff', action: 'Accepted', ref: juan.ref, ms: juan.timeline[1].ms },
      { id: 1, who: 'R. Santos', role: 'Clinic Staff', action: 'Viewed', ref: juan.ref, ms: juan.timeline[1].ms - 60e3 },
    ],
  };
}

/* ---------- reducer ---------- */

function reducer(s, a) {
  const me = a.type === 'login' ? a.session : s.session;
  const now = Date.now();

  // Agency activity is not written to the audit log.
  const audit = (action, id = '—', note) => {
    if (!me || me.role === 'agency') return s.audit;
    return [
      { id: s.audit.length + 1, who: me.name, role: ROLE_LABEL[me.role], action, ref: id, ms: now, note },
      ...s.audit,
    ];
  };
  const alert = (list, to, text) => [{ id: list.length + 1, to, text, ms: now }, ...list];
  const patch = (id, fn) => s.endorsements.map((e) => (e.ref === id ? fn(e) : e));
  const find = (id) => s.endorsements.find((e) => e.ref === id);
  const userName = (id) => s.users.find((u) => u.id === id)?.name;

  switch (a.type) {
    case 'login':
      return { ...s, session: a.session, audit: audit('Signed in') };

    case 'logout':
      return { ...s, session: null, insideNetwork: false };

    case 'toggleNetwork':
      return { ...s, insideNetwork: !s.insideNetwork };

    /* ----- manning agency ----- */
    case 'registerAgency': {
      const f = a.form;
      const item = {
        id: `a${s.agencies.length + 1}`,
        name: f.agencyName, address: f.address, status: 'Pending',
        authorized: { name: f.authName, position: f.authPosition, contact: f.authContact, email: f.authEmail },
        billing: { name: f.billName, position: f.billPosition, contact: f.billContact, email: f.billEmail },
        username: f.username, password: f.password,
        requestedMs: now,
      };
      return {
        ...s,
        agencies: [...s.agencies, item],
        alerts: alert(s.alerts, 'admin', `New agency access request from ${item.name}.`),
      };
    }

    // Agency "forgot password": runs after the verification code was confirmed.
    case 'resetAgencyPassword':
      return {
        ...s,
        agencies: s.agencies.map((g) => (g.username === a.username ? { ...g, password: a.password } : g)),
      };

    case 'updateAgencyContacts':
      return {
        ...s,
        agencies: s.agencies.map((g) =>
          g.id === a.id
            ? { ...g, address: a.address, authorized: { ...g.authorized, ...a.authorized }, billing: { ...g.billing, ...a.billing } }
            : g),
      };

    case 'submitEndorsement': {
      const id = refOf(s.nextRef);
      const item = {
        ...a.form, ref: id, agencyId: me.agencyId, status: 'Pending', receivedMs: now,
        timeline: [{ label: 'Received', ms: now }],
        turnaroundMin: null, arrivedMs: null, lastUpdateMs: null,
        billing: { state: 'none' }, cashBasis: false, updateRequested: false,
      };
      return {
        ...s,
        nextRef: s.nextRef + 1,
        endorsements: [item, ...s.endorsements],
        alerts: alert(s.alerts, 'staff', `New endorsement from ${agencyName(s, me.agencyId)}.`),
      };
    }

    case 'requestUpdate':
      return {
        ...s,
        endorsements: patch(a.id, (e) => ({ ...e, updateRequested: true })),
        alerts: alert(s.alerts, 'staff', `Medical update requested for ${a.id}.`),
      };

    /* ----- clinic staff ----- */
    case 'accept': {
      const e = find(a.id);
      return {
        ...s,
        endorsements: patch(a.id, (x) => ({
          ...x, status: 'Accepted', cashBasis: !!a.cash,
          turnaroundMin: Math.max(1, Math.round((now - x.receivedMs) / 60e3)),
          timeline: [...x.timeline, { label: 'Accepted', ms: now }],
        })),
        alerts: alert(s.alerts, `agency:${e.agencyId}`, `${a.id} was accepted by the clinic${a.cash ? ' on a cash basis' : ''}.`),
        audit: audit('Accepted', a.id, a.cash ? 'Cash basis (self-pay)' : undefined),
      };
    }

    // The patient reported to the clinic: treatment and weekly updates start.
    case 'arrive': {
      const e = find(a.id);
      return {
        ...s,
        endorsements: patch(a.id, (x) => ({
          ...x, arrivedMs: now, status: 'Treatment in Progress',
          timeline: [...x.timeline, { label: 'Arrived at clinic', ms: now }],
        })),
        alerts: alert(s.alerts, `agency:${e.agencyId}`, `${e.name} (${a.id}) arrived at the clinic. Weekly updates start now.`),
        audit: audit('Marked arrived', a.id),
      };
    }

    case 'sendUpdate': {
      const e = find(a.id);
      return {
        ...s,
        endorsements: patch(a.id, (x) => ({
          ...x, status: a.status, updateRequested: false, lastUpdateMs: now,
          timeline: [...x.timeline, { label: a.status, ms: now, file: a.file, kind: 'report' }],
          // The 30-day billing clock starts at the first report that has no billing yet.
          billing: x.billing.state === 'toSend' ? x.billing : { state: 'toSend', reportMs: now },
        })),
        alerts: alert(s.alerts, `agency:${e.agencyId}`, `Medical report received for ${a.id} (${a.status}).`),
        audit: audit('Updated status', a.id, a.status),
      };
    }

    case 'sendBilling': {
      const e = find(a.id);
      return {
        ...s,
        endorsements: patch(a.id, (x) => ({
          ...x,
          timeline: [...x.timeline, { label: 'Billing statement sent', ms: now, file: a.file, kind: 'billing' }],
          billing: { ...x.billing, state: 'sent', file: a.file, sentMs: now },
        })),
        alerts: alert(s.alerts, `agency:${e.agencyId}`, `Billing statement received for ${a.id}.`),
        audit: audit('Sent billing', a.id),
      };
    }

    case 'logView':
      return { ...s, audit: audit('Viewed', a.id) };

    case 'breakGlass': {
      const minutes = s.policy.breakGlassMinutes;
      return {
        ...s,
        breakGlass: [
          { id: s.breakGlass.length + 1, ref: a.id, by: me.name, reason: a.reason, note: a.note, ms: now, minutes, expires: now + minutes * 60e3, status: 'New' },
          ...s.breakGlass,
        ],
        alerts: alert(s.alerts, 'admin', `Break-glass request by ${me.name} on ${a.id}.`),
        audit: audit('Break-glass', a.id, `Reason: ${a.reason} · ${a.note}`),
      };
    }

    /* ----- clinic admin ----- */
    case 'reviewBreakGlass':
      return {
        ...s,
        breakGlass: s.breakGlass.map((b) => (b.id === a.id ? { ...b, status: a.status, reviewNote: a.note } : b)),
        audit: audit(a.status === 'Flagged' ? 'Flagged break-glass' : 'Reviewed break-glass', s.breakGlass.find((b) => b.id === a.id)?.ref, a.note || undefined),
      };

    // Approve, reject, suspend or reactivate an agency. Reject and suspend carry a reason.
    case 'agencyStatus':
      return {
        ...s,
        agencies: s.agencies.map((g) => (g.id === a.id ? { ...g, status: a.status, statusReason: a.reason || null } : g)),
        audit: audit(`Agency ${a.verb}`, '—', `${agencyName(s, a.id)}${a.reason ? ` · Reason: ${a.reason}` : ''}`),
      };

    // The admin creates clinic accounts directly; there is no self-registration for staff.
    case 'addUser':
      return {
        ...s,
        users: [
          ...s.users,
          {
            id: `u${s.users.length + 1}`, name: a.name, username: a.username, password: a.password,
            role: a.role, duty: a.role === 'Clinic Staff' ? a.duty : null, status: 'Active',
          },
        ],
        audit: audit('Created account', '—', `${a.name} · ${a.role}${a.role === 'Clinic Staff' ? ` · ${a.duty}` : ''}`),
      };

    case 'setUser':
      return {
        ...s,
        users: s.users.map((u) => (u.id === a.id ? { ...u, ...a.patch } : u)),
        audit: audit(a.verb, '—', `${userName(a.id)}${a.note ? ` · ${a.note}` : ''}`),
      };

    case 'resetUser':
      return {
        ...s,
        users: s.users.map((u) => (u.id === a.id ? { ...u, password: a.password } : u)),
        audit: audit('Reset password', '—', userName(a.id)),
      };

    case 'savePolicy':
      return { ...s, policy: a.policy, audit: audit('Updated access policy') };

    default:
      return s;
  }
}

/* ---------- context ---------- */

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, seed);
  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);
