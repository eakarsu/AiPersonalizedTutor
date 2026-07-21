import React, { useEffect, useState } from 'react';

// Apply pass 5 — backlog tools page (parent dashboard, LMS, push, voice, plan).

async function call(path, opts = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch((import.meta.env?.VITE_API_URL || '/api') + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  let body = null;
  try { body = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, body };
}

export default function IntegrationsAndParent() {
  const [tab, setTab] = useState('parent');
  const [studentId, setStudentId] = useState('');
  const [insights, setInsights] = useState(null);
  const [probe, setProbe] = useState(null);
  const [planSubject, setPlanSubject] = useState('algebra');
  const [planResult, setPlanResult] = useState(null);
  const [pushPlatform, setPushPlatform] = useState('ios');
  const [pushTokenVal, setPushTokenVal] = useState('');

  const linkChild = async () => {
    const r = await call('/parent/link', { method: 'POST', body: JSON.stringify({ student_user_id: parseInt(studentId, 10) }) });
    setProbe(r);
  };
  const loadInsights = async () => {
    const r = await call('/parent/insights');
    setInsights(r);
  };
  const probeCanvas = async () => setProbe(await call('/lms/canvas/link', { method: 'POST', body: '{}' }));
  const probeSchoology = async () => setProbe(await call('/lms/schoology/link', { method: 'POST', body: '{}' }));
  const registerPush = async () => setProbe(await call('/push/register', {
    method: 'POST',
    body: JSON.stringify({ platform: pushPlatform, token: pushTokenVal }),
  }));
  const probePush = async () => setProbe(await call('/push/notify', { method: 'POST', body: '{}' }));
  const startVoice = async () => setProbe(await call('/ai/voice/session-start', { method: 'POST', body: '{}' }));
  const runPlan = async () => {
    const r = await call('/ai/study-plan-week', { method: 'POST', body: JSON.stringify({ subject: planSubject, goal_minutes_per_day: 30 }) });
    setPlanResult(r);
  };

  useEffect(() => { loadInsights(); }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Backlog tools</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        {['parent', 'lms', 'push', 'voice', 'plan'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1 rounded ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{t}</button>
        ))}
      </div>

      {tab === 'parent' && (
        <div className="space-y-3">
          <h2 className="font-semibold">Parent dashboard (default scope: summary)</h2>
          <div className="flex gap-2">
            <input className="border p-2 rounded" placeholder="student_user_id"
              value={studentId} onChange={(e) => setStudentId(e.target.value)} />
            <button onClick={linkChild} className="bg-blue-600 text-white px-4 py-2 rounded">Link student</button>
            <button onClick={loadInsights} className="bg-gray-700 text-white px-4 py-2 rounded">Refresh insights</button>
          </div>
          <pre className="bg-gray-900 text-green-200 p-4 rounded overflow-auto max-h-96">{JSON.stringify(insights?.body || insights, null, 2)}</pre>
        </div>
      )}

      {tab === 'lms' && (
        <div className="space-y-3">
          <h2 className="font-semibold">LMS integrations (NEEDS-CREDS)</h2>
          <button onClick={probeCanvas} className="bg-blue-600 text-white px-4 py-2 rounded">Probe Canvas</button>
          <button onClick={probeSchoology} className="bg-blue-600 text-white px-4 py-2 rounded ml-2">Probe Schoology</button>
        </div>
      )}

      {tab === 'push' && (
        <div className="space-y-3">
          <h2 className="font-semibold">Mobile push (NEEDS-CREDS)</h2>
          <select className="border p-2 rounded" value={pushPlatform} onChange={(e) => setPushPlatform(e.target.value)}>
            <option value="ios">iOS</option>
            <option value="android">Android</option>
          </select>
          <input className="border p-2 rounded ml-2" placeholder="device token"
            value={pushTokenVal} onChange={(e) => setPushTokenVal(e.target.value)} />
          <button onClick={registerPush} className="bg-blue-600 text-white px-4 py-2 rounded ml-2">Register</button>
          <button onClick={probePush} className="bg-gray-700 text-white px-4 py-2 rounded ml-2">Probe notify</button>
        </div>
      )}

      {tab === 'voice' && (
        <div className="space-y-3">
          <h2 className="font-semibold">Voice tutor (PRODUCT-DECISION + NEEDS-CREDS)</h2>
          <button onClick={startVoice} className="bg-blue-600 text-white px-4 py-2 rounded">Start session</button>
        </div>
      )}

      {tab === 'plan' && (
        <div className="space-y-3">
          <h2 className="font-semibold">Weekly AI study plan (MECHANICAL)</h2>
          <input className="border p-2 rounded" placeholder="subject"
            value={planSubject} onChange={(e) => setPlanSubject(e.target.value)} />
          <button onClick={runPlan} className="bg-blue-600 text-white px-4 py-2 rounded ml-2">Generate plan</button>
          <pre className="bg-gray-900 text-green-200 p-4 rounded overflow-auto max-h-96">{JSON.stringify(planResult?.body || planResult, null, 2)}</pre>
        </div>
      )}

      {tab !== 'parent' && tab !== 'plan' && (
        <pre className="bg-gray-900 text-green-200 p-4 rounded overflow-auto max-h-96 mt-4">{JSON.stringify(probe?.body || probe, null, 2)}</pre>
      )}
    </div>
  );
}
