import { useEffect, useState } from 'react';

const API_URL = '/api';
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function ParentDashboard() {
  const [students, setStudents] = useState([]);
  const [linkEmail, setLinkEmail] = useState('');
  const [relationship, setRelationship] = useState('parent');
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(null);
  const [letter, setLetter] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const refresh = async () => {
    try {
      const r = await apiFetch('/parent-dashboard/students');
      setStudents(r.students || []);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { refresh(); }, []);

  const link = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await apiFetch('/parent-dashboard/link', {
        method: 'POST',
        body: JSON.stringify({ studentEmail: linkEmail, relationship }),
      });
      setLinkEmail('');
      await refresh();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const select = async (s) => {
    setSelected(s);
    setSummary(null);
    setLetter(null);
    try {
      const r = await apiFetch(`/parent-dashboard/student/${s.id}/summary`);
      setSummary(r);
    } catch (e) { setErr(e.message); }
  };

  const generateLetter = async () => {
    if (!selected) return;
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch(`/parent-dashboard/student/${selected.id}/weekly-letter`, { method: 'POST' });
      setLetter(r.letter);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parent / Teacher Dashboard</h1>
        <p className="text-gray-500 text-sm">Read-only view of linked students, plus AI-generated weekly progress letters.</p>
      </div>

      {err && <div className="text-red-600 bg-red-50 p-2 rounded">{err}</div>}

      <form onSubmit={link} className="border p-4 rounded space-y-2">
        <h2 className="font-semibold">Link a student</h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={linkEmail}
            onChange={(e) => setLinkEmail(e.target.value)}
            placeholder="student@email.com"
            className="border p-2 rounded flex-1"
            required
          />
          <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className="border p-2 rounded">
            <option value="parent">Parent</option>
            <option value="teacher">Teacher</option>
            <option value="tutor">Tutor</option>
          </select>
          <button disabled={busy} className="bg-blue-600 text-white px-4 rounded">Link</button>
        </div>
      </form>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="border rounded p-3">
          <h2 className="font-semibold mb-2">Students ({students.length})</h2>
          <ul className="text-sm space-y-1">
            {students.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => select(s)}
                  className={`w-full text-left px-2 py-1 rounded ${selected?.id === s.id ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
                >
                  {s.full_name} <span className="text-xs text-gray-500">({s.relationship})</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-2 border rounded p-3">
          {!selected && <div className="text-gray-500 text-sm">Select a student to view their summary.</div>}
          {selected && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">{selected.full_name}'s 30-day summary</h2>
                <button onClick={generateLetter} disabled={busy} className="bg-emerald-600 text-white px-3 py-1 rounded text-sm">
                  {busy ? '…' : 'Generate weekly letter'}
                </button>
              </div>
              {summary && (
                <div className="grid grid-cols-2 gap-3 text-center text-sm">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-xs text-gray-500">Quizzes</div>
                    <div className="text-xl font-bold">{summary.quizzes?.attempts || 0}</div>
                    <div className="text-xs">avg {summary.quizzes?.avg_score ? Number(summary.quizzes.avg_score).toFixed(1) : '0'}</div>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded">
                    <div className="text-xs text-gray-500">Study minutes</div>
                    <div className="text-xl font-bold">{summary.study?.minutes_30d || 0}</div>
                  </div>
                  <div className="bg-amber-50 p-3 rounded">
                    <div className="text-xs text-gray-500">Essays</div>
                    <div className="text-xl font-bold">{summary.essays?.essays_30d || 0}</div>
                    <div className="text-xs">avg {summary.essays?.avg_essay_score ? Number(summary.essays.avg_essay_score).toFixed(1) : '0'}</div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded">
                    <div className="text-xs text-gray-500">SR cards</div>
                    <div className="text-xl font-bold">{summary.spacedRepetition?.due || 0}</div>
                  </div>
                </div>
              )}

              {letter && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold mb-2">Weekly progress letter</h3>
                  <div
                    className="prose max-w-none text-sm bg-gray-50 p-3 rounded"
                    dangerouslySetInnerHTML={{ __html: letter.letter_html }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
