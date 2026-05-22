// VIZ 2 — Skill Radar
// Recharts RadarChart of student skills vs target.
import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Legend, Tooltip,
} from 'recharts';

export default function SkillRadar() {
  const [student, setStudent] = useState('Demo Student');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || '';
      const res = await fetch(`/api/custom-views/skill-radar?student=${encodeURIComponent(student)}`, {
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
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Skill Radar — Current vs Target</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={student}
          onChange={(e) => setStudent(e.target.value)}
          placeholder="Student name"
          style={{ padding: '6px 10px', background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}
        />
        <button
          onClick={load} disabled={loading}
          style={{ padding: '6px 14px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
        >{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      {error && <div style={{ background: '#7f1d1d', color: '#fecaca', padding: 8, borderRadius: 6, marginBottom: 8 }}>{error}</div>}
      {data && (
        <div style={{ width: '100%', height: 380 }}>
          <ResponsiveContainer>
            <RadarChart data={data.data} outerRadius="75%">
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="skill" stroke="#e5e7eb" />
              <PolarRadiusAxis domain={[0, 100]} stroke="#9ca3af" />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
              <Radar name="Current" dataKey="current" stroke="#6366f1" fill="#6366f1" fillOpacity={0.45} />
              <Radar name="Target" dataKey="target" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
