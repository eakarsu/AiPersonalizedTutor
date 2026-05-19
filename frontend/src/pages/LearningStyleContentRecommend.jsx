import { useState } from 'react';

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
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

const KIND_OPTIONS = [
  { v: 'video', label: 'Video' },
  { v: 'article', label: 'Article' },
  { v: 'podcast', label: 'Podcast' },
  { v: 'hands_on', label: 'Hands-on' },
  { v: 'quiz', label: 'Quiz' },
  { v: 'flashcards', label: 'Flashcards' },
  { v: 'interactive', label: 'Interactive' },
];

const STYLE_OPTIONS = [
  { v: '', label: '(use my saved style)' },
  { v: 'visual', label: 'Visual' },
  { v: 'auditory', label: 'Auditory' },
  { v: 'reading_writing', label: 'Reading / Writing' },
  { v: 'kinesthetic', label: 'Kinesthetic' },
];

export default function LearningStyleContentRecommend() {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [overrideStyle, setOverrideStyle] = useState('');
  const [selectedKinds, setSelectedKinds] = useState(KIND_OPTIONS.map(k => k.v));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const toggleKind = (k) => {
    setSelectedKinds(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }
    setLoading(true);
    try {
      const body = {
        subject: subject.trim(),
        difficulty,
        content_kinds: selectedKinds.length ? selectedKinds : KIND_OPTIONS.map(k => k.v),
      };
      if (topic.trim()) body.topic = topic.trim();
      if (overrideStyle) body.dominant_style = overrideStyle;
      const data = await apiFetch('/ai/learning-style-content-recommend', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setResult(data);
    } catch (err) {
      if (err.status === 503) {
        setError('AI not configured: please set OPENROUTER_API_KEY on the server.');
      } else {
        setError(err.message || 'Failed to get recommendations');
      }
    } finally {
      setLoading(false);
    }
  };

  const recommendations = result?.parsed?.recommendations || [];
  const studyPlan = result?.parsed?.study_plan || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Learning-Style Content Recommendations</h1>
        <p className="text-gray-500">
          Get content (videos, articles, hands-on, quizzes) tailored to your VARK learning style.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Algebra II, World History"
                className="w-full px-4 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic (optional)</label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. quadratic equations"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Override learning style (optional)
              </label>
              <select
                value={overrideStyle}
                onChange={e => setOverrideStyle(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                {STYLE_OPTIONS.map(s => (
                  <option key={s.v} value={s.v}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content kinds</label>
              <div className="flex flex-wrap gap-2">
                {KIND_OPTIONS.map(k => (
                  <button
                    key={k.v}
                    type="button"
                    onClick={() => toggleKind(k.v)}
                    className={`px-3 py-1 text-sm rounded-full border ${
                      selectedKinds.includes(k.v)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-700 border-gray-300'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !subject.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Recommending…' : 'Get Recommendations'}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-500">
              <strong>Subject:</strong> {result.subject}
              {result.topic ? <> &nbsp;<strong>Topic:</strong> {result.topic}</> : null}
              &nbsp;<strong>Style:</strong> {result.dominant_style}
            </p>
            {result.parsed?.rationale && (
              <p className="mt-2"><strong>Why these picks:</strong> {result.parsed.rationale}</p>
            )}
          </div>

          {recommendations.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold mb-3">Recommendations</h3>
              <div className="space-y-3">
                {recommendations.map((r, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full">{r.kind}</span>
                      {r.difficulty && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">{r.difficulty}</span>
                      )}
                      {typeof r.estimated_time_minutes === 'number' && (
                        <span className="text-xs text-gray-500">{r.estimated_time_minutes} min</span>
                      )}
                    </div>
                    <p className="font-medium">{r.title}</p>
                    {r.why_it_fits_style && (
                      <p className="text-sm text-gray-600 mt-1">{r.why_it_fits_style}</p>
                    )}
                    {r.url_or_search_query && (
                      <p className="text-sm mt-2">
                        <strong>Find it:</strong>{' '}
                        {/^https?:\/\//.test(r.url_or_search_query) ? (
                          <a className="text-blue-600 hover:underline" href={r.url_or_search_query} target="_blank" rel="noreferrer">
                            {r.url_or_search_query}
                          </a>
                        ) : (
                          <span className="text-gray-700">{r.url_or_search_query}</span>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {studyPlan.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold mb-3">Study Plan</h3>
              <ol className="list-decimal pl-5 space-y-1">
                {studyPlan.map((s, i) => (
                  <li key={i}>
                    {s.action}
                    {typeof s.duration_minutes === 'number' && (
                      <span className="text-xs text-gray-500"> &mdash; {s.duration_minutes} min</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {!result.parsed && result.raw && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold mb-2">AI Output</h3>
              <pre className="whitespace-pre-wrap text-sm">{result.raw}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
