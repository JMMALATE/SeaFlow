// Screens used by more than one role: status timeline, alerts, profile.
import { useState } from 'react';
import { useStore, myAlerts, stamp, dayOf, fmtDate, isClosed, updateDue, agencyName, ROLE_LABEL } from '../store.jsx';
import { Shell, Chip, Field, Rows, useNav } from '../ui.jsx';

/** Compact endorsement card used in most lists. */
export function EndorsementCard({ e, onClick, agency, extra }) {
  return (
    <button className="card tap" onClick={onClick}>
      <div className="card-head">
        <div>
          {agency && <div className="over">{agency}</div>}
          <b>{e.name}</b>
        </div>
        <Chip>{e.status}</Chip>
      </div>
      <div className="meta">{e.position} · {e.vessel}</div>
      <div className="meta">
        {e.ref} · {stamp(e.receivedMs)}
        {extra}
      </div>
    </button>
  );
}

const HOME_TAB = { agency: 'm.list', staff: 's.active', admin: 'a.overview' };

/** Status timeline (M8–M12 for agencies, S19 for clinic users). */
export function Timeline({ id }) {
  const { state, dispatch } = useStore();
  const { toast } = useNav();
  const [confirming, setConfirming] = useState(false);
  const { role, agencyId } = state.session;
  const e = state.endorsements.find((x) => x.ref === id);

  // Agencies may only open their own patients.
  if (!e || (role === 'agency' && e.agencyId !== agencyId)) {
    return (
      <Shell title="Status timeline" back tab={HOME_TAB[role]}>
        <p className="empty">Record not found.</p>
      </Shell>
    );
  }

  const items = [...e.timeline].reverse(); // newest first
  const latest = items[0];
  const closed = isClosed(e);
  const due = updateDue(e);

  return (
    <Shell title="Status timeline" back tab={HOME_TAB[role]}>
      <div className="card">
        <div className="over">{e.ref}</div>
        <b style={{ fontSize: 17 }}>{e.name}</b>
        <div className="meta">{e.position} · {e.vessel}</div>
        <div className="chips">
          <Chip>{e.status}</Chip>
          {e.cashBasis && <Chip>Cash basis</Chip>}
        </div>
        <Rows
          items={[
            ['Can come to the clinic', fmtDate(e.visitDate)],
            ['Arrived at clinic', e.arrivedMs ? stamp(e.arrivedMs) : 'Not yet'],
            ...(due ? [['Next weekly update due', dayOf(due)]] : []),
          ]}
        />
        <div className="filerow">
          <span>📄 Referral letter: {e.referral}</span>
          <button className="link" onClick={() => toast(`${e.referral} is a demo file`)}>View</button>
        </div>
      </div>

      <h3>Updates from the clinic</h3>
      <ul className="tl">
        {items.map((t, i) => (
          <li key={i}>
            <b>{t.label}</b>
            <small>{stamp(t.ms)}</small>
            {t.file && (
              <div className="file">
                📄 {t.file}
                <br />
                <button className="link" onClick={() => toast(`${t.file} is a demo file`)}>
                  View {t.kind === 'billing' ? 'billing statement' : 'medical report'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="note teal">
        <b>Latest authorized update</b>
        {latest.label}
        {latest.file ? ' · file attached' : ''}
      </div>
      <p className="hint">Reports arrive as files from the clinic.</p>

      {closed && (
        <div className="note teal">
          <b>Case closed.</b>
          Final status: {e.status}. No further updates. The final medical report is in the timeline above.
        </div>
      )}

      {role === 'agency' && e.status === 'Pending' && (
        <div className="note amber">Waiting for the clinic to review this endorsement.</div>
      )}

      {role === 'agency' && !closed && e.status !== 'Pending' && (
        !e.arrivedMs ? (
          <div className="note amber">
            <b>Waiting for the patient to report to the clinic.</b>
            Weekly medical updates start once the patient arrives. Expected visit: {fmtDate(e.visitDate)}.
          </div>
        ) : e.updateRequested ? (
          <div className="note amber">
            <b>Medical update requested.</b>
            The clinic will send the report, then a billing statement follows.
          </div>
        ) : confirming ? (
          <>
            <div className="note amber">
              <b>Request a medical update?</b>
              The clinic sends the medical report, then a billing statement goes to your medical report and
              billing contact.
            </div>
            <div className="btn-row">
              <button
                className="btn primary"
                onClick={() => {
                  dispatch({ type: 'requestUpdate', id });
                  setConfirming(false);
                  toast('Update request sent to the clinic');
                }}
              >
                Confirm request
              </button>
              <button className="btn" onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </>
        ) : (
          <button className="btn primary block" onClick={() => setConfirming(true)}>
            Request medical update
          </button>
        )
      )}
    </Shell>
  );
}

/** Notifications for the signed-in user (M13, S20, A16). */
export function Alerts() {
  const { state } = useStore();
  const list = myAlerts(state);
  return (
    <Shell title="Alerts" tab="alerts">
      <h2>Notifications</h2>
      {list.length === 0 && <p className="empty">No notifications yet.</p>}
      {list.map((a) => (
        <div className="card" key={a.id}>
          <div>{a.text}</div>
          <div className="meta">{stamp(a.ms)}</div>
        </div>
      ))}
    </Shell>
  );
}

/** Profile (M14–M15 for agencies, S21/A17 for clinic users). */
export function Profile() {
  const { state, dispatch } = useStore();
  const { role, name } = state.session;
  const signOut = () => dispatch({ type: 'logout' });

  if (role !== 'agency') {
    return (
      <Shell title="Profile" tab="profile">
        <div className="card">
          <b>{name}</b>
          <div className="meta">{ROLE_LABEL[role]} · NGC Medical Specialists Clinic</div>
          {role === 'staff' && <div className="meta">Assigned to: {state.session.duty}</div>}
        </div>
        <button className="btn primary block" onClick={signOut}>Sign out</button>
      </Shell>
    );
  }
  return <AgencyProfile onSignOut={signOut} />;
}

function AgencyProfile({ onSignOut }) {
  const { state, dispatch } = useStore();
  const { toast } = useNav();
  const a = state.agencies.find((x) => x.id === state.session.agencyId);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    address: a.address,
    authContact: a.authorized.contact, authEmail: a.authorized.email,
    billContact: a.billing.contact, billEmail: a.billing.email,
  });
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value });

  const save = () => {
    dispatch({
      type: 'updateAgencyContacts', id: a.id, address: f.address,
      authorized: { contact: f.authContact, email: f.authEmail },
      billing: { contact: f.billContact, email: f.billEmail },
    });
    setEditing(false);
    toast('Details updated');
  };

  if (editing) {
    return (
      <Shell title="Profile" tab="profile">
        <h2>Edit details</h2>
        <p className="sub">To change the agency name or the named persons, contact the clinic.</p>
        <Field label="Address"><input type="text" value={f.address} onChange={set('address')} /></Field>
        <h3>Authorized person · {a.authorized.name}</h3>
        <Field label="Contact no."><input type="tel" value={f.authContact} onChange={set('authContact')} /></Field>
        <Field label="Email address"><input type="email" value={f.authEmail} onChange={set('authEmail')} /></Field>
        <h3>Medical report and billing · {a.billing.name}</h3>
        <Field label="Contact no."><input type="tel" value={f.billContact} onChange={set('billContact')} /></Field>
        <Field label="Email address"><input type="email" value={f.billEmail} onChange={set('billEmail')} /></Field>
        <button className="btn primary block" onClick={save}>Save changes</button>
        <button className="btn block" onClick={() => setEditing(false)}>Cancel</button>
      </Shell>
    );
  }

  return (
    <Shell title="Profile" tab="profile">
      <div className="card">
        <div className="card-head">
          <b>{a.name}</b>
          <Chip>{a.status}</Chip>
        </div>
        <div className="meta">Manning agency account · Username: {a.username}</div>
      </div>
      <div className="card">
        <b>Agency</b>
        <Rows items={[['Agency name', a.name], ['Address', a.address]]} />
        <div className="meta">To change the agency name, contact the clinic.</div>
      </div>
      <div className="card">
        <b>Authorized person</b>
        <Rows items={[['Name', a.authorized.name], ['Position', a.authorized.position],
          ['Contact no.', a.authorized.contact], ['Email address', a.authorized.email]]} />
      </div>
      <div className="card">
        <b>In charge of medical report and billing</b>
        <Rows items={[['Name', a.billing.name], ['Position', a.billing.position],
          ['Contact no.', a.billing.contact], ['Email address', a.billing.email]]} />
      </div>
      <button className="btn primary block" onClick={() => setEditing(true)}>Edit details</button>
      <button className="btn block" onClick={onSignOut}>Sign out</button>
    </Shell>
  );
}

export { agencyName };
