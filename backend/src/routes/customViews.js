// Custom Views — 4 endpoints for AI Personalized Tutor
// 2 viz (progress chart, skill radar) + 2 non-viz (lesson plan PDF, quiz builder)
// Mounted at /api/custom-views by src/index.js

const express = require('express');
const router = express.Router();

let PDFDocument = null;
try { PDFDocument = require('pdfkit'); } catch (_) { PDFDocument = null; }

// ---------- helpers ----------
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function rand(seed, lo, hi) {
  const x = Math.sin(seed) * 10000;
  const f = x - Math.floor(x);
  return lo + f * (hi - lo);
}

// ---------- VIZ 1: Learning Progress ----------
// GET /api/custom-views/learning-progress?student=Alex&weeks=12
router.get('/learning-progress', (req, res) => {
  try {
    const student = String(req.query.student || 'Demo Student');
    const weeks = Math.max(4, Math.min(24, parseInt(req.query.weeks, 10) || 12));
    const subjects = ['Math', 'Science', 'English', 'History'];
    const seed = hash(student);

    const series = [];
    for (let w = 0; w < weeks; w++) {
      const row = { week: `W${w + 1}` };
      subjects.forEach((subj, idx) => {
        const base = 40 + ((seed + idx * 7) % 25);
        const growth = (w / weeks) * (25 + ((seed + idx * 11) % 20));
        const noise = rand(seed + w * 13 + idx * 31, -3, 3);
        row[subj] = Math.max(0, Math.min(100, Math.round(base + growth + noise)));
      });
      series.push(row);
    }

    res.json({
      student,
      weeks,
      subjects,
      series,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- VIZ 2: Skill Radar ----------
// GET /api/custom-views/skill-radar?student=Alex
router.get('/skill-radar', (req, res) => {
  try {
    const student = String(req.query.student || 'Demo Student');
    const skills = [
      'Reading', 'Writing', 'Math', 'Science',
      'Critical Thinking', 'Collaboration', 'Problem Solving'
    ];
    const seed = hash(student);
    const data = skills.map((skill, i) => {
      const target = 85 + ((seed + i * 13) % 10); // 85-94
      const current = 45 + ((seed + i * 29) % 45); // 45-89
      return {
        skill,
        current: Math.min(target, current),
        target,
        fullMark: 100,
      };
    });
    res.json({ student, skills, data, generatedAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- NON-VIZ 1: Lesson Plan PDF ----------
// POST /api/custom-views/lesson-plan-pdf  { student, subject, duration }
router.post('/lesson-plan-pdf', (req, res) => {
  try {
    if (!PDFDocument) {
      return res.status(500).json({ error: 'pdfkit not installed' });
    }
    const { student = 'Student', subject = 'Math', duration = 60 } = req.body || {};
    const mins = Math.max(15, Math.min(240, parseInt(duration, 10) || 60));

    const objectives = [
      `Understand core ${subject} concepts at age-appropriate level`,
      `Apply ${subject} knowledge to solve 3 practice problems`,
      `Identify and articulate 2 personal learning gaps in ${subject}`,
      `Reflect on progress and set next-session goal`,
    ];
    const materials = [
      `${subject} workbook (pp. 12-18)`,
      'Tablet or laptop with AI Tutor app',
      'Notebook + pencil for working out problems',
      'Printed quiz handout (auto-generated)',
    ];
    const warmup = Math.round(mins * 0.15);
    const instruction = Math.round(mins * 0.30);
    const practice = Math.round(mins * 0.30);
    const assessment = Math.round(mins * 0.15);
    const reflect = mins - warmup - instruction - practice - assessment;
    const activities = [
      { name: 'Warm-up & review of last session', minutes: warmup },
      { name: `Guided ${subject} instruction with AI tutor`, minutes: instruction },
      { name: 'Independent practice problems', minutes: practice },
      { name: 'Adaptive quiz (auto-graded)', minutes: assessment },
      { name: 'Reflection + next-session goal', minutes: reflect },
    ];

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="lesson-plan-${student.replace(/\s+/g, '_')}-${subject}.pdf"`
    );
    doc.pipe(res);

    doc.fillColor('#4f46e5').fontSize(22).text('Personalized Lesson Plan', { align: 'left' });
    doc.moveDown(0.3);
    doc.fillColor('#111827').fontSize(11)
      .text(`Student: ${student}`)
      .text(`Subject: ${subject}`)
      .text(`Duration: ${mins} minutes`)
      .text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown(0.8);

    const section = (title) => {
      doc.moveDown(0.4);
      doc.fillColor('#4f46e5').fontSize(14).text(title);
      doc.moveTo(50, doc.y + 2).lineTo(560, doc.y + 2).strokeColor('#c7d2fe').stroke();
      doc.moveDown(0.4);
      doc.fillColor('#111827').fontSize(11);
    };

    section('Objectives');
    objectives.forEach((o, i) => doc.text(`${i + 1}. ${o}`));

    section('Materials');
    materials.forEach((m) => doc.text(`- ${m}`));

    section('Activities');
    activities.forEach((a) => doc.text(`- (${a.minutes} min) ${a.name}`));

    section('Assessment');
    doc.text('Formative: Observation during guided instruction and practice.');
    doc.text('Summative: Adaptive quiz score (target >= 70%).');
    doc.text('Exit ticket: One-sentence summary of what was learned today.');

    section('Differentiation');
    doc.text('- Visual learners: AI-generated diagrams + video clips.');
    doc.text('- Kinesthetic learners: hands-on manipulatives or simulation.');
    doc.text('- Struggling: scaffolded examples with step-by-step hints.');
    doc.text('- Advanced: extension problem with open-ended question.');

    doc.end();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ---------- NON-VIZ 2: Quiz Builder ----------
// POST /api/custom-views/quiz  { subject, difficulty, count, topics }
router.post('/quiz', (req, res) => {
  try {
    const { subject = 'Math', difficulty = 'medium', count = 5, topics = [] } = req.body || {};
    const n = Math.max(1, Math.min(50, parseInt(count, 10) || 5));
    const topicList = Array.isArray(topics) && topics.length
      ? topics
      : [`${subject} fundamentals`, `${subject} applications`];

    const seed = hash(`${subject}|${difficulty}|${n}|${topicList.join(',')}`);
    const TEMPLATES = {
      Math: [
        { q: 'What is {a} + {b}?', fn: (a, b) => a + b },
        { q: 'What is {a} - {b}?', fn: (a, b) => a - b },
        { q: 'What is {a} * {b}?', fn: (a, b) => a * b },
        { q: 'What is {a} squared?', fn: (a) => a * a },
      ],
      default: null,
    };

    const questions = [];
    for (let i = 0; i < n; i++) {
      const topic = topicList[i % topicList.length];
      if (subject === 'Math' && TEMPLATES.Math) {
        const tpl = TEMPLATES.Math[i % TEMPLATES.Math.length];
        const a = Math.floor(rand(seed + i * 7, 2, difficulty === 'hard' ? 50 : difficulty === 'easy' ? 10 : 25));
        const b = Math.floor(rand(seed + i * 13, 2, difficulty === 'hard' ? 50 : difficulty === 'easy' ? 10 : 25));
        const correct = tpl.fn(a, b);
        const text = tpl.q.replace('{a}', a).replace('{b}', b);
        const choices = [correct, correct + 1, correct - 1, correct + 2]
          .map((v) => String(v))
          .sort(() => 0.5 - rand(seed + i, 0, 1));
        questions.push({
          id: i + 1,
          topic,
          difficulty,
          text,
          choices,
          answer: String(correct),
        });
      } else {
        questions.push({
          id: i + 1,
          topic,
          difficulty,
          text: `[${difficulty.toUpperCase()}] Question about ${topic}: explain a key concept.`,
          choices: ['Concept A', 'Concept B', 'Concept C', 'Concept D'],
          answer: 'Concept A',
        });
      }
    }

    res.json({
      subject,
      difficulty,
      count: n,
      topics: topicList,
      questions,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/custom-views/quiz/pdf  { subject, difficulty, questions: [...] }
router.post('/quiz/pdf', (req, res) => {
  try {
    if (!PDFDocument) return res.status(500).json({ error: 'pdfkit not installed' });
    const { subject = 'Math', difficulty = 'medium', questions = [] } = req.body || {};
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quiz-${subject}-${difficulty}.pdf"`);
    doc.pipe(res);

    doc.fillColor('#4f46e5').fontSize(22).text(`${subject} Quiz`);
    doc.fillColor('#111827').fontSize(11).text(`Difficulty: ${difficulty}`);
    doc.text(`Questions: ${questions.length}`);
    doc.text(`Date: ${new Date().toLocaleString()}`);
    doc.moveDown();

    questions.forEach((q, idx) => {
      doc.fillColor('#111827').fontSize(12).text(`${idx + 1}. ${q.text}`, { paragraphGap: 4 });
      (q.choices || []).forEach((c, ci) => {
        doc.fontSize(11).fillColor('#374151').text(`   ${String.fromCharCode(65 + ci)}) ${c}`);
      });
      doc.moveDown(0.5);
    });

    doc.addPage();
    doc.fillColor('#4f46e5').fontSize(18).text('Answer Key');
    doc.moveDown();
    questions.forEach((q, idx) => {
      doc.fillColor('#111827').fontSize(11).text(`${idx + 1}. ${q.answer}`);
    });

    doc.end();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

module.exports = router;
