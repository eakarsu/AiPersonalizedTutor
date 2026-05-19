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

export default function AdaptiveQuiz() {
  const [subject, setSubject] = useState('Mathematics');
  const [topic, setTopic] = useState('Algebra');
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    try {
      const res = await apiFetch('/adaptive-quiz/confidence?page=1&limit=10');
      setHistory(res.data || []);
    } catch (e) {}
  };
  useEffect(() => { loadHistory(); }, []);

  const next = async () => {
    setErr(null);
    setFeedback(null);
    setAnswer('');
    setLoading(true);
    try {
      const res = await apiFetch('/adaptive-quiz/next', {
        method: 'POST',
        body: JSON.stringify({ subject, topic }),
      });
      setQuestion(res.question);
      setConfidence(res.confidence);
      setDifficulty(res.difficulty);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!question || !answer) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetch('/adaptive-quiz/answer', {
        method: 'POST',
        body: JSON.stringify({ questionId: question.id, userAnswer: answer }),
      });
      setFeedback(res);
      setConfidence(res.confidence);
      await loadHistory();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const opts = (() => {
    try { return Array.isArray(question?.options) ? question.options : JSON.parse(question?.options || '[]'); }
    catch { return []; }
  })();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Adaptive Quiz</h1>
        <p className="text-gray-500 text-sm">
          Difficulty automatically adjusts to your per-topic confidence (0–100). Get a question right to nudge it harder.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          className="border p-2 rounded flex-1"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
        />
        <input
          className="border p-2 rounded flex-1"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic"
        />
        <button onClick={next} disabled={loading} className="bg-blue-600 text-white px-4 rounded">
          {loading ? '…' : 'New question'}
        </button>
      </div>

      {confidence != null && (
        <div className="text-xs text-gray-600">
          Confidence in {subject} / {topic}:{' '}
          <strong>{confidence.toFixed(1)}/100</strong>
          {difficulty && <> · Difficulty: <strong>{difficulty}</strong></>}
        </div>
      )}

      {err && <div className="text-red-600 bg-red-50 p-2 rounded">{err}</div>}

      {question && (
        <div className="border rounded p-4 space-y-3 bg-white">
          <div className="font-medium">{question.question_text}</div>
          {opts.length > 0 ? (
            <div className="grid gap-2">
              {opts.map((opt, i) => (
                <label key={i} className="flex items-center gap-2 border rounded px-3 py-2 cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="opt"
                    value={String.fromCharCode(65 + i)}
                    checked={answer === String.fromCharCode(65 + i)}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                  <span>{String.fromCharCode(65 + i)}. {opt}</span>
                </label>
              ))}
            </div>
          ) : (
            <input
              className="border p-2 rounded w-full"
              placeholder="Your answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          )}
          <button
            onClick={submit}
            disabled={loading || !answer}
            className="bg-emerald-600 text-white px-4 py-2 rounded"
          >
            Submit
          </button>

          {feedback && (
            <div className={`p-3 rounded ${feedback.correct ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              <div className="font-semibold">{feedback.correct ? 'Correct' : 'Not quite'}</div>
              {feedback.explanation && <div className="text-sm mt-1">{feedback.explanation}</div>}
            </div>
          )}
        </div>
      )}

      <div className="border-t pt-4">
        <h2 className="font-semibold mb-2">Recent topics</h2>
        <ul className="text-sm space-y-1">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between">
              <span>{h.subject} · {h.topic}</span>
              <span className="text-gray-500">{Number(h.confidence).toFixed(0)}/100</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
