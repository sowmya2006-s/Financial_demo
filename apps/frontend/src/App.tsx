import { useState } from 'react';
import './App.css';

const API_BASE = 'http://localhost:3005';

async function registerAndLogin() {
  const email = 'test@example.com';
  const name = 'Test User';
  const password = 'Password123!';

  // Register
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password }),
  });

  if (!regRes.ok) {
    const regData = await regRes.json().catch(() => ({}));
    // If the email is already taken, we can proceed to login. Otherwise, throw the validation or server error.
    if (regRes.status !== 409 && regData.code !== 'EMAIL_TAKEN') {
      throw new Error(regData.error || `Registration failed with status ${regRes.status}`);
    }
  }

  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const loginData = await loginRes.json();
  if (loginRes.ok && loginData.token) {
    localStorage.setItem('token', loginData.token);
    return loginData.token;
  }
  throw new Error(loginData.error || 'Login failed');
}


async function createProfile(token: string) {
  const res = await fetch(`${API_BASE}/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: 'MyProfile', difficulty: 'BEGINNER', age: 25 }),
  });
  return res.json();
}

function App(): JSX.Element {
  const [status, setStatus] = useState('');

  const handleCreate = async () => {
    setStatus('Registering & logging in...');
    try {
      const token = await registerAndLogin();
      setStatus('Creating profile...');
      const result = await createProfile(token);
      setStatus('Profile created: ' + JSON.stringify(result));
    } catch (e) {
      setStatus('Error: ' + (e as Error).message);
    }
  };

  return (
    <div className="App">
      <h1>Moolah Minds</h1>
      <p>Financial Literacy Simulator</p>
      <button onClick={handleCreate}>Create Test Profile</button>
      <p>{status}</p>
    </div>
  );
}

export default App;
