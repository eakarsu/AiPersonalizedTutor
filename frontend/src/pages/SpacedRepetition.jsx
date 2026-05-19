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

const QUALITY_LABELS = [
  { v: 0, label: 'Blank', color: 'bg-red-600' },
  { v: 1, label: 'Wrong', color: 'bg-red-500' },
  { v: 2, label: 'Hard wrong', color: 'bg-orange-500' },
  { v: 3, label: 'Hard right', color: 'bg-yellow-500' },
  { v: 4, label: 'Good', color: 'bg-emerald-500' },
  { v: 5, label: 'Easy', color: 'bg-green-600' },
];

export default function SpacedRepetition() {
  const [due, setDue] = useState([]);
  const [stats, setStats] = useState(null);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        apiFetch('/spaced-repetition/due?limit=30'),
        apiFetch('/spaced-repetition/stats'),
      ]);
      setDue(d.due || []);
      setStats(s);
      setIdx(0);
      setShowBack(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grade = async (q) => {
    const card = due[idx];
    if (!card) return;
    setSubmitting(true);
    try {
      await apiFetch('/spaced-repetition/review', {
        method: 'POST',
        body: JSON.stringify({ flashcardId: card.flashcard_id, quality: q }),
      });
      setShowBack(false);
      if (idx + 1 >= due.length) {
        await load();
      } else {
        setIdx(idx + 1);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8">Loading…</div>;

  const card = due[idx];
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Spaced Repetition (SM-2)</h1>
        <p className="text-gray-500 text-sm">Review at the optimal moment for long-term retention.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded bg-blue-50">
            <div className="text-xs text-gray-500">Due now</div>
            <div className="text-2xl font-bold">{stats.due_now}</div>
          </div>
          <div className="p-3 rounded bg-emerald-50">
            <div className="text-xs text-gray-500">Due in 24h</div>
            <div className="text-2xl font-bold">{stats.due_24h}</div>
          </div>
          <div className="p-3 rounded bg-purple-50">
            <div className="text-xs text-gray-500">Avg ease</div>
            <div className="text-2xl font-bold">{stats.avg_ease ? stats.avg_ease.toFixed(2) : '—'}</div>
          </div>
        </div>
      )}

      {error && <div className="text-red-600 bg-red-50 p-2 rounded">{error}</div>}

      {!card && (
        <div className="text-center p-6 bg-gray-50 rounded">
          No cards due — come back later.
        </div>
      )}

      {card && (
        <div className="border rounded-lg p-6 bg-white shadow space-y-4">
          <div className="text-xs text-gray-500">{card.deck_title} · Card {idx + 1} of {due.length}</div>
          <div className="text-xl font-medium min-h-24">{card.front_text}</div>
          {showBack ? (
            <div className="border-t pt-3">
              <div className="text-xs text-gray-500 mb-1">Answer</div>
              <div className="text-gray-800">{card.back_text}</div>
            </div>
          ) : (
            <button
              onClick={() => setShowBack(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded w-full"
            >
              Show answer
            </button>
          )}

          {showBack && (
            <div className="grid grid-cols-3 gap-2">
              {QUALITY_LABELS.map((q) => (
                <button
                  key={q.v}
                  disabled={submitting}
                  onClick={() => grade(q.v)}
                  className={`${q.color} text-white text-sm py-2 rounded`}
                >
                  {q.v} · {q.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
