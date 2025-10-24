import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { saveAs } from 'file-saver';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

// ------------------ Auth context & mock API ------------------
const AuthContext = createContext();
function useAuth() {
  return useContext(AuthContext);
}

// Mock metrics (small dataset for demo)
const MOCK_METRICS = [
  { date: '2025-10-01', users: 120, revenue: 2400, region: 'North' },
  { date: '2025-10-02', users: 200, revenue: 4200, region: 'South' },
  { date: '2025-10-03', users: 150, revenue: 3300, region: 'East' },
  { date: '2025-10-04', users: 170, revenue: 2900, region: 'West' },
  { date: '2025-10-05', users: 220, revenue: 4800, region: 'North' },
  { date: '2025-10-06', users: 90, revenue: 1200, region: 'South' },
  { date: '2025-10-07', users: 300, revenue: 7200, region: 'East' },
];

function mockLogin(username, password) {
  // very simple mock - admin/admin or user/user
  if ((username === 'admin' && password === 'admin') || (username === 'user' && password === 'user')) {
    const role = username === 'admin' ? 'admin' : 'user';
    const payload = { role, iat: Date.now() };
    const token = btoa(JSON.stringify(payload));
    return Promise.resolve({ token, role });
  }
  return Promise.reject(new Error('Invalid credentials'));
}

function fetchMetrics() {
  // simulate API latency
  return new Promise((res) => setTimeout(() => res([...MOCK_METRICS]), 300));
}

// ------------------ Utility Components ------------------
function IconLock() {
  return (
    <svg className="w-5 h-5 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c1.657 0 3-1.343 3-3V6a3 3 0 10-6 0v2c0 1.657 1.343 3 3 3z"></path>
      <rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect>
    </svg>
  );
}

// ------------------ Main App ------------------
export default function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('token');
    if (!token) return { user: null, role: null, token: null };
    try {
      const p = JSON.parse(atob(token));
      return { user: {}, role: p.role, token };
    } catch (e) {
      return { user: null, role: null, token: null };
    }
  });

  useEffect(() => {
    if (auth.token) localStorage.setItem('token', auth.token);
    else localStorage.removeItem('token');
  }, [auth.token]);

  const login = async (username, password) => {
    const r = await mockLogin(username, password);
    setAuth({ user: { username }, role: r.role, token: r.token });
  };
  const logout = () => setAuth({ user: null, role: null, token: null });

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      <div className="min-h-screen bg-slate-50 p-6 font-sans">
        <Header />
        <main className="mt-6">{auth.role ? <Dashboard /> : <AuthPanel />}</main>
      </div>
    </AuthContext.Provider>
  );
}

function Header() {
  const { role, logout } = useAuth();
  return (
    <header className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">
        Admin Dashboard <span className="text-sm text-slate-500">(Phase 5 Demo)</span>
      </h1>
      <div className="flex items-center gap-4">
        {role && (
          <div className="text-sm px-3 py-1 bg-white rounded shadow-sm">
            Role: <strong className="ml-2">{role}</strong>
          </div>
        )}
        {role ? (
          <button onClick={logout} className="px-3 py-1 bg-red-500 text-white rounded">
            Logout
          </button>
        ) : null}
      </div>
    </header>
  );
}

// ------------------ Auth / Login ------------------
function AuthPanel() {
  return (
    <div className="max-w-md mx-auto bg-white rounded shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Sign in</h2>
      <p className="text-sm text-slate-500 mb-4">
        Use <strong>admin/admin</strong> for Admin or <strong>user/user</strong> for Basic user.
      </p>
      <LoginForm />
    </div>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await login(u, p);
    } catch (er) {
      setErr(er.message);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input value={u} onChange={(e) => setU(e.target.value)} placeholder="Username" className="w-full p-2 border rounded" />
      <input value={p} onChange={(e) => setP(e.target.value)} placeholder="Password" type="password" className="w-full p-2 border rounded" />
      {err && <div className="text-red-600">{err}</div>}
      <div className="flex items-center justify-between">
        <button disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">
          {loading ? 'Signing...' : 'Sign in'}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-sm text-slate-500"
            onClick={() => {
              setU('admin');
              setP('admin');
            }}
          >
            Fill admin
          </button>
          <button
            type="button"
            className="text-sm text-slate-500"
            onClick={() => {
              setU('user');
              setP('user');
            }}
          >
            Fill user
          </button>
        </div>
      </div>
    </form>
  );
}

// ------------------ Dashboard ------------------
function Dashboard() {
  const { role } = useAuth();
  const [metrics, setMetrics] = useState([]);
  const [regionFilter, setRegionFilter] = useState('All');
  const [dateRange, setDateRange] = useState('7');
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchMetrics().then((data) => {
      setMetrics(data);
      setLoading(false);
    });
  }, []);

  const regions = useMemo(() => ['All', ...Array.from(new Set(metrics.map((m) => m.region)))], [metrics]);

  // Filter by region and last N days (based on dateRange)
  const filtered = useMemo(() => {
    let res = [...metrics];
    if (regionFilter !== 'All') res = res.filter((r) => r.region === regionFilter);

    // Date trimming: keep only last N days from the latest date in data
    const n = Number(dateRange) || 7;
    if (res.length > 0) {
      const dates = res.map((r) => new Date(r.date));
      const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
      const cutoff = new Date(latest);
      cutoff.setDate(cutoff.getDate() - (n - 1));
      res = res.filter((r) => new Date(r.date) >= cutoff);
    }
    return res.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [metrics, regionFilter, dateRange]);

  function handleExportCSV() {
    // Only admin may export
    if (role !== 'admin') return setAccessDenied('You need Admin rights to export CSV');
    const headers = ['date', 'users', 'revenue', 'region'];

    const escapeCell = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = filtered.map((r) => headers.map((h) => escapeCell(r[h])).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'metrics.csv');
  }

  return (
    <div className="mt-6">
      <div className="flex gap-4 items-center">
        <div className="bg-white p-4 rounded shadow flex-1">
          <h3 className="font-medium">Filters</h3>
          <div className="mt-3 flex gap-2 items-center">
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="p-2 border rounded">
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="p-2 border rounded">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>

            <button onClick={handleExportCSV} className="px-3 py-2 bg-green-600 text-white rounded flex items-center gap-2">
              Export CSV
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow w-64">
          <h3 className="font-medium">Security</h3>
          <div className="mt-2 text-sm text-slate-600">Role-based Access Control (RBAC)</div>
          <div className="mt-3 flex items-center gap-2">
            <IconLock /> <div className="text-sm">Current: <strong>{role}</strong></div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Users Over Time">
          <LineChart data={filtered} loading={loading} />
        </Card>
        <Card title="Revenue Breakdown">
          <BarChart data={filtered} loading={loading} />
        </Card>
        <Card title="Region Share">
          <PieChart data={filtered} loading={loading} />
        </Card>
      </div>

      <div className="mt-6 bg-white p-4 rounded shadow">
        <h3 className="font-medium">Quick Actions</h3>
        <div className="mt-3 flex gap-3">
          <button
            onClick={() => {
              if (role !== 'admin') setAccessDenied('Only admins can trigger DB sync');
              else alert('Simulated DB sync started');
            }}
            className="px-3 py-2 bg-indigo-600 text-white rounded"
          >
            Sync Database
          </button>

          <button
            onClick={() => {
              if (role !== 'admin') setAccessDenied('Only admins can access system hardening panel');
              else alert('Open hardening...');
            }}
            className="px-3 py-2 bg-slate-200 rounded"
          >
            Security Hardening
          </button>
        </div>
      </div>

      {accessDenied && <AccessDenied message={accessDenied} onClose={() => setAccessDenied(null)} />}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <h4 className="font-semibold mb-2">{title}</h4>
      {children}
    </div>
  );
}

// ------------------ Charts ------------------
function LineChart({ data, loading }) {
  if (loading) return <div>Loading...</div>;
  const labels = data.map((d) => d.date);
  const users = data.map((d) => d.users);
  const chartData = { labels, datasets: [{ label: 'Active Users', data: users, tension: 0.3, fill: false }] };
  return (
    <div style={{ height: 240 }}>
      <Line data={chartData} />
    </div>
  );
}

function BarChart({ data, loading }) {
  if (loading) return <div>Loading...</div>;
  const labels = data.map((d) => d.date);
  const revenue = data.map((d) => d.revenue);
  const chartData = { labels, datasets: [{ label: 'Revenue', data: revenue }] };
  return (
    <div style={{ height: 240 }}>
      <Bar data={chartData} />
    </div>
  );
}

function PieChart({ data, loading }) {
  if (loading) return <div>Loading...</div>;
  const grouped = {};
  data.forEach((d) => (grouped[d.region] = (grouped[d.region] || 0) + d.users));
  const labels = Object.keys(grouped);
  const values = Object.values(grouped);
  const chartData = { labels, datasets: [{ data: values }] };
  return (
    <div style={{ height: 240 }}>
      <Pie data={chartData} />
    </div>
  );
}

// ------------------ Modals ------------------
function AccessDenied({ message, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow max-w-sm">
        <h4 className="font-semibold text-red-600">Access Denied</h4>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-3 py-2 bg-slate-200 rounded">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
