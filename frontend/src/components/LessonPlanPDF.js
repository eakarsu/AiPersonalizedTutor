// NON-VIZ 1 — Lesson Plan PDF generator
// Student + subject + duration -> backend pdfkit produces PDF download.
import React, { useState } from 'react';

const SUBJECTS = ['Math', 'Science', 'English', 'History', 'Art', 'Computer Science'];

export default function LessonPlanPDF() {
  const [student, setStudent] = useState('Demo Student');
  const [subject, setSubject] = useState('Math');
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUrl, setLastUrl] = useState(null);

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || '';
      const res = await fetch('/api/custom-views/lesson-plan-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ student, subject, duration }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Request failed (${res.status}): ${txt.slice(0, 200)}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setLastUrl(url);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lesson-plan-${student.replace(/\s+/g, '_')}-${subject}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ background: '#111827', padding: 16, borderRadius: 8, color: '#e5e7eb' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Lesson Plan (PDF)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          Student
          <input
            value={student}
            onChange={(e) => setStudent(e.target.value)}
            style={{ marginTop: 4, padding: '6px 10px', background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          Subject
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ marginTop: 4, padding: '6px 10px', background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}
          >
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          Duration (min)
          <input
            type="number" min={15} max={240}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10) || 60)}
            style={{ marginTop: 4, padding: '6px 10px', background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}
          />
        </label>
      </div>
      <button
        onClick={generate}
        disabled={loading || !student.trim()}
        style={{ padding: '8px 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontWeight: 600 }}
      >{loading ? 'Generating…' : 'Generate PDF'}</button>
      {error && <div style={{ marginTop: 12, background: '#7f1d1d', color: '#fecaca', padding: 8, borderRadius: 6 }}>{error}</div>}
      {lastUrl && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#9ca3af' }}>
          PDF downloaded. <a href={lastUrl} target="_blank" rel="noreferrer" style={{ color: '#a5b4fc' }}>Open again</a>
        </div>
      )}
    </div>
  );
}
