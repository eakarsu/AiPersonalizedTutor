// Tutor Views — combines the 4 custom views (2 viz + 2 non-viz).
import React, { useState } from 'react';
import LearningProgress from '../components/LearningProgress.js';
import SkillRadar from '../components/SkillRadar.js';
import LessonPlanPDF from '../components/LessonPlanPDF.js';
import QuizBuilder from '../components/QuizBuilder.js';

const TABS = [
  { id: 'progress', label: 'Learning Progress', component: LearningProgress },
  { id: 'radar', label: 'Skill Radar', component: SkillRadar },
  { id: 'lesson', label: 'Lesson Plan PDF', component: LessonPlanPDF },
  { id: 'quiz', label: 'Quiz Builder', component: QuizBuilder },
];

export default function CustomViewsPage() {
  const [active, setActive] = useState('progress');
  const Active = (TABS.find((t) => t.id === active) || TABS[0]).component;
  return (
    <div style={{ padding: 24, color: '#e5e7eb', background: '#0b1220', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Tutor Views</h1>
      <p style={{ color: '#9ca3af', marginBottom: 16 }}>
        Custom views for adaptive learning: progress charts, skill radar, lesson plan PDFs, and a quiz builder.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{
              padding: '8px 14px',
              background: active === t.id ? '#6366f1' : '#1f2937',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >{t.label}</button>
        ))}
      </div>
      <Active />
    </div>
  );
}
