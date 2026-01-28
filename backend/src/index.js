const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const pool = require('./config/database');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// OpenRouter AI Helper
async function callOpenRouterAI(messages, systemPrompt = '') {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    return { error: true, message: 'Please configure your OpenRouter API key in .env file' };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Personalized Tutor'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
        messages: [
          { role: 'system', content: systemPrompt || 'You are a helpful AI tutor.' },
          ...messages
        ],
        max_tokens: 2000
      })
    });

    const data = await response.json();

    if (data.error) {
      return { error: true, message: data.error.message || 'AI service error' };
    }

    return { content: data.choices[0].message.content };
  } catch (error) {
    console.error('OpenRouter API error:', error);
    return { error: true, message: 'Failed to connect to AI service' };
  }
}

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, gradeLevel } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, grade_level) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role, grade_level',
      [email, passwordHash, fullName, gradeLevel]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });

    res.json({ user, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        gradeLevel: user.grade_level
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==================== LEARNING PATHS ====================

app.get('/api/learning-paths', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM learning_paths ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching learning paths:', error);
    res.status(500).json({ error: 'Failed to fetch learning paths' });
  }
});

app.get('/api/learning-paths/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM learning_paths WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Learning path not found' });
    }

    const materials = await pool.query('SELECT * FROM study_materials WHERE learning_path_id = $1', [req.params.id]);

    res.json({ ...result.rows[0], materials: materials.rows });
  } catch (error) {
    console.error('Error fetching learning path:', error);
    res.status(500).json({ error: 'Failed to fetch learning path' });
  }
});

app.post('/api/learning-paths', authenticateToken, async (req, res) => {
  try {
    const { title, description, subject, difficultyLevel, estimatedHours, icon, color } = req.body;
    const result = await pool.query(
      'INSERT INTO learning_paths (title, description, subject, difficulty_level, estimated_hours, icon, color) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, description, subject, difficultyLevel, estimatedHours, icon, color]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating learning path:', error);
    res.status(500).json({ error: 'Failed to create learning path' });
  }
});

// ==================== STUDY MATERIALS ====================

app.get('/api/study-materials', async (req, res) => {
  try {
    const { subject, topic } = req.query;
    let query = 'SELECT * FROM study_materials';
    const params = [];

    if (subject) {
      params.push(subject);
      query += ` WHERE subject = $${params.length}`;
    }

    if (topic) {
      params.push(topic);
      query += params.length > 1 ? ` AND topic = $${params.length}` : ` WHERE topic = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching study materials:', error);
    res.status(500).json({ error: 'Failed to fetch study materials' });
  }
});

app.get('/api/study-materials/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM study_materials WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Study material not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching study material:', error);
    res.status(500).json({ error: 'Failed to fetch study material' });
  }
});

app.post('/api/study-materials', authenticateToken, async (req, res) => {
  try {
    const { title, content, subject, topic, materialType, difficultyLevel, learningPathId } = req.body;
    const result = await pool.query(
      'INSERT INTO study_materials (title, content, subject, topic, material_type, difficulty_level, learning_path_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, content, subject, topic, materialType, difficultyLevel, learningPathId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating study material:', error);
    res.status(500).json({ error: 'Failed to create study material' });
  }
});

// ==================== QUIZZES ====================

app.get('/api/quizzes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM quizzes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

app.get('/api/quizzes/:id', async (req, res) => {
  try {
    const quiz = await pool.query('SELECT * FROM quizzes WHERE id = $1', [req.params.id]);
    if (quiz.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questions = await pool.query('SELECT * FROM quiz_questions WHERE quiz_id = $1', [req.params.id]);

    res.json({ ...quiz.rows[0], questions: questions.rows });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

app.post('/api/quizzes', authenticateToken, async (req, res) => {
  try {
    const { title, description, subject, topic, difficultyLevel, timeLimitMinutes, passingScore, isAdaptive } = req.body;
    const result = await pool.query(
      'INSERT INTO quizzes (title, description, subject, topic, difficulty_level, time_limit_minutes, passing_score, is_adaptive) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [title, description, subject, topic, difficultyLevel, timeLimitMinutes, passingScore, isAdaptive]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

app.post('/api/quizzes/:id/submit', authenticateToken, async (req, res) => {
  try {
    const { answers, timeTaken } = req.body;
    const quizId = req.params.id;

    const questions = await pool.query('SELECT * FROM quiz_questions WHERE quiz_id = $1', [quizId]);

    let score = 0;
    let totalPoints = 0;

    questions.rows.forEach(q => {
      totalPoints += q.points;
      if (answers[q.id] === q.correct_answer) {
        score += q.points;
      }
    });

    const result = await pool.query(
      'INSERT INTO quiz_attempts (user_id, quiz_id, score, total_points, time_taken_seconds, answers, completed_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
      [req.user.id, quizId, score, totalPoints, timeTaken, JSON.stringify(answers)]
    );

    res.json({ attempt: result.rows[0], score, totalPoints, percentage: Math.round((score / totalPoints) * 100) });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

// ==================== PRACTICE PROBLEMS ====================

app.get('/api/practice-problems', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM practice_problems ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching practice problems:', error);
    res.status(500).json({ error: 'Failed to fetch practice problems' });
  }
});

app.get('/api/practice-problems/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM practice_problems WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Practice problem not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching practice problem:', error);
    res.status(500).json({ error: 'Failed to fetch practice problem' });
  }
});

app.post('/api/practice-problems', authenticateToken, async (req, res) => {
  try {
    const { title, problemText, subject, topic, difficultyLevel, solution, hints } = req.body;
    const result = await pool.query(
      'INSERT INTO practice_problems (title, problem_text, subject, topic, difficulty_level, solution, hints) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, problemText, subject, topic, difficultyLevel, solution, JSON.stringify(hints)]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating practice problem:', error);
    res.status(500).json({ error: 'Failed to create practice problem' });
  }
});

// ==================== FLASHCARDS ====================

app.get('/api/flashcard-decks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM flashcard_decks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching flashcard decks:', error);
    res.status(500).json({ error: 'Failed to fetch flashcard decks' });
  }
});

app.get('/api/flashcard-decks/:id', async (req, res) => {
  try {
    const deck = await pool.query('SELECT * FROM flashcard_decks WHERE id = $1', [req.params.id]);
    if (deck.rows.length === 0) {
      return res.status(404).json({ error: 'Flashcard deck not found' });
    }

    const cards = await pool.query('SELECT * FROM flashcards WHERE deck_id = $1', [req.params.id]);

    res.json({ ...deck.rows[0], cards: cards.rows });
  } catch (error) {
    console.error('Error fetching flashcard deck:', error);
    res.status(500).json({ error: 'Failed to fetch flashcard deck' });
  }
});

app.post('/api/flashcard-decks', authenticateToken, async (req, res) => {
  try {
    const { title, description, subject, topic } = req.body;
    const result = await pool.query(
      'INSERT INTO flashcard_decks (title, description, subject, topic) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description, subject, topic]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating flashcard deck:', error);
    res.status(500).json({ error: 'Failed to create flashcard deck' });
  }
});

app.post('/api/flashcard-decks/:id/cards', authenticateToken, async (req, res) => {
  try {
    const { frontText, backText, imageUrl } = req.body;
    const deckId = req.params.id;

    const result = await pool.query(
      'INSERT INTO flashcards (deck_id, front_text, back_text, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [deckId, frontText, backText, imageUrl]
    );

    await pool.query('UPDATE flashcard_decks SET card_count = card_count + 1 WHERE id = $1', [deckId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating flashcard:', error);
    res.status(500).json({ error: 'Failed to create flashcard' });
  }
});

// ==================== VIDEO LESSONS ====================

app.get('/api/video-lessons', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM video_lessons ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching video lessons:', error);
    res.status(500).json({ error: 'Failed to fetch video lessons' });
  }
});

app.get('/api/video-lessons/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM video_lessons WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video lesson not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching video lesson:', error);
    res.status(500).json({ error: 'Failed to fetch video lesson' });
  }
});

app.post('/api/video-lessons', authenticateToken, async (req, res) => {
  try {
    const { title, description, subject, topic, videoUrl, thumbnailUrl, durationMinutes, instructor } = req.body;
    const result = await pool.query(
      'INSERT INTO video_lessons (title, description, subject, topic, video_url, thumbnail_url, duration_minutes, instructor) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [title, description, subject, topic, videoUrl, thumbnailUrl, durationMinutes, instructor]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating video lesson:', error);
    res.status(500).json({ error: 'Failed to create video lesson' });
  }
});

// ==================== AI CHAT ====================

app.get('/api/chat/sessions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
});

app.post('/api/chat/sessions', authenticateToken, async (req, res) => {
  try {
    const { title, subject } = req.body;
    const result = await pool.query(
      'INSERT INTO chat_sessions (user_id, title, subject) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, title || 'New Chat', subject]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});

app.get('/api/chat/sessions/:id/messages', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/chat/sessions/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    const sessionId = req.params.id;

    // Save user message
    await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [sessionId, 'user', content]
    );

    // Get chat history
    const history = await pool.query(
      'SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT 20',
      [sessionId]
    );

    // Call AI
    const aiResponse = await callOpenRouterAI(
      history.rows.map(m => ({ role: m.role, content: m.content })),
      'You are a helpful, patient, and knowledgeable AI tutor. Help students understand concepts clearly. Use examples when helpful. Encourage learning and provide positive reinforcement.'
    );

    const aiContent = aiResponse.error ? aiResponse.message : aiResponse.content;

    // Save AI response
    const result = await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [sessionId, 'assistant', aiContent]
    );

    // Update session timestamp
    await pool.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1', [sessionId]);

    res.json({ userMessage: { role: 'user', content }, assistantMessage: result.rows[0] });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ==================== GOALS ====================

app.get('/api/goals', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

app.get('/api/goals/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching goal:', error);
    res.status(500).json({ error: 'Failed to fetch goal' });
  }
});

app.post('/api/goals', authenticateToken, async (req, res) => {
  try {
    const { title, description, targetDate, category } = req.body;
    const result = await pool.query(
      'INSERT INTO goals (user_id, title, description, target_date, category) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, title, description, targetDate, category]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

app.put('/api/goals/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, targetDate, category, status, progressPercentage } = req.body;
    const result = await pool.query(
      'UPDATE goals SET title = COALESCE($1, title), description = COALESCE($2, description), target_date = COALESCE($3, target_date), category = COALESCE($4, category), status = COALESCE($5, status), progress_percentage = COALESCE($6, progress_percentage) WHERE id = $7 AND user_id = $8 RETURNING *',
      [title, description, targetDate, category, status, progressPercentage, req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// ==================== VOCABULARY ====================

app.get('/api/vocabulary', async (req, res) => {
  try {
    const { difficulty } = req.query;
    let query = 'SELECT * FROM vocabulary_words';
    const params = [];

    if (difficulty) {
      params.push(difficulty);
      query += ` WHERE difficulty_level = $1`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vocabulary:', error);
    res.status(500).json({ error: 'Failed to fetch vocabulary' });
  }
});

app.get('/api/vocabulary/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vocabulary_words WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vocabulary word not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching vocabulary word:', error);
    res.status(500).json({ error: 'Failed to fetch vocabulary word' });
  }
});

app.post('/api/vocabulary', authenticateToken, async (req, res) => {
  try {
    const { word, definition, partOfSpeech, exampleSentence, pronunciation, difficultyLevel, subject } = req.body;
    const result = await pool.query(
      'INSERT INTO vocabulary_words (word, definition, part_of_speech, example_sentence, pronunciation, difficulty_level, subject) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [word, definition, partOfSpeech, exampleSentence, pronunciation, difficultyLevel, subject]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating vocabulary word:', error);
    res.status(500).json({ error: 'Failed to create vocabulary word' });
  }
});

// ==================== ESSAYS & WRITING ====================

app.get('/api/essays', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM essays WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching essays:', error);
    res.status(500).json({ error: 'Failed to fetch essays' });
  }
});

app.get('/api/essays/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM essays WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Essay not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching essay:', error);
    res.status(500).json({ error: 'Failed to fetch essay' });
  }
});

app.post('/api/essays', authenticateToken, async (req, res) => {
  try {
    const { title, content, prompt, subject } = req.body;
    const wordCount = content ? content.split(/\s+/).filter(w => w.length > 0).length : 0;
    const result = await pool.query(
      'INSERT INTO essays (user_id, title, content, prompt, subject, word_count) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, title, content, prompt, subject, wordCount]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating essay:', error);
    res.status(500).json({ error: 'Failed to create essay' });
  }
});

app.put('/api/essays/:id', authenticateToken, async (req, res) => {
  try {
    const { title, content, status } = req.body;
    const wordCount = content ? content.split(/\s+/).filter(w => w.length > 0).length : 0;
    const result = await pool.query(
      'UPDATE essays SET title = COALESCE($1, title), content = COALESCE($2, content), word_count = $3, status = COALESCE($4, status), updated_at = NOW() WHERE id = $5 AND user_id = $6 RETURNING *',
      [title, content, wordCount, status, req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating essay:', error);
    res.status(500).json({ error: 'Failed to update essay' });
  }
});

app.post('/api/essays/:id/grade', authenticateToken, async (req, res) => {
  try {
    const essay = await pool.query(
      'SELECT * FROM essays WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (essay.rows.length === 0) {
      return res.status(404).json({ error: 'Essay not found' });
    }

    const essayData = essay.rows[0];

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Please grade and provide feedback on this essay:\n\nTitle: ${essayData.title}\nPrompt: ${essayData.prompt || 'No specific prompt'}\n\nContent:\n${essayData.content}` }],
      'You are an experienced writing teacher. Grade the essay on a scale of 0-100 and provide constructive feedback. Format your response as: SCORE: [number]\n\nFEEDBACK:\n[your detailed feedback including strengths, areas for improvement, and specific suggestions]'
    );

    let score = 75;
    let feedback = aiResponse.error ? aiResponse.message : aiResponse.content;

    if (!aiResponse.error) {
      const scoreMatch = feedback.match(/SCORE:\s*(\d+)/i);
      if (scoreMatch) {
        score = parseInt(scoreMatch[1]);
      }
    }

    const result = await pool.query(
      'UPDATE essays SET ai_feedback = $1, ai_score = $2, status = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [feedback, score, 'graded', req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error grading essay:', error);
    res.status(500).json({ error: 'Failed to grade essay' });
  }
});

// Writing Prompts
app.get('/api/writing-prompts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM writing_prompts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching writing prompts:', error);
    res.status(500).json({ error: 'Failed to fetch writing prompts' });
  }
});

app.get('/api/writing-prompts/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM writing_prompts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Writing prompt not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching writing prompt:', error);
    res.status(500).json({ error: 'Failed to fetch writing prompt' });
  }
});

app.post('/api/writing-prompts', authenticateToken, async (req, res) => {
  try {
    const { title, promptText, genre, difficultyLevel, wordCountTarget } = req.body;
    const result = await pool.query(
      'INSERT INTO writing_prompts (title, prompt_text, genre, difficulty_level, word_count_target) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, promptText, genre, difficultyLevel, wordCountTarget]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating writing prompt:', error);
    res.status(500).json({ error: 'Failed to create writing prompt' });
  }
});

// ==================== MATH PROBLEM SOLVER ====================

app.get('/api/math-problems', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM math_problems ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching math problems:', error);
    res.status(500).json({ error: 'Failed to fetch math problems' });
  }
});

app.get('/api/math-problems/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM math_problems WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Math problem not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching math problem:', error);
    res.status(500).json({ error: 'Failed to fetch math problem' });
  }
});

app.post('/api/math-problems/solve', authenticateToken, async (req, res) => {
  try {
    const { problem } = req.body;

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Solve this math problem step by step:\n\n${problem}` }],
      'You are a patient math tutor. Solve the problem step by step, explaining each step clearly. Format your response with numbered steps. At the end, clearly state the final answer.'
    );

    res.json({
      problem,
      solution: aiResponse.error ? aiResponse.message : aiResponse.content,
      error: aiResponse.error
    });
  } catch (error) {
    console.error('Error solving math problem:', error);
    res.status(500).json({ error: 'Failed to solve math problem' });
  }
});

app.post('/api/math-problems', authenticateToken, async (req, res) => {
  try {
    const { problemText, problemType, difficultyLevel, solutionSteps, finalAnswer, topic } = req.body;
    const result = await pool.query(
      'INSERT INTO math_problems (problem_text, problem_type, difficulty_level, solution_steps, final_answer, topic) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [problemText, problemType, difficultyLevel, JSON.stringify(solutionSteps), finalAnswer, topic]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating math problem:', error);
    res.status(500).json({ error: 'Failed to create math problem' });
  }
});

// ==================== PERFORMANCE ANALYTICS ====================

app.get('/api/analytics', authenticateToken, async (req, res) => {
  try {
    // Get quiz performance
    const quizStats = await pool.query(`
      SELECT
        COUNT(*) as total_quizzes,
        AVG(score::float / NULLIF(total_points, 0) * 100) as avg_score,
        MAX(score::float / NULLIF(total_points, 0) * 100) as best_score
      FROM quiz_attempts
      WHERE user_id = $1 AND completed_at IS NOT NULL
    `, [req.user.id]);

    // Get study sessions
    const studyStats = await pool.query(`
      SELECT
        COUNT(*) as total_sessions,
        SUM(duration_minutes) as total_minutes,
        AVG(duration_minutes) as avg_session_length
      FROM study_sessions
      WHERE user_id = $1
    `, [req.user.id]);

    // Get goals progress
    const goalStats = await pool.query(`
      SELECT
        COUNT(*) as total_goals,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_goals,
        AVG(progress_percentage) as avg_progress
      FROM goals
      WHERE user_id = $1
    `, [req.user.id]);

    // Get achievements
    const achievements = await pool.query(`
      SELECT a.* FROM achievements a
      JOIN user_achievements ua ON a.id = ua.achievement_id
      WHERE ua.user_id = $1
      ORDER BY ua.earned_at DESC
    `, [req.user.id]);

    res.json({
      quizStats: quizStats.rows[0],
      studyStats: studyStats.rows[0],
      goalStats: goalStats.rows[0],
      achievements: achievements.rows
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

app.get('/api/analytics/subjects', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT subject, metric_type, AVG(metric_value) as avg_value
      FROM performance_analytics
      WHERE user_id = $1
      GROUP BY subject, metric_type
      ORDER BY subject
    `, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subject analytics:', error);
    res.status(500).json({ error: 'Failed to fetch subject analytics' });
  }
});

app.get('/api/analytics/quiz-history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        DATE(completed_at) as date,
        ROUND(AVG(score::float / NULLIF(total_points, 0) * 100)) as avg_score,
        COUNT(*) as quiz_count
      FROM quiz_attempts
      WHERE user_id = $1 AND completed_at IS NOT NULL
      GROUP BY DATE(completed_at)
      ORDER BY DATE(completed_at) DESC
      LIMIT 30
    `, [req.user.id]);
    res.json(result.rows.reverse());
  } catch (error) {
    console.error('Error fetching quiz history:', error);
    res.status(500).json({ error: 'Failed to fetch quiz history' });
  }
});

app.get('/api/analytics/study-history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        DATE(started_at) as date,
        ROUND(SUM(duration_minutes)) as total_minutes,
        COUNT(*) as session_count
      FROM study_sessions
      WHERE user_id = $1 AND duration_minutes IS NOT NULL
      GROUP BY DATE(started_at)
      ORDER BY DATE(started_at) DESC
      LIMIT 30
    `, [req.user.id]);
    res.json(result.rows.reverse());
  } catch (error) {
    console.error('Error fetching study history:', error);
    res.status(500).json({ error: 'Failed to fetch study history' });
  }
});

app.get('/api/analytics/subject-scores', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        q.subject,
        ROUND(AVG(qa.score::float / NULLIF(qa.total_points, 0) * 100)) as avg_score,
        COUNT(*) as attempts
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.user_id = $1 AND qa.completed_at IS NOT NULL
      GROUP BY q.subject
      ORDER BY avg_score DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subject scores:', error);
    res.status(500).json({ error: 'Failed to fetch subject scores' });
  }
});

// ==================== ACHIEVEMENTS ====================

app.get('/api/achievements', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM achievements ORDER BY points DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

app.get('/api/achievements/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, ua.earned_at
      FROM achievements a
      JOIN user_achievements ua ON a.id = ua.achievement_id
      WHERE ua.user_id = $1
      ORDER BY ua.earned_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user achievements:', error);
    res.status(500).json({ error: 'Failed to fetch user achievements' });
  }
});

// ==================== AI WRITING ASSISTANT ====================

app.post('/api/writing-assistant/improve', authenticateToken, async (req, res) => {
  try {
    const { text, type } = req.body;

    let prompt = '';
    switch (type) {
      case 'grammar':
        prompt = 'Check and fix any grammar, spelling, or punctuation errors in this text. Return the corrected text and list the changes made.';
        break;
      case 'style':
        prompt = 'Improve the writing style of this text to make it more engaging and professional. Return the improved text.';
        break;
      case 'clarity':
        prompt = 'Rewrite this text to make it clearer and more concise while keeping the same meaning.';
        break;
      case 'expand':
        prompt = 'Expand this text with more details and examples while maintaining the same tone and style.';
        break;
      default:
        prompt = 'Improve this text for clarity, style, and grammar.';
    }

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `${prompt}\n\nText:\n${text}` }],
      'You are a helpful writing assistant. Provide clear, constructive suggestions to improve the text.'
    );

    res.json({
      original: text,
      improved: aiResponse.error ? text : aiResponse.content,
      error: aiResponse.error,
      message: aiResponse.error ? aiResponse.message : null
    });
  } catch (error) {
    console.error('Error improving text:', error);
    res.status(500).json({ error: 'Failed to improve text' });
  }
});

// ==================== STUDY SESSIONS ====================

app.get('/api/study-sessions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM study_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching study sessions:', error);
    res.status(500).json({ error: 'Failed to fetch study sessions' });
  }
});

app.post('/api/study-sessions', authenticateToken, async (req, res) => {
  try {
    const { subject, activityType } = req.body;
    const result = await pool.query(
      'INSERT INTO study_sessions (user_id, subject, activity_type) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, subject, activityType]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating study session:', error);
    res.status(500).json({ error: 'Failed to create study session' });
  }
});

app.put('/api/study-sessions/:id/end', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE study_sessions
      SET ended_at = NOW(),
          duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [req.params.id, req.user.id]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error ending study session:', error);
    res.status(500).json({ error: 'Failed to end study session' });
  }
});

// ==================== DASHBOARD STATS ====================

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [learningPaths, quizzes, goals, studyTime] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM user_learning_paths WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*) FROM quiz_attempts WHERE user_id = $1 AND completed_at IS NOT NULL', [userId]),
      pool.query('SELECT COUNT(*) FROM goals WHERE user_id = $1 AND status = $2', [userId, 'completed']),
      pool.query('SELECT COALESCE(SUM(duration_minutes), 0) as total FROM study_sessions WHERE user_id = $1', [userId])
    ]);

    res.json({
      enrolledPaths: parseInt(learningPaths.rows[0].count),
      completedQuizzes: parseInt(quizzes.rows[0].count),
      achievedGoals: parseInt(goals.rows[0].count),
      studyHours: Math.round(parseInt(studyTime.rows[0].total) / 60)
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ==================== ASK AI (Stateless Q&A) ====================

app.post('/api/ai/ask', authenticateToken, async (req, res) => {
  try {
    const { question, context } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const systemPrompt = `You are a helpful AI tutor assistant. Answer the student's question clearly and concisely.${context ? ` The student is currently on the "${context}" page of their learning platform.` : ''} Keep answers focused and educational.`;

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: question.trim() }],
      systemPrompt
    );

    if (aiResponse.error) {
      return res.status(500).json({ error: aiResponse.message });
    }

    res.json({ answer: aiResponse.content });
  } catch (error) {
    console.error('Error in /api/ai/ask:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Tutor Backend running on port ${PORT}`);
});
