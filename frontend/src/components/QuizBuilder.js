// NON-VIZ 2 — Quiz Builder
// Subject + difficulty + count + topics -> POST generates JSON; preview + PDF export.
import React, { useState } from 'react';

const SUBJECTS = ['Math', 'Science', 'English', 'History', 'Art'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

export default function QuizBuilder() {
  const [subject, setSubject] = useState('Math');
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount] = useState(5);
  const [topicsText, setTopicsText] = useState('fractions, decimals');
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState(null);

  const build = async () => {
    setLoading(true); setError(null); setQuiz(null);
    try {
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || '';
      const topics = topicsText.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await fetch('/api/custom-views/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ subject, difficulty, count, topics }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Request failed (${res.status}): ${txt.slice(0, 200)}`);
      }
      setQuiz(await res.json());
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const exportPdf = async () => {
    if (!quiz) return;
    setPdfLoading(true); setError(null);
    try {
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('token')) || '';
      const res = await fetch('/api/custom-views/quiz/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(quiz),
      });
      if (!res.ok) throw new Error(`PDF failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz-${subject}-${difficulty}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      setError(e.message);
    } finally { setPdfLoading(false); }
  };

  return (
    <div style={{ background: '#111827', padding: 16, borderRadius: 8, color: '#e5e7eb' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Quiz Builder</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          Subject
          <select value={subject} onChange={(e) => setSubject(e.target.value)}
            style={{ marginTop: 4, padding: '6px 10px', background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          Difficulty
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
            style={{ marginTop: 4, padding: '6px 10px', background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          Count
          <input type="number" min={1} max={50} value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 5)}
            style={{ marginTop: 4, padding: '6px 10px', background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, gridColumn: '1 / -1' }}>
          Topics (comma-separated)
          <input value={topicsText} onChange={(e) => setTopicsText(e.target.value)}
            style={{ marginTop: 4, padding: '6px 10px', background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={build} disabled={loading}
          style={{ padding: '8px 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontWeight: 600 }}
        >{loading ? 'Building…' : 'Build Quiz'}</button>
        <button
          onClick={exportPdf} disabled={!quiz || pdfLoading}
          style={{ padding: '8px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: (!quiz || pdfLoading) ? 'not-allowed' : 'pointer', opacity: (!quiz || pdfLoading) ? 0.6 : 1, fontWeight: 600 }}
        >{pdfLoading ? 'Exporting…' : 'Export PDF'}</button>
      </div>
      {error && <div style={{ marginTop: 12, background: '#7f1d1d', color: '#fecaca', padding: 8, borderRadius: 6 }}>{error}</div>}
      {quiz && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
            {quiz.count} questions · {quiz.subject} · {quiz.difficulty}
          </div>
          <ol style={{ paddingLeft: 18 }}>
            {quiz.questions.map((q) => (
              <li key={q.id} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 600 }}>{q.text}</div>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: 4 }}>
                  {q.choices.map((c, ci) => (
                    <li key={ci} style={{ color: c === q.answer ? '#34d399' : '#d1d5db', fontSize: 13 }}>
                      {String.fromCharCode(65 + ci)}) {c}{c === q.answer ? '  (answer)' : ''}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
