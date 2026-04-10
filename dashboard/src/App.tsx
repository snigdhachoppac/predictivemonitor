import { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import axios from 'axios';

const API = 'http://localhost:8000';

function generateMockMetric(t: number, failureMode: boolean) {
  
  const base = {
    timestamp: new Date().toISOString(),
    risk_score: failureMode ? Math.min(95, 60 + Math.random() * 30) : Math.max(5, 20 + Math.random() * 25),
    is_anomaly: failureMode ? 1 : 0,
    cpu: failureMode ? 65 + Math.random() * 25 : 25 + Math.random() * 20,
    memory: failureMode ? 70 + Math.random() * 20 : 40 + Math.random() * 15,
    latency: failureMode ? 300 + Math.random() * 200 : 80 + Math.random() * 60,
    error_rate: failureMode ? 0.06 + Math.random() * 0.04 : 0.005 + Math.random() * 0.01,
  };
  return {
    ...base,
    risk_score: Math.round(base.risk_score),
    cpu: Math.round(base.cpu * 10) / 10,
    memory: Math.round(base.memory * 10) / 10,
    latency: Math.round(base.latency * 10) / 10,
    error_rate: Math.round(base.error_rate * 1000) / 1000,
    time: new Date().toISOString().slice(11, 19),
  };
}

const MOCK_SHAP = {
  'CPU': 0.0842,
  'Memory': 0.0631,
  'Latency': 0.1204,
  'Error Rate': 0.0956,
  'DB Connections': 0.0423,
  'Requests/s': -0.0312,
};

const MOCK_ALERTS = [
  { timestamp: new Date(Date.now() - 120000).toISOString(), risk_score: 78, cpu: 82.3, latency: 412, error_rate: 0.089, shap: MOCK_SHAP },
  { timestamp: new Date(Date.now() - 240000).toISOString(), risk_score: 71, cpu: 76.1, latency: 389, error_rate: 0.072, shap: MOCK_SHAP },
  { timestamp: new Date(Date.now() - 360000).toISOString(), risk_score: 85, cpu: 91.2, latency: 501, error_rate: 0.103, shap: MOCK_SHAP },
];

export default function App() {
  const [latest, setLatest] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [shap, setShap] = useState<any>(MOCK_SHAP);
  const [alerts, setAlerts] = useState<any[]>(MOCK_ALERTS);
  const [runbook, setRunbook] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const tickRef = useRef(0);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [p, h, s, a] = await Promise.all([
          axios.get(`${API}/prediction`, { timeout: 2000 }),
          axios.get(`${API}/history`, { timeout: 2000 }),
          axios.get(`${API}/shap`, { timeout: 2000 }),
          axios.get(`${API}/alerts`, { timeout: 2000 }),
        ]);
        setDemoMode(false);
        setLatest(p.data);
        setHistory([...h.data].reverse().map((d: any) => ({ ...d, time: d.timestamp?.slice(11, 19) })));
        if (!s.data.error) setShap(s.data);
        setAlerts(a.data);
      } catch {
        setDemoMode(true);
        tickRef.current += 1;
        const failureMode = tickRef.current % 60 > 30;
        const mock = generateMockMetric(tickRef.current, failureMode);
        setLatest(mock);
        setHistory(prev => {
          const next = [...prev, mock].slice(-50);
          return next;
        });
        if (failureMode && Math.random() > 0.85) {
          setAlerts(prev => [{
            timestamp: mock.timestamp,
            risk_score: mock.risk_score,
            cpu: mock.cpu,
            latency: mock.latency,
            error_rate: mock.error_rate,
            shap: MOCK_SHAP
          }, ...prev].slice(0, 10));
        }
      }
    };
    fetchAll();
    const t = setInterval(fetchAll, 2000);
    return () => clearInterval(t);
  }, []);

  const getRunbook = async () => {
    setLoading(true);
    if (demoMode) {
      setTimeout(() => {
        setRunbook(`Root Cause: Elevated CPU usage (${latest?.cpu}%) combined with increased latency (${latest?.latency}ms) suggests resource contention, likely caused by a memory leak or runaway process consuming system resources.

Immediate Actions:
- Check running processes with top/htop and identify any processes consuming abnormal CPU
- Review recent deployments in the last 30 minutes for configuration changes
- Inspect application logs for OOM errors or exception spikes

Escalation Threshold: Escalate immediately if CPU exceeds 90%, latency surpasses 500ms, or error rate climbs above 10% within the next 15 minutes.`);
        setLoading(false);
      }, 1500);
      return;
    }
    try {
      const r = await axios.get(`${API}/runbook`);
      setRunbook(r.data.runbook);
    } catch { setRunbook('Error fetching runbook.'); }
    setLoading(false);
  };

  if (!latest) return (
    <div style={{ color: 'white', background: '#111827', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
      Loading...
    </div>
  );

  const risk = latest.risk_score;
  const riskColor = risk > 70 ? '#ef4444' : risk > 40 ? '#f59e0b' : '#22c55e';
  const card = { background: '#1f2937', borderRadius: '16px', padding: '24px', marginBottom: '24px' };

  const shapChartData = shap ? Object.entries(shap).map(([k, v]: any) => ({
    feature: k, value: Math.abs(v), raw: v,
  })).sort((a, b) => b.value - a.value) : [];

  return (
    <div style={{ background: '#111827', minHeight: '100vh', padding: '24px', fontFamily: 'sans-serif', color: 'white' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '24px', margin: 0 }}>🔮 Predictive System Monitor</h1>
          {demoMode && <span style={{ background: '#374151', color: '#9ca3af', padding: '4px 12px', borderRadius: '999px', fontSize: '12px' }}>⚡ Demo Mode</span>}
        </div>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>AI-powered failure detection · updates every 2s</p>

        <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ ...card, textAlign: 'center', minWidth: '200px', marginBottom: 0 }}>
            <div style={{ fontSize: '64px', fontWeight: 'bold', color: riskColor }}>{risk}%</div>
            <div style={{ color: '#9ca3af', marginBottom: '8px' }}>Risk Score</div>
            <div style={{ padding: '4px 16px', borderRadius: '999px', background: riskColor, display: 'inline-block', fontWeight: 'bold' }}>
              {risk > 70 ? '🚨 CRITICAL' : risk > 40 ? '⚠️ WARNING' : '✅ HEALTHY'}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1 }}>
            {[['CPU Usage', latest.cpu, '%'], ['Memory', latest.memory, '%'], ['Latency', latest.latency, 'ms'], ['Error Rate', latest.error_rate, '']].map(([l, v, u]) => (
              <div key={String(l)} style={{ background: '#1f2937', borderRadius: '12px', padding: '16px' }}>
                <div style={{ color: '#9ca3af', fontSize: '13px' }}>{l}</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{v}<span style={{ fontSize: '14px', color: '#6b7280' }}> {u}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <h2 style={{ fontSize: '16px', margin: '0 0 16px' }}>Risk Score Over Time</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 11 }} interval={9} />
              <YAxis stroke="#6b7280" domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#111827', border: 'none', color: 'white' }} />
              <Line type="monotone" dataKey="risk_score" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div style={{ ...card, marginBottom: 0 }}>
            <h2 style={{ fontSize: '16px', margin: '0 0 4px' }}>🧠 Feature Importance (SHAP)</h2>
            <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 16px' }}>Why the model flagged this anomaly</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={shapChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="feature" stroke="#6b7280" tick={{ fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ background: '#111827', border: 'none', color: 'white' }} formatter={(v: any) => v.toFixed(4)} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {shapChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.raw > 0 ? '#ef4444' : '#22c55e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ ...card, marginBottom: 0 }}>
            <h2 style={{ fontSize: '16px', margin: '0 0 16px' }}>CPU & Latency Trends</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 11 }} interval={9} />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ background: '#111827', border: 'none', color: 'white' }} />
                <Line type="monotone" dataKey="cpu" stroke="#22c55e" strokeWidth={2} dot={false} name="CPU %" />
                <Line type="monotone" dataKey="latency" stroke="#f59e0b" strokeWidth={2} dot={false} name="Latency ms" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={card}>
          <h2 style={{ fontSize: '16px', margin: '0 0 16px' }}>🚨 Alert History</h2>
          {alerts.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ color: '#6b7280', borderBottom: '1px solid #374151' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0' }}>Time</th>
                  <th style={{ textAlign: 'left', padding: '8px 0' }}>Risk</th>
                  <th style={{ textAlign: 'left', padding: '8px 0' }}>CPU</th>
                  <th style={{ textAlign: 'left', padding: '8px 0' }}>Latency</th>
                  <th style={{ textAlign: 'left', padding: '8px 0' }}>Error Rate</th>
                  <th style={{ textAlign: 'left', padding: '8px 0' }}>Top Factor</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a, i) => {
                  const topFactor = a.shap ? Object.entries(a.shap).sort((x: any, y: any) => Math.abs(y[1]) - Math.abs(x[1]))[0] : null;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
                      <td style={{ padding: '8px 0', color: '#9ca3af' }}>{a.timestamp?.slice(11, 19)}</td>
                      <td style={{ padding: '8px 0' }}><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{a.risk_score}%</span></td>
                      <td style={{ padding: '8px 0' }}>{a.cpu}%</td>
                      <td style={{ padding: '8px 0' }}>{a.latency}ms</td>
                      <td style={{ padding: '8px 0' }}>{a.error_rate}</td>
                      <td style={{ padding: '8px 0', color: '#f59e0b' }}>{topFactor ? String(topFactor[0]) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p style={{ color: '#6b7280', margin: 0 }}>No alerts yet.</p>}
        </div>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', margin: '0 0 4px' }}>🤖 AI Runbook Suggestions</h2>
              <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>Powered by Claude · analyzes current metrics</p>
            </div>
            <button onClick={getRunbook} disabled={loading} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Analyzing...' : 'Generate Runbook'}
            </button>
          </div>
          {runbook
            ? <pre style={{ color: '#d1d5db', fontSize: '14px', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0, background: '#111827', padding: '16px', borderRadius: '8px' }}>{runbook}</pre>
            : <p style={{ color: '#6b7280', margin: 0 }}>Click "Generate Runbook" to get AI-powered remediation steps.</p>}
        </div>
      </div>
    </div>
  );
}
