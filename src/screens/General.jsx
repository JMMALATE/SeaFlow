// General screens: sign in (G1–G2), agency registration (G3–G5), agency password reset.
import { useState } from 'react';
import { useStore, ROLE_LABEL, DEMO_PASSWORD } from '../store.jsx';
import { Shell, Field, useNav } from '../ui.jsx';

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
        return setError(
          `This agency account is ${account.status.toLowerCase()}` +
          `${account.statusReason ? ` (${account.statusReason})` : ''}. Contact the clinic.`,
        );
      }
      return dispatch({ type: 'login', session: { role, name: account.name, agencyId: account.id } });
    }
    if (account.status !== 'Active') return setError('This account is deactivated. Contact the clinic admin.');
    return dispatch({
      type: 'login',
      session: { role, name: account.name, userId: account.id, duty: account.duty },
    });
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
        <div className="link-row">
          <button type="button" className="link" onClick={() => setShow(!show)}>
            {show ? 'Hide' : 'Show'} password
          </button>
          <button type="button" className="link" onClick={() => nav('g.forgot', { role, username: username.trim() })}>
            Forgot password?
          </button>
        </div>
        {error && <p className="err">{error}</p>}
        <button className="btn primary block">Sign in</button>
      </form>
      <p className="hint">
        Demo accounts: agency.demo, staff.demo, billing.demo, updates.demo, admin.demo · password {DEMO_PASSWORD}
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
  confirm: false,
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Agency registration. No supporting documents are needed. */
export function RequestAccess() {
  const { state, dispatch } = useStore();
  const { nav, back } = useNav();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value });

  const submit = (ev) => {
    ev.preventDefault();
    const e = {};
    Object.keys(EMPTY).forEach((k) => {
      if (k !== 'confirm' && !String(f[k]).trim()) e[k] = 'This field is required.';
    });
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

  return (
    <Shell title="Request access" back>
      <h2>Request agency access</h2>
      <p className="sub">For accredited manning agencies. The clinic admin reviews every request.</p>
      <form className="grid-form" onSubmit={submit} noValidate>
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

const maskEmail = (email) => email.replace(/^(.).*(@.*)$/, '$1•••••$2');
const maskPhone = (phone) => `•••• ••• ${phone.replace(/\D/g, '').slice(-4)}`;

/**
 * Password reset.
 * Manning agencies verify with a 6-digit code sent to the authorized person's
 * email or mobile number. Clinic staff ask the clinic admin instead.
 */
export function ForgotPassword({ role = 'agency', username: initial = '' }) {
  const { state, dispatch } = useStore();
  const { back, reset, toast } = useNav();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState(initial);
  const [channel, setChannel] = useState('email');
  const [sent, setSent] = useState(null); // { code, to }
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');

  if (role !== 'agency') {
    return (
      <Shell title="Forgot password" back>
        <div className="card">
          <b>Ask the clinic admin</b>
          <p className="sub">
            Clinic staff and admin passwords are reset by the clinic admin under Manage → Users. The admin
            will give you a new temporary password.
          </p>
          <button className="btn primary block" onClick={back}>Back to sign in</button>
        </div>
      </Shell>
    );
  }

  const agency = state.agencies.find((a) => a.username === username.trim());

  const sendCode = (ev) => {
    ev.preventDefault();
    if (!agency) return setError('No manning agency account uses that username.');
    // Demo only: a real system sends this by email or SMS and never shows it on screen.
    const fresh = String(Math.floor(100000 + Math.random() * 900000));
    setSent({
      code: fresh,
      to: channel === 'email' ? maskEmail(agency.authorized.email) : maskPhone(agency.authorized.contact),
    });
    setError('');
    setCode('');
    return setStep(2);
  };

  const save = (ev) => {
    ev.preventDefault();
    if (code.trim() !== sent.code) return setError('That verification code is not correct.');
    if (password.length < 8) return setError('Use at least 8 characters for the new password.');
    if (password !== again) return setError('The two passwords do not match.');
    dispatch({ type: 'resetAgencyPassword', username: agency.username, password });
    toast('Password changed. Sign in with your new password.');
    return reset('signin');
  };

  return (
    <Shell title="Forgot password" back>
      <h2>Reset agency password</h2>
      {step === 1 ? (
        <form onSubmit={sendCode} noValidate>
          <p className="sub">We send a verification code to the authorized person on your agency account.</p>
          <Field label="Agency username" error={error}>
            <input type="text" value={username} autoCapitalize="none"
              onChange={(ev) => { setUsername(ev.target.value); setError(''); }} />
          </Field>
          <Field label="Send the code to">
            <select value={channel} onChange={(ev) => setChannel(ev.target.value)}>
              <option value="email">Email address</option>
              <option value="sms">Mobile number</option>
            </select>
          </Field>
          <button className="btn primary block">Send verification code</button>
        </form>
      ) : (
        <form onSubmit={save} noValidate>
          <p className="sub">A 6-digit code was sent to {sent.to}.</p>
          <div className="note amber">
            <b>Demo only</b>
            No real message is sent in this prototype. Your code is {sent.code}.
          </div>
          <Field label="Verification code">
            <input type="text" inputMode="numeric" maxLength={6} value={code}
              onChange={(ev) => { setCode(ev.target.value); setError(''); }} />
          </Field>
          <Field label="New password (min. 8 characters)">
            <input type="password" value={password} onChange={(ev) => { setPassword(ev.target.value); setError(''); }} />
          </Field>
          <Field label="Repeat new password">
            <input type="password" value={again} onChange={(ev) => { setAgain(ev.target.value); setError(''); }} />
          </Field>
          {error && <p className="err">{error}</p>}
          <button className="btn primary block">Change password</button>
          <button type="button" className="btn block" onClick={() => { setStep(1); setError(''); }}>
            Send a new code
          </button>
        </form>
      )}
    </Shell>
  );
}
