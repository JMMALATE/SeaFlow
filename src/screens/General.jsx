// General screens: sign in (G1–G2) and agency registration (G3–G5).
import { useState } from 'react';
import { useStore, ROLE_LABEL, DEMO_PASSWORD } from '../store.jsx';
import { Shell, Field, FilePick, useNav } from '../ui.jsx';

const DEMO_USER = { agency: 'agency.demo', staff: 'staff.demo', admin: 'admin.demo' };

export function SignIn() {
  const { state, dispatch } = useStore();
  const { nav } = useNav();
  const [role, setRole] = useState('agency');
  const [username, setUsername] = useState(DEMO_USER.agency);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [roleWarning, setRoleWarning] = useState('');

  // Changing the role keeps a typed username. Only the untouched demo
  // username is swapped for the matching demo account, for convenience.
  const changeRole = (r) => {
    setRole(r);
    if (Object.values(DEMO_USER).includes(username.trim())) {
      setUsername(DEMO_USER[r]);
      setPassword(DEMO_PASSWORD);
    }
    setError('');
    setRoleWarning('');
  };

  const submit = (ev) => {
    ev.preventDefault();
    setError('');
    setRoleWarning('');
    const u = username.trim();
    if (!u) return setError('Enter your username.');

    // Step 1: look for the username among the accounts of the selected role only.
    const account = role === 'agency'
      ? state.agencies.find((x) => x.username === u)
      : state.users.find((x) => x.username === u && x.role === ROLE_LABEL[role]);

    // No such account under this role: warn.
    if (!account) {
      return setRoleWarning(
        `There is no ${ROLE_LABEL[role]} account with the username "${u}". ` +
        'Check the username, or choose the role your account belongs to.',
      );
    }

    // Step 2: the account exists in this role, so check the password and status.
    if (account.password !== password) return setError('Incorrect password. Please try again.');

    if (role === 'agency') {
      if (account.status === 'Pending') return setError('Your registration is still waiting for admin approval.');
      if (account.status !== 'Active') {
        return setError(`This agency account is ${account.status.toLowerCase()}. Contact the clinic.`);
      }
      return dispatch({ type: 'login', session: { role, name: account.name, agencyId: account.id } });
    }
    if (account.status !== 'Active') return setError('This account is not active. Contact the clinic admin.');
    return dispatch({ type: 'login', session: { role, name: account.name, userId: account.id } });
  };

  return (
    <Shell title="Welcome aboard">
      <div className="brand">
        <b>≈ SeaFlow</b>
        <small>Care coordination. Clear horizons.</small>
      </div>
      <h2>Sign in to your workspace</h2>
      <p className="sub">Choose your role below to continue.</p>
      <form onSubmit={submit} noValidate>
        <Field label="Role" error={roleWarning && ' '}>
          <select value={role} onChange={(ev) => changeRole(ev.target.value)}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        {roleWarning && (
          <div className="note amber" role="alert">
            <b>⚠ No account in this role</b>
            {roleWarning}
          </div>
        )}
        <Field label="Username" error={(roleWarning || (error && !error.startsWith('Incorrect password'))) && ' '}>
          <input type="text" value={username} autoCapitalize="none" onChange={(ev) => setUsername(ev.target.value)} />
        </Field>
        <Field label="Password" error={error && ' '}>
          <input type={show ? 'text' : 'password'} value={password} onChange={(ev) => setPassword(ev.target.value)} />
        </Field>
        <button type="button" className="link" onClick={() => setShow(!show)}>
          {show ? 'Hide' : 'Show'} password
        </button>
        {error && <p className="err">{error}</p>}
        <button className="btn primary block">Sign in</button>
      </form>
      <p className="hint">
        Demo accounts: agency.demo, staff.demo, admin.demo · password {DEMO_PASSWORD}
      </p>
      <button className="btn block" onClick={() => nav('g.request')}>Request agency access</button>
      <p className="hint">
        🛡 Authorized users only. Access is logged. Auto-logout after {state.policy.autoLogoutMinutes} minutes of inactivity.
      </p>
    </Shell>
  );
}

const EMPTY = {
  agencyName: '', address: '',
  authName: '', authPosition: '', authContact: '', authEmail: '',
  billName: '', billPosition: '', billContact: '', billEmail: '',
  username: '', password: '',
  license: '', letter: '', repId: '',
  confirm: false,
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RequestAccess() {
  const { state, dispatch } = useStore();
  const { nav, back } = useNav();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value });

  const submit = (ev) => {
    ev.preventDefault();
    const e = {};
    const required = ['agencyName', 'address', 'authName', 'authPosition', 'authContact', 'authEmail',
      'billName', 'billPosition', 'billContact', 'billEmail', 'username', 'password', 'license', 'letter'];
    required.forEach((k) => { if (!String(f[k]).trim()) e[k] = 'This field is required.'; });
    ['authEmail', 'billEmail'].forEach((k) => { if (f[k] && !EMAIL.test(f[k])) e[k] = 'Enter a valid email address.'; });
    if (f.password && f.password.length < 8) e.password = 'Use at least 8 characters.';
    const taken = state.agencies.some((a) => a.username === f.username.trim())
      || state.users.some((u) => u.username === f.username.trim());
    if (f.username && taken) e.username = 'That username is already taken.';
    if (!f.confirm) e.confirm = 'Please confirm you are authorized.';
    setErrors(e);
    if (Object.keys(e).length) return;
    dispatch({ type: 'registerAgency', form: { ...f, username: f.username.trim() } });
    nav('g.submitted', { name: f.agencyName });
  };

  const text = (k, label, placeholder, type = 'text') => (
    <Field label={`${label} *`} error={errors[k]}>
      <input type={type} value={f[k]} placeholder={placeholder} onChange={set(k)} />
    </Field>
  );
  const doc = (k, label) => (
    <>
      <FilePick file={f[k]} empty={label} pickLabel="Attach"
        onPick={(name) => setF({ ...f, [k]: name })} onRemove={() => setF({ ...f, [k]: '' })} />
      {errors[k] && <p className="err">{errors[k]}</p>}
    </>
  );

  return (
    <Shell title="Request access" back>
      <h2>Request agency access</h2>
      <p className="sub">For accredited manning agencies. The clinic admin reviews every request.</p>
      <form onSubmit={submit} noValidate>
        {text('agencyName', 'Name of manning agency', 'Pacific Crew Manning Agency')}
        {text('address', 'Address', 'Street, city')}

        <h3>Authorized person</h3>
        <p className="sub">The agency head or signatory, not the staff who will use the app.</p>
        {text('authName', 'Name', 'Full name')}
        {text('authPosition', 'Position', 'e.g. General Manager')}
        {text('authContact', 'Contact no.', '09xx xxx xxxx', 'tel')}
        {text('authEmail', 'Email address', 'name@agency.com', 'email')}

        <h3>Person in charge of medical report and billing</h3>
        {text('billName', 'Name', 'Full name')}
        {text('billPosition', 'Position', 'e.g. Billing Officer')}
        {text('billContact', 'Contact no.', '09xx xxx xxxx', 'tel')}
        {text('billEmail', 'Email address', 'billing@agency.com', 'email')}

        <h3>Login</h3>
        {text('username', 'Username', 'Choose a username')}
        {text('password', 'Password (min. 8 characters)', '', 'password')}

        <h3>Documents</h3>
        {doc('license', 'DMW license *')}
        {doc('letter', 'Authorization letter *')}
        {doc('repId', 'Representative ID (optional)')}

        <label className="check">
          <input type="checkbox" checked={f.confirm} onChange={set('confirm')} />
          I confirm I am authorized to register this agency and the details are accurate.
        </label>
        {errors.confirm && <p className="err">{errors.confirm}</p>}
        <button className="btn primary block">Submit request</button>
        <button type="button" className="btn block" onClick={back}>Cancel</button>
      </form>
    </Shell>
  );
}

export function RequestSubmitted({ name }) {
  const { reset } = useNav();
  return (
    <Shell title="Request sent">
      <div className="card center">
        <div className="big-check">✓</div>
        <h2>Request submitted</h2>
        <p className="sub">
          {name} is now waiting for clinic admin approval. You can sign in with your chosen username once the
          request is approved.
        </p>
        <button className="btn primary block" onClick={() => reset('signin')}>Back to sign in</button>
      </div>
    </Shell>
  );
}
