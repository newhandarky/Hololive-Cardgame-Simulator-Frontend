import { useEffect, useState } from 'react';
import './App.css';
import { createTestUser, getUsers, healthCheck, type ApiUser } from './services/api';

function App() {
  const [health, setHealth] = useState('Checking API...');
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users from backend.');
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const data = await healthCheck();
        setHealth(data.message);
      } catch (err) {
        setHealth('Backend connection failed.');
        console.error(err);
      }
    };

    void init();
    void loadUsers();
  }, []);

  const handleCreateTestUser = async () => {
    setCreating(true);
    setError(null);
    try {
      await createTestUser();
      await loadUsers();
    } catch (err) {
      setError('Failed to create test user.');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="app">
      <h1>HOLOLIVE Card Game</h1>
      <p>API Status: {health}</p>

      <section className="panel">
        <div className="panel-header">
          <h2>Users</h2>
          <button type="button" onClick={handleCreateTestUser} disabled={creating}>
            {creating ? 'Creating...' : 'Create Test User'}
          </button>
        </div>

        {loadingUsers ? <p>Loading...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <ul>
          {users.map((user) => (
            <li key={user.id}>
              #{user.id} {user.displayName} ({user.lineUserId})
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default App;
