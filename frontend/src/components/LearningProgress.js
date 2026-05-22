// VIZ 1 — Learning Progress Chart
// Recharts AreaChart of student mastery % per subject over time.
import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export default function LearningProgress() {
  const [student, setStudent] = useState('Demo Student');
  const [weeks, setWeeks] = useState(12);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || '';
      const res = await fetch(`/api/custom-views/learning-progress?student=${encodeURIComponent(student)}&weeks=${weeks}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ background: '#111827', padding: 16, borderRadius: 8, color: '#e5e7eb' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Learning Progress Over Time</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={student}
          onChange={(e) => setStudent(e.target.value)}
          placeholder="Student name"
          style={{ padding: '6px 10px', background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}
        />
        <input
          type="number" min={4} max={24}
          value={weeks}
          onChange={(e) => setWeeks(parseInt(e.target.value, 10) || 12)}
          style={{ padding: '6px 10px', width: 80, background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}
        />
        <button
          onClick={load} disabled={loading}
          style={{ padding: '6px 14px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
        >{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      {error && <div style={{ background: '#7f1d1d', color: '#fecaca', padding: 8, borderRadius: 6, marginBottom: 8 }}>{error}</div>}
      {data && (
        <div style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer>
            <AreaChart data={data.series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="week" stroke="#9ca3af" />
              <YAxis domain={[0, 100]} stroke="#9ca3af" />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
              <Legend />
              {data.subjects.map((s, i) => (
                <Area
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stackId={undefined}
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.25}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
