// Manning agency side (M1–M18). Agencies only ever see their own endorsements.
import { useState } from 'react';
import { useStore, IN_PROGRESS, CLOSED, isClosed, refOf } from '../store.jsx';
import { Shell, Field, Paged, useNav } from '../ui.jsx';
import { EndorsementCard } from './Shared.jsx';

function useMine() {
  const { state } = useStore();
  const agency = state.agencies.find((a) => a.id === state.session.agencyId);
  const mine = state.endorsements.filter((e) => e.agencyId === agency.id);
  return { agency, mine };
}

const GROUPS = {
  All: () => true,
  Pending: (e) => e.status === 'Pending',
  'In progress': (e) => IN_PROGRESS.includes(e.status),
  Concluded: (e) => CLOSED.includes(e.status),
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** M1 Agency home */
export function Home() {
  const { nav } = useNav();
  const { agency, mine } = useMine();
  const count = (g) => mine.filter(GROUPS[g]).length;
  const short = agency.name.split(' ').slice(0, 2).join(' ');

  return (
    <Shell title="Agency home" tab="m.home">
      <h2>{greeting()}, {short}</h2>
      <p className="sub">{agency.name}</p>
      <div className="stats">
        <button className="stat" onClick={() => nav('m.list', { group: 'Pending' })}>
          <strong className="c-amber">{count('Pending')}</strong>
          <small>Pending ›</small>
        </button>
        <button className="stat" onClick={() => nav('m.list', { group: 'In progress' })}>
          <strong className="c-teal">{count('In progress')}</strong>
          <small>In progress ›</small>
        </button>
        <button className="stat" onClick={() => nav('m.list', { group: 'Concluded' })}>
          <strong>{count('Concluded')}</strong>
          <small>Concluded ›</small>
        </button>
      </div>
      <button className="btn primary block" onClick={() => nav('m.new')}>+ New endorsement</button>

      <h3>Recent endorsements</h3>
      <p className="sub">Your agency's records only</p>
      {mine.slice(0, 3).map((e) => (
        <EndorsementCard key={e.ref} e={e} onClick={() => nav('timeline', { id: e.ref })} />
      ))}
      {mine.length === 0 && <p className="empty">No endorsements yet.</p>}
    </Shell>
  );
}

/** M2–M3 Endorsements: history and search */
export function Endorsements({ group = 'All' }) {
  const { nav } = useNav();
  const { mine } = useMine();
  const [q, setQ] = useState('');
  const [g, setG] = useState(group);
  const needle = q.trim().toLowerCase();
  const list = mine.filter(
    (e) => GROUPS[g](e) && (!needle || `${e.name} ${e.vessel} ${e.ref}`.toLowerCase().includes(needle)),
  );

  return (
    <Shell title="Endorsements" tab="m.list" back={group !== 'All'}>
      <h2>History &amp; search</h2>
      <p className="sub">Past and active endorsements, no follow-up calls needed.</p>
      <Field label="Search">
        <input type="search" value={q} placeholder="Search name, vessel or reference" onChange={(ev) => setQ(ev.target.value)} />
      </Field>
      <Field label="Show">
        <select value={g} onChange={(ev) => setG(ev.target.value)}>
          {Object.keys(GROUPS).map((k) => <option key={k}>{k}</option>)}
        </select>
      </Field>
      <Paged
        key={`${g}:${needle}`}
        items={list}
        size={10}
        empty="No endorsements match."
        render={(e) => <EndorsementCard key={e.ref} e={e} onClick={() => nav('timeline', { id: e.ref })} />}
      />
    </Shell>
  );
}

const BLANK = {
  name: '', birthday: '', age: '', address: '', email: '', contact: '',
  position: '', vessel: '', repatriation: '', case: '', confirm: false,
};
const DEMO = {
  name: 'Juan Dela Cruz', birthday: '1994-03-12', age: '32', address: '123 Taft Ave., Malate, Manila',
  email: 'juan.delacruz@mail.demo', contact: '0917 000 0142', position: '3rd Officer',
  vessel: 'MV Pacific Star', repatriation: new Date().toISOString().slice(0, 10), case: 'Fractured wrist', confirm: true,
};

function ageFrom(birthday) {
  if (!birthday) return '';
  const d = new Date(birthday);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age -= 1;
  return age >= 0 && age < 120 ? String(age) : '';
}

/** M4–M7 New endorsement, M16–M17 duplicate warning */
export function NewEndorsement() {
  const { state, dispatch } = useStore();
  const { reset } = useNav();
  const { agency, mine } = useMine();
  const [f, setF] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [dupWarned, setDupWarned] = useState(false);

  const set = (k) => (ev) => {
    const value = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    const next = { ...f, [k]: value };
    if (k === 'birthday') next.age = ageFrom(value); // age follows the birthday
    if (k === 'name' || k === 'vessel') setDupWarned(false);
    setF(next);
  };

  const submit = (ev) => {
    ev.preventDefault();
    const e = {};
    Object.keys(BLANK).forEach((k) => {
      if (k !== 'confirm' && !String(f[k]).trim()) e[k] = 'This field is required.';
    });
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter a valid email address.';
    if (!f.confirm) e.confirm = 'Please confirm authorization.';
    setErrors(e);
    if (Object.keys(e).length) return;

    // Same seafarer and vessel with a case still open: warn once, then allow.
    const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
    const duplicate = mine.some((x) => !isClosed(x) && same(x.name, f.name) && same(x.vessel, f.vessel));
    if (duplicate && !dupWarned) {
      setDupWarned(true);
      return;
    }

    const id = refOf(state.nextRef);
    const { confirm, ...data } = f;
    dispatch({ type: 'submitEndorsement', form: { ...data, age: Number(f.age) } });
    reset('m.submitted', { id });
  };

  const input = (k, label, placeholder, type = 'text', hint) => (
    <Field label={`${label} *`} error={errors[k]} hint={hint}>
      <input type={type} value={f[k]} placeholder={placeholder} onChange={set(k)} />
    </Field>
  );

  return (
    <Shell title="New endorsement" back tab="m.list">
      <h2>Endorse a seafarer</h2>
      <p className="sub">* Required · Only coordination details</p>
      {dupWarned && (
        <div className="note amber">
          Possible duplicate: same name and vessel already endorsed. Submit again to confirm.
        </div>
      )}
      <form onSubmit={submit} noValidate>
        {input('name', 'Seafarer full name', 'Juan Dela Cruz')}
        <div className="two">
          {input('birthday', 'Birthday', '', 'date')}
          {input('age', 'Age', 'e.g. 32', 'number')}
        </div>
        {input('address', 'Address', 'Street, barangay, city')}
        {input('email', 'Email address', 'name@email.com', 'email')}
        {input('contact', 'Contact number', '09xx xxx xxxx', 'tel', "The contact name is the seafarer's name.")}
        {input('position', 'Position', '3rd Officer')}
        {input('vessel', 'Vessel (name of the ship)', 'MV Pacific Star')}
        <Field label="Agent *">
          <input type="text" value={agency.name} readOnly />
        </Field>
        {input('repatriation', 'Date of repatriation', '', 'date')}
        {input('case', 'Case', 'e.g. Fractured wrist')}
        <label className="check">
          <input type="checkbox" checked={f.confirm} onChange={set('confirm')} />
          I confirm my agency is authorized to share this information with the clinic.
        </label>
        {errors.confirm && <p className="err">{errors.confirm}</p>}
        <button type="button" className="btn block" onClick={() => { setF(DEMO); setErrors({}); setDupWarned(false); }}>
          Fill demo details
        </button>
        <button className="btn primary block">Submit endorsement</button>
      </form>
    </Shell>
  );
}

/** M18 Endorsement submitted */
export function Submitted({ id }) {
  const { nav, reset } = useNav();
  return (
    <Shell title="Submitted" tab="m.list">
      <div className="card center">
        <div className="big-check">✓</div>
        <h2>Endorsement submitted</h2>
        <p className="sub">Sent to the clinic verification queue.</p>
        <div className="meta">Reference number</div>
        <div className="ref">{id}</div>
        <button className="btn primary block" onClick={() => nav('timeline', { id })}>View status</button>
        <button className="btn block" onClick={() => reset('m.home')}>Back to home</button>
      </div>
    </Shell>
  );
}
