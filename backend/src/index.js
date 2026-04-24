const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }

const pool = require('./config/database');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json());

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many auth requests, try again later' } });
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests, try again later' } });
app.use('/api/auth/', authLimiter);
app.use('/api/', generalLimiter);

// Password validation helper
const validatePassword = (password) => {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a special character';
  return null;
};

// Express-validator helpers
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
};
const requireString = (field, label) => body(field).trim().notEmpty().withMessage(`${label} is required`);
const requireEmail = () => body('email').isEmail().withMessage('Valid email is required');
const sanitizeString = (field) => body(field).trim().escape();

// RBAC middleware
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};

// Pagination helper
const buildPaginatedQuery = (baseTable, req, searchColumns = [], filterColumns = [], baseConditions = [], baseParams = []) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const search = (req.query.search || '').trim();
  const allowedSorts = ['created_at', 'title', 'subject', 'difficulty_level', 'updated_at', 'due_date', 'word', 'points', 'problem_type'];
  const sortField = allowedSorts.includes(req.query.sort) ? req.query.sort : 'created_at';
  const sortDir = req.query.dir === 'ASC' ? 'ASC' : 'DESC';

  let conditions = [...baseConditions];
  let params = [...baseParams];
  let paramIdx = baseParams.length;

  // Search
  if (search && searchColumns.length > 0) {
    paramIdx++;
    const searchClauses = searchColumns.map(col => `${col} ILIKE $${paramIdx}`);
    conditions.push(`(${searchClauses.join(' OR ')})`);
    params.push(`%${search}%`);
  }

  // Filters
  for (const col of filterColumns) {
    const val = req.query[col];
    if (val) {
      paramIdx++;
      conditions.push(`${col} = $${paramIdx}`);
      params.push(val);
    }
  }

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT * FROM ${baseTable}${whereClause} ORDER BY ${sortField} ${sortDir} LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
  const countQuery = `SELECT COUNT(*) FROM ${baseTable}${whereClause}`;

  return { query, countQuery, params, page, limit };
};

const sendPaginated = async (res, baseTable, req, searchColumns, filterColumns, baseConditions = [], baseParams = []) => {
  const { query, countQuery, params, page, limit } = buildPaginatedQuery(baseTable, req, searchColumns, filterColumns, baseConditions, baseParams);
  const [dataResult, countResult] = await Promise.all([
    pool.query(query, params),
    pool.query(countQuery, params)
  ]);
  const total = parseInt(countResult.rows[0].count);
  res.json({ data: dataResult.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

// JWT Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Check blacklist
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const blacklisted = await pool.query('SELECT id FROM token_blacklist WHERE token_hash = $1', [tokenHash]);
    if (blacklisted.rows.length > 0) {
      return res.status(403).json({ error: 'Token has been revoked' });
    }
  } catch (e) {
    // If blacklist table doesn't exist yet, skip check
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret', async (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    // Enrich with role from DB
    try {
      const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.id]);
      if (userResult.rows.length > 0) decoded.role = userResult.rows[0].role;
    } catch (e) {}
    req.user = decoded;
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
        max_tokens: 10096
      })
    });

    const data = await response.json();

    if (data.error) {
      return { error: true, message: data.error.message || 'AI service error' };
    }

    let content = data.choices[0].message.content;
    // Strip markdown code fences that break JSON.parse()
    content = content.replace(/^```(?:json|javascript|html|css|sql)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();
    return { content };
  } catch (error) {
    console.error('OpenRouter API error:', error);
    return { error: true, message: 'Failed to connect to AI service' };
  }
}

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, gradeLevel } = req.body;

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, grade_level) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role, grade_level',
      [email, passwordHash, fullName, gradeLevel]
    );

    const user = result.rows[0];

    // Create email verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    try {
      await pool.query(
        'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + interval \'24 hours\')',
        [user.id, verifyToken]
      );
    } catch (e) {}

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });

    res.json({ user, token, verificationToken: verifyToken });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'Email already registered' });
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

// POST /api/auth/logout — blacklist token
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query(
      'INSERT INTO token_blacklist (token_hash, expires_at) VALUES ($1, NOW() + interval \'24 hours\')',
      [tokenHash]
    );
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({ message: 'Logged out' });
  }
});

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.json({ message: 'If that email exists, a reset link has been sent' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + interval \'1 hour\')',
      [userResult.rows[0].id, resetToken]
    );

    // In dev, return token directly
    res.json({ message: 'If that email exists, a reset link has been sent', resetToken });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    const tokenResult = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = false AND expires_at > NOW()',
      [token]
    );
    if (tokenResult.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, tokenResult.rows[0].user_id]);
    await pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [tokenResult.rows[0].id]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// POST /api/auth/verify-email
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    const tokenResult = await pool.query(
      'SELECT * FROM email_verification_tokens WHERE token = $1 AND verified = false AND expires_at > NOW()',
      [token]
    );
    if (tokenResult.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired verification token' });

    await pool.query('UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1', [tokenResult.rows[0].user_id]);
    await pool.query('UPDATE email_verification_tokens SET verified = true WHERE id = $1', [tokenResult.rows[0].id]);

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// GET /api/auth/me — return user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, grade_level, learning_style, bio, avatar_url, email_verified, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({ id: u.id, email: u.email, fullName: u.full_name, role: u.role, gradeLevel: u.grade_level, learningStyle: u.learning_style, bio: u.bio, avatarUrl: u.avatar_url, emailVerified: u.email_verified, createdAt: u.created_at });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// PUT /api/auth/me — update profile
app.put('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const { fullName, gradeLevel, learningStyle, bio } = req.body;
    const result = await pool.query(
      'UPDATE users SET full_name = COALESCE($1, full_name), grade_level = COALESCE($2, grade_level), learning_style = COALESCE($3, learning_style), bio = COALESCE($4, bio), updated_at = NOW() WHERE id = $5 RETURNING id, email, full_name, role, grade_level, learning_style, bio, avatar_url, email_verified',
      [fullName, gradeLevel, learningStyle, bio, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({ id: u.id, email: u.email, fullName: u.full_name, role: u.role, gradeLevel: u.grade_level, learningStyle: u.learning_style, bio: u.bio, avatarUrl: u.avatar_url, emailVerified: u.email_verified });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ==================== LEARNING PATHS ====================

app.get('/api/learning-paths', async (req, res) => {
  try {
    await sendPaginated(res, 'learning_paths', req, ['title', 'description', 'subject'], ['subject', 'difficulty_level']);
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
    await sendPaginated(res, 'study_materials', req, ['title', 'content', 'subject', 'topic'], ['subject', 'difficulty_level', 'material_type']);
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
    await sendPaginated(res, 'quizzes', req, ['title', 'description', 'subject', 'topic'], ['subject', 'difficulty_level']);
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
      'INSERT INTO quizzes (user_id, title, description, subject, topic, difficulty_level, time_limit_minutes, passing_score, is_adaptive) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [req.user.id, title, description, subject, topic, difficultyLevel, timeLimitMinutes, passingScore, isAdaptive]
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
    await sendPaginated(res, 'practice_problems', req, ['title', 'problem_text', 'subject', 'topic'], ['subject', 'difficulty_level']);
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
    await sendPaginated(res, 'flashcard_decks', req, ['title', 'description', 'subject', 'topic'], ['subject']);
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
      'INSERT INTO flashcard_decks (user_id, title, description, subject, topic) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, title, description, subject, topic]
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
    await sendPaginated(res, 'video_lessons', req, ['title', 'description', 'subject', 'topic', 'instructor'], ['subject']);
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
      `You are a warm, patient, and deeply knowledgeable AI tutor named "Study Buddy." Your teaching philosophy combines encouragement with rigor.

**Your Persona:**
- Patient and never condescending — treat every question as valid
- Enthusiastic about learning — show genuine excitement about topics
- Adaptive — match explanation complexity to the student's level

**Teaching Methodology:**
- Start with what the student already knows, then build on it
- Use analogies and real-world examples to make abstract concepts concrete
- Break complex topics into digestible steps
- Ask follow-up questions to check understanding ("Does that make sense?")
- When a student is wrong, guide them to the right answer rather than just correcting

**Formatting:**
- Use headers and bullet points for organized responses
- Bold key terms when introducing them
- Include examples with clear labels
- Keep responses focused but thorough`
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
    await sendPaginated(res, 'goals', req, ['title', 'description', 'category'], ['category', 'status'], ['user_id = $1'], [req.user.id]);
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
    await sendPaginated(res, 'vocabulary_words', req, ['word', 'definition', 'example_sentence'], ['difficulty_level', 'subject', 'part_of_speech']);
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
    await sendPaginated(res, 'essays', req, ['title', 'content', 'subject'], ['subject', 'status'], ['user_id = $1'], [req.user.id]);
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
      `You are an experienced, encouraging writing teacher with expertise in academic writing, rhetoric, and composition. Grade holistically but break down your assessment.

**Grading Rubric (0-100 scale):**
- Thesis & Argument (25 pts): Clear thesis, logical argument, strong claims
- Evidence & Support (25 pts): Relevant examples, proper citations, depth of analysis
- Organization & Structure (20 pts): Logical flow, paragraph transitions, intro/conclusion
- Language & Style (15 pts): Vocabulary, sentence variety, tone appropriateness
- Grammar & Mechanics (15 pts): Spelling, punctuation, grammar correctness

**Response Format:**
SCORE: [number]

FEEDBACK:

**Strengths:** (List 2-3 specific things done well with quoted examples)

**Areas for Improvement:** (List 2-3 specific areas with actionable suggestions)

**Rubric Breakdown:**
- Thesis & Argument: [X/25]
- Evidence & Support: [X/25]
- Organization: [X/20]
- Language & Style: [X/15]
- Grammar: [X/15]

**Next Steps:** (1-2 concrete revision suggestions)

Be encouraging — highlight growth potential while being honest about weaknesses.`
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
    await sendPaginated(res, 'writing_prompts', req, ['title', 'prompt_text', 'genre'], ['genre', 'difficulty_level']);
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
    await sendPaginated(res, 'math_problems', req, ['problem_text', 'topic', 'final_answer'], ['problem_type', 'difficulty_level']);
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
      `You are a patient, encouraging math tutor who makes mathematics accessible and even enjoyable. When solving problems:

**Step-by-Step Format:**
- Label each step clearly (Step 1, Step 2, etc.)
- Show ALL work — never skip intermediate calculations
- Explain the WHY behind each step, not just the HOW
- Use → arrows to show transformations (e.g., 2x + 5 = 15 → 2x = 10)

**Teaching Approach:**
- Start by identifying the problem type and relevant concepts
- Highlight common mistakes students make at each step
- Include a "Verification" step at the end to check the answer
- Suggest a similar practice problem for reinforcement

**Formatting:**
- Use clear mathematical notation
- Box or bold the final answer
- Keep language simple and encouraging

End with: "Final Answer: [answer]" clearly stated.`
    );

    const solution = aiResponse.error ? aiResponse.message : aiResponse.content;

    // Save to database
    try {
      await pool.query(
        'INSERT INTO math_solver_results (user_id, problem, solution) VALUES ($1, $2, $3)',
        [req.user.id, problem, solution]
      );
    } catch (dbErr) {
      console.error('Error saving math solver result:', dbErr);
    }

    res.json({
      problem,
      solution,
      error: aiResponse.error
    });
  } catch (error) {
    console.error('Error solving math problem:', error);
    res.status(500).json({ error: 'Failed to solve math problem' });
  }
});

app.get('/api/math-problems/solve/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM math_solver_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching math solver history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
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
    await sendPaginated(res, 'achievements', req, ['title', 'description', 'category'], ['category']);
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
      `You are an expert writing coach and editor with deep knowledge of rhetoric, style, and grammar. Your goal is to elevate the student's writing while preserving their unique voice.

**Your Approach:**
1. **Preserve the author's tone and intent** — enhance, don't replace their voice
2. **Show, don't just tell** — demonstrate improvements with the actual rewritten text
3. **Be specific** — reference exact phrases when explaining changes

**Response Format:**
- Start with the **Improved Text** (the full rewritten version)
- Then provide a **Changes Summary** section listing each change with a brief explanation
- End with **Writing Tips** — 2-3 actionable tips the student can apply to future writing

**Quality Standards:**
- Vary sentence structure (mix short punchy sentences with longer descriptive ones)
- Eliminate weak verbs (is, was, are) where possible in favor of vivid action verbs
- Strengthen transitions between ideas
- Remove redundancies and filler words
- Ensure logical paragraph flow`
    );

    const improved = aiResponse.error ? text : aiResponse.content;

    // Save to database
    try {
      await pool.query(
        'INSERT INTO writing_assistant_results (user_id, original_text, improved_text, improvement_type) VALUES ($1, $2, $3, $4)',
        [req.user.id, text, improved, type || 'general']
      );
    } catch (dbErr) {
      console.error('Error saving writing assistant result:', dbErr);
    }

    res.json({
      original: text,
      improved,
      error: aiResponse.error,
      message: aiResponse.error ? aiResponse.message : null
    });
  } catch (error) {
    console.error('Error improving text:', error);
    res.status(500).json({ error: 'Failed to improve text' });
  }
});

app.get('/api/writing-assistant/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM writing_assistant_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching writing assistant history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
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

    const systemPrompt = `You are a knowledgeable, friendly AI tutor assistant embedded in a learning platform. Your role is to provide quick, accurate, and educational answers.${context ? ` The student is currently on the "${context}" page.` : ''}

**Response Guidelines:**
- Keep answers concise (2-4 paragraphs max) but thorough
- Use bullet points or numbered lists for multi-part answers
- Include a real-world example when it helps understanding
- If the question is ambiguous, address the most likely interpretation
- End with a brief "Want to learn more?" suggestion pointing to a related topic
- Use encouraging, supportive language appropriate for students`;

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: question.trim() }],
      systemPrompt
    );

    if (aiResponse.error) {
      return res.status(500).json({ error: aiResponse.message });
    }

    // Save to database
    try {
      await pool.query(
        'INSERT INTO ai_widget_queries (user_id, question, answer, context) VALUES ($1, $2, $3, $4)',
        [req.user.id, question.trim(), aiResponse.content, context || null]
      );
    } catch (dbErr) {
      console.error('Error saving AI widget query:', dbErr);
    }

    res.json({ answer: aiResponse.content });
  } catch (error) {
    console.error('Error in /api/ai/ask:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

// ==================== AI LEARNING STYLE DETECTOR ====================

app.get('/api/learning-style/questions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM learning_style_questions ORDER BY RANDOM() LIMIT 10');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching learning style questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

app.post('/api/learning-style/analyze', authenticateToken, async (req, res) => {
  try {
    const { answers } = req.body;

    // Calculate scores using actual style_weights from questions
    let scores = { visual: 0, auditory: 0, reading_writing: 0, kinesthetic: 0 };

    // Fetch question weights from DB
    const questionIds = answers.map(a => a.questionId).filter(Boolean);
    let questionWeights = {};
    if (questionIds.length > 0) {
      const qResult = await pool.query('SELECT id, style_weights FROM learning_style_questions WHERE id = ANY($1)', [questionIds]);
      qResult.rows.forEach(q => {
        const weights = typeof q.style_weights === 'string' ? JSON.parse(q.style_weights) : q.style_weights;
        questionWeights[q.id] = weights;
      });
    }

    answers.forEach(answer => {
      const weights = questionWeights[answer.questionId];
      if (weights && answer.selectedOption >= 0 && answer.selectedOption < 4) {
        const idx = answer.selectedOption;
        scores.visual += (weights.visual?.[idx] || 0);
        scores.auditory += (weights.auditory?.[idx] || 0);
        scores.reading_writing += (weights.reading_writing?.[idx] || 0);
        scores.kinesthetic += (weights.kinesthetic?.[idx] || 0);
      }
    });

    // Determine dominant style
    const dominantStyle = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0];

    // Get AI analysis
    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Based on these learning style scores: Visual=${scores.visual}, Auditory=${scores.auditory}, Reading/Writing=${scores.reading_writing}, Kinesthetic=${scores.kinesthetic}. The dominant style is ${dominantStyle}. Provide a brief personalized analysis (2-3 paragraphs) with specific study recommendations for this learning style.` }],
      `You are an educational psychologist specializing in the VARK learning styles framework (Visual, Auditory, Reading/Writing, Kinesthetic). Provide a rich, personalized analysis.

**Your Analysis Should Include:**
1. **Dominant Style Profile** — Describe what this learning style means in practical terms
2. **Multimodal Insights** — Note that most people benefit from combining styles; explain how secondary styles complement the dominant one
3. **Specific Study Strategies** — Provide 5-7 concrete, actionable study techniques tailored to this style:
   - For Visual: mind maps, color coding, diagrams, infographics, spatial arrangements
   - For Auditory: podcasts, discussion groups, teaching others, mnemonic songs, verbal repetition
   - For Reading/Writing: detailed notes, rewriting summaries, lists, written self-quizzes, journaling
   - For Kinesthetic: flashcard manipulation, role-play, lab experiments, building models, movement-based review
4. **Tool Recommendations** — Suggest specific apps, websites, or physical tools that suit this style
5. **Potential Challenges** — Warn about common pitfalls for this learning style and how to overcome them

Keep the tone supportive and empowering. Help the student see their learning style as a strength.`
    );

    // AI-generated recommendations
    let recommendations = [];
    try {
      const recResponse = await callOpenRouterAI(
        [{ role: 'user', content: `For a ${dominantStyle.replace('_', '/')} learner with scores Visual=${scores.visual}, Auditory=${scores.auditory}, Reading/Writing=${scores.reading_writing}, Kinesthetic=${scores.kinesthetic}, give exactly 5 short, actionable study recommendations. Return ONLY a JSON array of 5 strings.` }],
        'You are a learning coach. Return ONLY a valid JSON array of 5 short recommendation strings. No other text.'
      );
      const recMatch = (recResponse.content || '').match(/\[[\s\S]*\]/);
      if (recMatch) recommendations = JSON.parse(recMatch[0]);
    } catch (e) {}
    if (recommendations.length === 0) {
      recommendations = [
        dominantStyle === 'visual' ? 'Use diagrams, charts, and color-coded notes' : null,
        dominantStyle === 'auditory' ? 'Listen to lectures and discuss concepts aloud' : null,
        dominantStyle === 'reading_writing' ? 'Take detailed notes and read extensively' : null,
        dominantStyle === 'kinesthetic' ? 'Use hands-on activities and practice problems' : null,
        'Mix learning methods for comprehensive understanding',
        'Take regular breaks to maintain focus'
      ].filter(Boolean);
    }

    // Save assessment
    const result = await pool.query(
      `INSERT INTO learning_style_assessments
       (user_id, visual_score, auditory_score, reading_writing_score, kinesthetic_score, dominant_style, ai_analysis, recommendations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, scores.visual, scores.auditory, scores.reading_writing, scores.kinesthetic,
       dominantStyle, aiResponse.content || aiResponse.message, JSON.stringify(recommendations)]
    );

    // Update user's learning style
    await pool.query('UPDATE users SET learning_style = $1 WHERE id = $2', [dominantStyle, req.user.id]);

    res.json({
      assessment: result.rows[0],
      scores,
      dominantStyle,
      analysis: aiResponse.content || aiResponse.message,
      recommendations
    });
  } catch (error) {
    console.error('Error analyzing learning style:', error);
    res.status(500).json({ error: 'Failed to analyze learning style' });
  }
});

// Direct AI Learning Style Assessment (no quiz required)
app.post('/api/learning-style/ai-assess', authenticateToken, async (req, res) => {
  try {
    const { description } = req.body;

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `A student describes their learning habits and preferences as follows:\n\n"${description}"\n\nBased on this description, determine their VARK learning style profile. Provide:\n1. Estimated scores (0-10) for each style: Visual, Auditory, Reading/Writing, Kinesthetic\n2. The dominant learning style\n3. A detailed personalized analysis\n4. 5 specific study recommendations\n\nReturn as JSON: { "scores": { "visual": N, "auditory": N, "reading_writing": N, "kinesthetic": N }, "dominant_style": "style_name", "analysis": "detailed text", "recommendations": ["rec1", "rec2", ...] }` }],
      `You are an educational psychologist specializing in the VARK learning styles framework. Analyze the student's self-description to determine their learning style profile. Be thorough and insightful in your analysis. Return ONLY valid JSON with the exact structure requested.`
    );

    let parsed = null;
    try {
      const jsonMatch = (aiResponse.content || '').match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {}

    if (!parsed || !parsed.scores) {
      return res.status(500).json({ error: 'AI could not analyze the description. Please try again with more detail.' });
    }

    const scores = parsed.scores;
    const dominantStyle = parsed.dominant_style || Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0];

    // Get detailed analysis if AI only returned brief one
    let analysis = parsed.analysis || '';
    if (analysis.length < 200) {
      const detailResponse = await callOpenRouterAI(
        [{ role: 'user', content: `A student is a ${dominantStyle.replace('_', '/')} learner with scores Visual=${scores.visual}, Auditory=${scores.auditory}, Reading/Writing=${scores.reading_writing}, Kinesthetic=${scores.kinesthetic}. Their self-description: "${description}". Provide a detailed 3-4 paragraph personalized analysis with study strategies, tool recommendations, and tips.` }],
        `You are an educational psychologist. Provide a rich, detailed, supportive analysis of this student's learning style.`
      );
      if (detailResponse.content) analysis = detailResponse.content;
    }

    const recommendations = parsed.recommendations || [];

    // Save assessment
    const result = await pool.query(
      `INSERT INTO learning_style_assessments
       (user_id, visual_score, auditory_score, reading_writing_score, kinesthetic_score, dominant_style, ai_analysis, recommendations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, scores.visual, scores.auditory, scores.reading_writing, scores.kinesthetic,
       dominantStyle, analysis, JSON.stringify(recommendations)]
    );

    await pool.query('UPDATE users SET learning_style = $1 WHERE id = $2', [dominantStyle, req.user.id]);

    res.json({
      assessment: result.rows[0],
      scores,
      dominantStyle,
      analysis,
      recommendations
    });
  } catch (error) {
    console.error('Error in AI assessment:', error);
    res.status(500).json({ error: 'Failed to perform AI assessment' });
  }
});

app.get('/api/learning-style/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM learning_style_assessments WHERE user_id = $1 ORDER BY assessed_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching assessment history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ==================== AI QUIZ GENERATOR ====================

app.post('/api/quiz-generator/generate', authenticateToken, async (req, res) => {
  try {
    const { subject, topic, difficulty, questionCount = 5 } = req.body;

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Generate ${questionCount} multiple choice quiz questions about ${topic} in ${subject} at ${difficulty} difficulty level. Format each question as JSON with: question_text, options (array of 4 choices), correct_answer (the exact text of correct option), explanation. Return as a JSON array.` }],
      `You are an expert educational assessment designer who creates quizzes aligned with Bloom's Taxonomy. Create challenging but fair questions that genuinely test understanding.

**Question Design Principles:**
- Mix cognitive levels: recall, comprehension, application, and analysis
- Write clear, unambiguous question stems
- Create plausible distractors (wrong answers) that reflect common misconceptions
- Avoid "all of the above" or "none of the above" options
- Each question should test ONE concept clearly
- Explanations should teach — explain WHY the correct answer is right AND why common wrong answers are wrong

**JSON Format Requirements:**
- Return ONLY a valid JSON array, no surrounding text
- Each object must have: question_text, options (array of 4 strings), correct_answer (exact text matching one option), explanation
- Ensure correct_answer exactly matches one of the options strings`
    );

    let questions = [];
    try {
      const content = aiResponse.content || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Error parsing quiz questions:', e);
    }

    // Create quiz in database
    const quiz = await pool.query(
      `INSERT INTO quizzes (user_id, title, description, subject, topic, difficulty_level, time_limit_minutes, is_ai_generated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`,
      [req.user.id, `AI Generated: ${topic}`, `AI-generated quiz on ${topic}`, subject, topic, difficulty, questionCount * 2]
    );

    // Insert questions
    for (const q of questions) {
      await pool.query(
        `INSERT INTO quiz_questions (quiz_id, question_text, options, correct_answer, explanation, difficulty_level)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [quiz.rows[0].id, q.question_text, JSON.stringify(q.options), q.correct_answer, q.explanation, difficulty]
      );
    }

    res.json({
      quiz: quiz.rows[0],
      questions,
      message: 'Quiz generated successfully'
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// ==================== AI PROGRESS PREDICTOR ====================

app.post('/api/progress-predictor/predict', authenticateToken, async (req, res) => {
  try {
    const { subject, targetDate } = req.body;

    // Get user's performance data
    const performance = await pool.query(`
      SELECT metric_type, AVG(metric_value) as avg_value, COUNT(*) as count
      FROM performance_analytics
      WHERE user_id = $1 AND subject = $2
      GROUP BY metric_type
    `, [req.user.id, subject]);

    const studyTime = await pool.query(`
      SELECT SUM(duration_minutes) as total_minutes
      FROM study_sessions
      WHERE user_id = $1 AND subject = $2
    `, [req.user.id, subject]);

    const currentScore = performance.rows.find(p => p.metric_type === 'quiz_score')?.avg_value || 0;
    const totalStudyMinutes = studyTime.rows[0]?.total_minutes || 0;

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Student's current ${subject} performance: Quiz average ${currentScore}%, Total study time: ${totalStudyMinutes} minutes. Target date: ${targetDate}. Predict their likely score by target date and provide specific recommendations to improve. Include confidence level (0-100%) in your prediction.` }],
      `You are an educational data analyst and motivational learning coach. Provide data-driven predictions with an encouraging, forward-looking tone.

**Your Analysis Should Include:**
1. **Current Performance Assessment** — Honest evaluation of where the student stands
2. **Trend Analysis** — Is performance improving, stable, or declining? What patterns do you see?
3. **Predicted Outcome** — Realistic score prediction with confidence interval
4. **Key Factors** — What's driving current performance (study time, consistency, topic difficulty)
5. **Action Plan** — 3-5 specific, prioritized steps to improve:
   - Quick wins (things that can boost scores immediately)
   - Medium-term strategies (habits to build over weeks)
   - Long-term goals (mastery objectives)
6. **Motivational Framing** — Highlight progress already made and potential for growth

**Tone:** Be realistic but optimistic. Frame challenges as opportunities. Use data to inspire confidence, not anxiety.`
    );

    // Extract predicted score from AI response (rough estimate)
    const predictedScore = Math.min(100, Math.round(parseFloat(currentScore) + (totalStudyMinutes / 60) * 2));
    const confidence = Math.min(85, 50 + (performance.rows.length * 5));

    const result = await pool.query(
      `INSERT INTO progress_predictions
       (user_id, subject, current_score, predicted_score, prediction_date, target_date, confidence_level, ai_insights)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7) RETURNING *`,
      [req.user.id, subject, currentScore, predictedScore, targetDate, confidence, aiResponse.content || aiResponse.message]
    );

    res.json({
      prediction: result.rows[0],
      currentScore,
      predictedScore,
      confidence,
      insights: aiResponse.content || aiResponse.message,
      studyTimeHours: Math.round(totalStudyMinutes / 60)
    });
  } catch (error) {
    console.error('Error predicting progress:', error);
    res.status(500).json({ error: 'Failed to predict progress' });
  }
});

app.get('/api/progress-predictor/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM progress_predictions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching prediction history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ==================== AI CONCEPT EXPLAINER ====================

app.post('/api/concept-explainer/explain', authenticateToken, async (req, res) => {
  try {
    const { concept, subject, difficulty = 'intermediate' } = req.body;

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Explain the concept "${concept}" in ${subject} at a ${difficulty} level. Include:
      1. A clear definition
      2. Key points to understand
      3. 2-3 real-world examples
      4. A helpful analogy
      5. Related concepts to explore
      Format your response in clear sections.` }],
      `You are a master teacher renowned for making complex concepts accessible to any learner. You combine deep subject expertise with exceptional communication skills.

**Explanation Framework:**
1. **Prerequisites** — Briefly mention what the student should already know
2. **Core Definition** — Clear, jargon-free definition in 1-2 sentences
3. **The Big Idea** — Why this concept matters and where it fits in the bigger picture
4. **Step-by-Step Breakdown** — Break the concept into digestible components
5. **Analogy** — A vivid, relatable analogy that makes the abstract concrete
6. **Real-World Examples** — 2-3 examples showing the concept in action
7. **Common Misconceptions** — What students often get wrong and why
8. **Progressive Complexity** — Start simple, then add nuance for deeper understanding
9. **Related Concepts** — Connections to other topics worth exploring

**Style Guidelines:**
- Use "imagine..." and "think of it like..." to build mental models
- Bold key terms on first use
- Use analogies appropriate for the difficulty level
- End with a thought-provoking question to spark curiosity`
    );

    // Parse the response to extract structured data
    const content = aiResponse.content || aiResponse.message || '';

    const result = await pool.query(
      `INSERT INTO concept_explanations
       (user_id, concept_name, subject, explanation, difficulty_level)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, concept, subject, content, difficulty]
    );

    res.json({
      explanation: result.rows[0],
      content,
      concept,
      subject
    });
  } catch (error) {
    console.error('Error explaining concept:', error);
    res.status(500).json({ error: 'Failed to explain concept' });
  }
});

app.get('/api/concept-explainer/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM concept_explanations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching explanation history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ==================== AI STUDY SCHEDULE OPTIMIZER ====================

app.post('/api/study-schedule/optimize', authenticateToken, async (req, res) => {
  try {
    const { subjects, availableHours, goals, startDate, endDate } = req.body;

    // Get user's performance to prioritize weak subjects
    const performance = await pool.query(`
      SELECT subject, AVG(metric_value) as avg_score
      FROM performance_analytics
      WHERE user_id = $1 AND subject = ANY($2)
      GROUP BY subject
    `, [req.user.id, subjects]);

    const performanceData = performance.rows.map(p => `${p.subject}: ${Math.round(p.avg_score)}%`).join(', ');

    // Step 1: Get the schedule JSON from AI
    const scheduleResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Create an optimized weekly study schedule for a student.
      Subjects: ${subjects.join(', ')}
      Available hours per day: ${availableHours}
      Current performance: ${performanceData || 'No data yet'}
      Goals: ${goals || 'General improvement'}
      Duration: ${startDate} to ${endDate}

      Return ONLY a valid JSON object with days as keys (monday, tuesday, wednesday, thursday, friday, saturday, sunday) and arrays of study blocks. Each block should have: subject, time, duration (minutes), focus_topic.
      Example: {"monday": [{"subject": "Math", "time": "09:00-10:30", "duration": 90, "focus_topic": "Algebra review"}]}
      Only return JSON, no other text.` }],
      `You are an expert study schedule creator. Return ONLY valid JSON. No explanations, no markdown, just the JSON object. Prioritize subjects with lower scores. Include rest days with empty arrays. Never schedule more than ${availableHours} hours per day.`
    );

    let scheduleData = {};
    try {
      const content = scheduleResponse.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scheduleData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Create default schedule if parsing fails
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      scheduleData = {};
      days.forEach((day, i) => {
        scheduleData[day] = subjects.map((subj, j) => ({
          subject: subj,
          time: `${16 + j}:00-${17 + j}:00`,
          duration: 60,
          focus_topic: 'General review'
        }));
      });
    }

    // Step 2: Get study recommendations from AI
    const tipsResponse = await callOpenRouterAI(
      [{ role: 'user', content: `A student is studying these subjects: ${subjects.join(', ')}.
      Available hours per day: ${availableHours}. Goals: ${goals || 'General improvement'}.
      Current performance: ${performanceData || 'No data yet'}.
      Duration: ${startDate} to ${endDate}.

      Provide personalized study tips and recommendations including:
      1. How to prioritize weak subjects
      2. Best study techniques for each subject
      3. Break and rest strategies
      4. How to stay motivated over this period
      5. Specific daily habits to build` }],
      `You are an expert study coach who combines learning science with practical advice. Provide actionable, personalized recommendations. Be encouraging and specific. Do NOT include any JSON or schedule data — only tips and advice.`
    );

    const recommendations = tipsResponse.content || tipsResponse.message || '';

    const result = await pool.query(
      `INSERT INTO study_schedules
       (user_id, title, schedule_data, ai_optimized, optimization_notes, start_date, end_date)
       VALUES ($1, $2, $3, true, $4, $5, $6) RETURNING *`,
      [req.user.id, 'AI Optimized Schedule', JSON.stringify(scheduleData), recommendations, startDate, endDate]
    );

    res.json({
      schedule: result.rows[0],
      scheduleData,
      recommendations
    });
  } catch (error) {
    console.error('Error optimizing schedule:', error);
    res.status(500).json({ error: 'Failed to optimize schedule' });
  }
});

app.get('/api/study-schedule', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM study_schedules WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

app.delete('/api/study-schedule/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM study_schedules WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Schedule deleted' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// ==================== AI HOMEWORK HELPER ====================

app.get('/api/homework', authenticateToken, async (req, res) => {
  try {
    await sendPaginated(res, 'homework_assignments', req, ['title', 'description', 'subject'], ['subject', 'status'], ['user_id = $1'], [req.user.id]);
  } catch (error) {
    console.error('Error fetching homework:', error);
    res.status(500).json({ error: 'Failed to fetch homework' });
  }
});

// Homework help history (must be before :id route)
app.get('/api/homework/help-history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM homework_assignments WHERE user_id = $1 AND ai_help_content IS NOT NULL
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching help history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/api/homework/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM homework_assignments WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Homework not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching homework:', error);
    res.status(500).json({ error: 'Failed to fetch homework' });
  }
});

app.post('/api/homework', authenticateToken, async (req, res) => {
  try {
    const { title, subject, description, dueDate } = req.body;
    const result = await pool.query(
      `INSERT INTO homework_assignments (user_id, title, subject, description, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, title, subject, description, dueDate]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating homework:', error);
    res.status(500).json({ error: 'Failed to create homework' });
  }
});

app.put('/api/homework/:id', authenticateToken, async (req, res) => {
  try {
    const { title, subject, description, dueDate, status } = req.body;
    const result = await pool.query(
      `UPDATE homework_assignments
       SET title = COALESCE($1, title), subject = COALESCE($2, subject),
           description = COALESCE($3, description), due_date = COALESCE($4, due_date),
           status = COALESCE($5, status), updated_at = NOW()
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [title, subject, description, dueDate, status, req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating homework:', error);
    res.status(500).json({ error: 'Failed to update homework' });
  }
});

app.delete('/api/homework/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM homework_assignments WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Homework deleted' });
  } catch (error) {
    console.error('Error deleting homework:', error);
    res.status(500).json({ error: 'Failed to delete homework' });
  }
});

// Direct AI Homework Help (no assignment needed)
app.post('/api/homework/quick-help', authenticateToken, async (req, res) => {
  try {
    const { subject, question } = req.body;

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `I need help with my ${subject || 'school'} homework. My question: ${question}. Please provide guidance — help me learn and understand, not just get the answer.` }],
      `You are a supportive tutor who uses scaffolded learning and the Socratic method. Your goal is to help students LEARN, not just get answers.

**Your Approach:**
1. **Acknowledge the difficulty** — Validate that the problem is challenging
2. **Identify the concept** — Help the student understand what knowledge/skill is being tested
3. **Guide with questions** — Ask leading questions that point toward the solution
4. **Provide frameworks** — Give the student a problem-solving framework they can apply
5. **Offer partial insights** — Share enough to unblock them without doing the work
6. **Build confidence** — Remind them of what they already know that's relevant

**Important Rules:**
- NEVER give the complete answer directly
- Instead of "The answer is X", say "Think about what happens when..."
- Provide step-by-step guidance
- If the student is completely stuck, give ONE concrete step forward
- Celebrate small wins and progress`
    );

    // Generate hints
    const hintsResponse = await callOpenRouterAI(
      [{ role: 'user', content: `For this ${subject || 'school'} question: "${question}", provide 3 helpful hints that guide toward the solution without revealing it directly. Format as a JSON array of strings.` }],
      'Provide educational hints that guide learning without revealing complete answers. Each hint should progressively reveal more. Return ONLY a valid JSON array of strings.'
    );

    let hints = [];
    try {
      const hintsMatch = (hintsResponse.content || '').match(/\[[\s\S]*\]/);
      if (hintsMatch) hints = JSON.parse(hintsMatch[0]);
    } catch (e) {}

    // Save to DB
    try {
      await pool.query(
        `INSERT INTO homework_assignments (user_id, title, subject, description, ai_help_content, ai_hints, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'completed')`,
        [req.user.id, question.substring(0, 255), subject || 'General', question,
         aiResponse.content || aiResponse.message, JSON.stringify(hints)]
      );
    } catch (e) {
      console.error('Error saving quick help:', e);
    }

    res.json({
      help: aiResponse.content || aiResponse.message,
      hints,
      subject,
      question
    });
  } catch (error) {
    console.error('Error getting quick homework help:', error);
    res.status(500).json({ error: 'Failed to get help' });
  }
});

app.post('/api/homework/:id/help', authenticateToken, async (req, res) => {
  try {
    const { question } = req.body;

    const homework = await pool.query(
      'SELECT * FROM homework_assignments WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (homework.rows.length === 0) {
      return res.status(404).json({ error: 'Homework not found' });
    }

    const hw = homework.rows[0];

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `I need help with my ${hw.subject} homework: "${hw.title}". Assignment: ${hw.description}. My specific question: ${question}. Please provide guidance without giving the complete answer - help me learn.` }],
      `You are a supportive tutor who uses scaffolded learning and the Socratic method. Your goal is to help students LEARN, not just get answers.

**Your Approach:**
1. **Acknowledge the difficulty** — Validate that the problem is challenging
2. **Identify the concept** — Help the student understand what knowledge/skill the assignment tests
3. **Guide with questions** — Ask leading questions that point toward the solution
4. **Provide frameworks** — Give the student a problem-solving framework they can apply
5. **Offer partial insights** — Share enough to unblock them without doing the work
6. **Build confidence** — Remind them of what they already know that's relevant

**Important Rules:**
- NEVER give the complete answer directly
- Instead of "The answer is X", say "Think about what happens when..."
- Provide 1-2 guiding questions per response
- If the student is completely stuck, give ONE concrete step forward
- Celebrate small wins and progress`
    );

    // Generate hints
    const hintsResponse = await callOpenRouterAI(
      [{ role: 'user', content: `For this ${hw.subject} assignment about "${hw.title}", provide 3 helpful hints that guide toward the solution without revealing it directly. Format as a JSON array of strings.` }],
      'Provide educational hints that guide learning without revealing complete answers. Each hint should progressively reveal more, like a scaffolded learning path. Return ONLY a valid JSON array of strings.'
    );

    let hints = [];
    try {
      const hintsMatch = (hintsResponse.content || '').match(/\[[\s\S]*\]/);
      if (hintsMatch) hints = JSON.parse(hintsMatch[0]);
    } catch (e) {}

    // Save help content
    await pool.query(
      `UPDATE homework_assignments SET ai_help_content = $1, ai_hints = $2, updated_at = NOW() WHERE id = $3`,
      [aiResponse.content || aiResponse.message, JSON.stringify(hints), req.params.id]
    );

    res.json({
      help: aiResponse.content || aiResponse.message,
      hints,
      homework: hw
    });
  } catch (error) {
    console.error('Error getting homework help:', error);
    res.status(500).json({ error: 'Failed to get help' });
  }
});

// ==================== AI MATH TUTOR ====================

app.post('/api/math-tutor/solve', authenticateToken, async (req, res) => {
  try {
    const { problem, topic } = req.body;

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Solve this math problem step by step: ${problem}. Topic: ${topic || 'General'}.
      Provide:
      1. A clear step-by-step solution
      2. Explanation of each step
      3. The final answer highlighted
      4. One similar practice problem for the student` }],
      `You are an expert math tutor who makes mathematics intuitive and engaging. You believe every student can succeed in math with the right approach.

**Teaching Method:**
1. **Identify the concept** — Name the mathematical topic and relevant formulas/theorems
2. **Visual Representation** — Describe how to visualize the problem (number lines, graphs, diagrams)
3. **Step-by-Step Solution** — Show every step with clear notation and reasoning
4. **Real-World Connection** — Explain where this math appears in everyday life
5. **Common Pitfalls** — Highlight mistakes students typically make and how to avoid them
6. **Verification** — Show how to check the answer using a different method
7. **Practice Problem** — Provide a similar problem with the answer for self-testing

**Formatting:**
- Use → for step transitions
- Clearly label the final answer
- Group related steps together
- Use indentation for sub-steps`
    );

    // Save tutoring session
    const result = await pool.query(
      `INSERT INTO math_tutoring_sessions (user_id, topic, problem, step_by_step_solution)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, topic || 'General', problem, aiResponse.content || aiResponse.message]
    );

    res.json({
      session: result.rows[0],
      solution: aiResponse.content || aiResponse.message,
      problem
    });
  } catch (error) {
    console.error('Error in math tutor:', error);
    res.status(500).json({ error: 'Failed to solve problem' });
  }
});

app.post('/api/math-tutor/practice', authenticateToken, async (req, res) => {
  try {
    const { topic, difficulty, count = 5 } = req.body;

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Generate ${count} ${difficulty} level practice problems about ${topic}. For each problem provide: the problem statement, a hint, and the answer. Format as JSON array with objects containing: problem, hint, answer.` }],
      'Generate well-crafted math practice problems that progressively build skill. Each problem should test a specific concept. Hints should guide without revealing the answer. Return ONLY a valid JSON array with objects containing: problem, hint, answer.'
    );

    let problems = [];
    try {
      const jsonMatch = (aiResponse.content || '').match(/\[[\s\S]*\]/);
      if (jsonMatch) problems = JSON.parse(jsonMatch[0]);
    } catch (e) {}

    res.json({
      problems,
      topic,
      difficulty
    });
  } catch (error) {
    console.error('Error generating practice problems:', error);
    res.status(500).json({ error: 'Failed to generate problems' });
  }
});

app.get('/api/math-tutor/sessions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM math_tutoring_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching math sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ==================== AI HISTORY EXPLORER ====================

app.get('/api/history-explorer/events', async (req, res) => {
  try {
    await sendPaginated(res, 'historical_events', req, ['title', 'description', 'event_date'], ['era', 'region']);
  } catch (error) {
    console.error('Error fetching historical events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.get('/api/history-explorer/events/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM historical_events WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

app.post('/api/history-explorer/explore', authenticateToken, async (req, res) => {
  try {
    const { eventId, query } = req.body;

    let context = '';
    if (eventId) {
      const event = await pool.query('SELECT * FROM historical_events WHERE id = $1', [eventId]);
      if (event.rows.length > 0) {
        const e = event.rows[0];
        context = `Context: ${e.title} (${e.event_date}) - ${e.description}`;
      }
    }

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `${context}\n\nStudent's question about history: ${query}\n\nProvide an engaging, educational response. Include interesting facts, cause-and-effect relationships, and suggest related topics to explore.` }],
      `You are a passionate history educator who brings the past to life through vivid storytelling and critical analysis. History is not just dates and names — it's the story of humanity.

**Your Approach:**
1. **Narrative First** — Tell the story in an engaging, almost cinematic way before analyzing it
2. **Multiple Perspectives** — Present events from different viewpoints (rulers, common people, neighboring nations)
3. **Primary Sources** — Reference or quote relevant primary source documents when possible
4. **Cause and Effect Chains** — Show how events connect: what led to this? what did this lead to?
5. **Timeline Context** — Help students understand what else was happening in the world simultaneously
6. **Modern Relevance** — Draw parallels to contemporary events when appropriate
7. **Critical Thinking** — Encourage students to question, not just memorize: "Why did they make that choice?"

**Style:** Write like a great history documentary narrator — informative, dramatic where appropriate, and always educational.`
    );

    // Generate follow-up questions
    const followUpResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Based on this history discussion about "${query}", suggest 3 thought-provoking follow-up questions a curious student might ask. Format as JSON array of strings.` }],
      'Generate thought-provoking follow-up questions that encourage deeper historical analysis. Questions should prompt cause-effect thinking, comparison across eras, and critical evaluation of historical narratives. Return ONLY a valid JSON array of strings.'
    );

    let followUpQuestions = [];
    try {
      const match = (followUpResponse.content || '').match(/\[[\s\S]*\]/);
      if (match) followUpQuestions = JSON.parse(match[0]);
    } catch (e) {}

    // Save exploration
    const result = await pool.query(
      `INSERT INTO history_explorations (user_id, event_id, query, ai_response, follow_up_questions)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, eventId, query, aiResponse.content || aiResponse.message, JSON.stringify(followUpQuestions)]
    );

    res.json({
      exploration: result.rows[0],
      response: aiResponse.content || aiResponse.message,
      followUpQuestions
    });
  } catch (error) {
    console.error('Error exploring history:', error);
    res.status(500).json({ error: 'Failed to explore history' });
  }
});

app.get('/api/history-explorer/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT he.*, hev.title as event_title
       FROM history_explorations he
       LEFT JOIN historical_events hev ON he.event_id = hev.id
       WHERE he.user_id = $1
       ORDER BY he.created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching exploration history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ==================== AI SCIENCE LAB SIMULATOR ====================

app.get('/api/science-lab/experiments', async (req, res) => {
  try {
    await sendPaginated(res, 'science_experiments', req, ['title', 'description', 'subject', 'topic'], ['subject', 'difficulty_level']);
  } catch (error) {
    console.error('Error fetching experiments:', error);
    res.status(500).json({ error: 'Failed to fetch experiments' });
  }
});

app.get('/api/science-lab/experiments/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM science_experiments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Experiment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching experiment:', error);
    res.status(500).json({ error: 'Failed to fetch experiment' });
  }
});

app.post('/api/science-lab/simulate', authenticateToken, async (req, res) => {
  try {
    const { experimentId, userInputs } = req.body;

    const experiment = await pool.query('SELECT * FROM science_experiments WHERE id = $1', [experimentId]);

    if (experiment.rows.length === 0) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    const exp = experiment.rows[0];

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Simulate this science experiment: "${exp.title}"
      Description: ${exp.description}
      User's inputs/variables: ${JSON.stringify(userInputs)}
      Expected results: ${exp.expected_results}

      Provide a detailed simulation result including:
      1. What would happen step by step
      2. Observations the student would make
      3. Scientific explanation of the results
      4. Questions for the student to consider` }],
      `You are an experienced virtual science lab instructor who prioritizes both learning and safety. You make experiments come alive through detailed, sensory-rich descriptions.

**Simulation Response Structure:**
1. **Safety Reminder** — Start with relevant safety precautions for this type of experiment
2. **Hypothesis** — Help the student form a prediction before revealing results
3. **Step-by-Step Observations** — Describe what the student would see, hear, smell, and feel at each stage
4. **Data & Measurements** — Provide realistic quantitative data where applicable
5. **Scientific Explanation** — Explain the underlying science (molecular level, forces, reactions)
6. **Analysis Questions** — Pose 2-3 questions that promote deeper thinking about the results
7. **Real-World Applications** — Connect the experiment to real-world technology or phenomena
8. **Extensions** — Suggest how to modify the experiment to test new variables

**Style:** Be descriptive and vivid — help students "see" the experiment in their mind. Use precise scientific language but explain technical terms.`
    );

    // Save simulation
    const result = await pool.query(
      `INSERT INTO lab_simulations (user_id, experiment_id, user_inputs, ai_results)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, experimentId, JSON.stringify(userInputs), aiResponse.content || aiResponse.message]
    );

    res.json({
      simulation: result.rows[0],
      experiment: exp,
      results: aiResponse.content || aiResponse.message
    });
  } catch (error) {
    console.error('Error simulating experiment:', error);
    res.status(500).json({ error: 'Failed to simulate experiment' });
  }
});

app.get('/api/science-lab/simulations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ls.*, se.title as experiment_title, se.subject
      FROM lab_simulations ls
      LEFT JOIN science_experiments se ON ls.experiment_id = se.id
      WHERE ls.user_id = $1
      ORDER BY ls.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching simulations:', error);
    res.status(500).json({ error: 'Failed to fetch simulations' });
  }
});

// ==================== AI QUIZ GENERATOR HISTORY ====================

app.get('/api/quiz-generator/history', authenticateToken, async (req, res) => {
  try {
    const quizzes = await pool.query(
      `SELECT q.*,
        (SELECT json_agg(json_build_object('question_text', qq.question_text, 'options', qq.options, 'correct_answer', qq.correct_answer, 'explanation', qq.explanation))
         FROM quiz_questions qq WHERE qq.quiz_id = q.id) as questions
       FROM quizzes q
       WHERE q.user_id = $1 AND q.is_ai_generated = true
       ORDER BY q.created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json(quizzes.rows);
  } catch (error) {
    console.error('Error fetching quiz history:', error);
    res.status(500).json({ error: 'Failed to fetch quiz history' });
  }
});

// ==================== AI FLASHCARD GENERATOR HISTORY ====================

app.get('/api/flashcard-generator/history', authenticateToken, async (req, res) => {
  try {
    const decks = await pool.query(
      `SELECT fd.*,
        (SELECT json_agg(json_build_object('front_text', fc.front_text, 'back_text', fc.back_text))
         FROM flashcards fc WHERE fc.deck_id = fd.id) as cards
       FROM flashcard_decks fd
       WHERE fd.user_id = $1 AND fd.is_ai_generated = true
       ORDER BY fd.created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json(decks.rows);
  } catch (error) {
    console.error('Error fetching flashcard history:', error);
    res.status(500).json({ error: 'Failed to fetch flashcard history' });
  }
});

// ==================== AI FLASHCARD GENERATOR ====================

app.post('/api/flashcard-generator/generate', authenticateToken, async (req, res) => {
  try {
    const { topic, subject, cardCount = 10, difficulty } = req.body;

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Generate ${cardCount} flashcards about "${topic}" in ${subject} at ${difficulty || 'intermediate'} level. Each flashcard should have a clear question/term on the front and a concise answer/definition on the back. Format as JSON array with objects containing: front_text, back_text.` }],
      `You are an expert at creating effective flashcards based on learning science and memory research. Create cards that maximize retention.

**Flashcard Design Principles:**
- **One concept per card** — Each card tests exactly one piece of knowledge
- **Active recall** — Frame fronts as questions, not just terms (e.g., "What process converts glucose to ATP?" not just "Cellular respiration")
- **Context-rich backs** — Include a brief explanation, not just a one-word answer
- **Memory hooks** — Where possible, include mnemonics, visual descriptions, or associations
- **Progressive difficulty** — Order cards from foundational to advanced concepts
- **Connections** — Note how each concept relates to others in the topic

**JSON Format:** Return ONLY a valid JSON array. Each object must have front_text and back_text fields. No surrounding text.`
    );

    let cards = [];
    try {
      const jsonMatch = (aiResponse.content || '').match(/\[[\s\S]*\]/);
      if (jsonMatch) cards = JSON.parse(jsonMatch[0]);
    } catch (e) {}

    // Create deck
    const deck = await pool.query(
      `INSERT INTO flashcard_decks (user_id, title, description, subject, topic, card_count, is_ai_generated)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
      [req.user.id, `AI: ${topic}`, `AI-generated flashcards on ${topic}`, subject, topic, cards.length]
    );

    // Insert cards
    for (const card of cards) {
      await pool.query(
        `INSERT INTO flashcards (deck_id, front_text, back_text) VALUES ($1, $2, $3)`,
        [deck.rows[0].id, card.front_text, card.back_text]
      );
    }

    res.json({
      deck: deck.rows[0],
      cards,
      message: 'Flashcard deck generated successfully'
    });
  } catch (error) {
    console.error('Error generating flashcards:', error);
    res.status(500).json({ error: 'Failed to generate flashcards' });
  }
});

// ==================== DELETE ROUTES FOR CRUD ====================

app.delete('/api/learning-paths/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM learning_paths WHERE id = $1', [req.params.id]);
    res.json({ message: 'Learning path deleted' });
  } catch (error) {
    console.error('Error deleting learning path:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.put('/api/learning-paths/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, subject, difficultyLevel, estimatedHours } = req.body;
    const result = await pool.query(
      `UPDATE learning_paths SET title = COALESCE($1, title), description = COALESCE($2, description),
       subject = COALESCE($3, subject), difficulty_level = COALESCE($4, difficulty_level),
       estimated_hours = COALESCE($5, estimated_hours) WHERE id = $6 RETURNING *`,
      [title, description, subject, difficultyLevel, estimatedHours, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating learning path:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.delete('/api/study-materials/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM study_materials WHERE id = $1', [req.params.id]);
    res.json({ message: 'Study material deleted' });
  } catch (error) {
    console.error('Error deleting study material:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.put('/api/study-materials/:id', authenticateToken, async (req, res) => {
  try {
    const { title, content, subject, topic, materialType, difficultyLevel } = req.body;
    const result = await pool.query(
      `UPDATE study_materials SET title = COALESCE($1, title), content = COALESCE($2, content),
       subject = COALESCE($3, subject), topic = COALESCE($4, topic),
       material_type = COALESCE($5, material_type), difficulty_level = COALESCE($6, difficulty_level)
       WHERE id = $7 RETURNING *`,
      [title, content, subject, topic, materialType, difficultyLevel, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating study material:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.delete('/api/quizzes/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM quizzes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Quiz deleted' });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.delete('/api/flashcard-decks/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM flashcard_decks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Flashcard deck deleted' });
  } catch (error) {
    console.error('Error deleting flashcard deck:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.delete('/api/video-lessons/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM video_lessons WHERE id = $1', [req.params.id]);
    res.json({ message: 'Video lesson deleted' });
  } catch (error) {
    console.error('Error deleting video lesson:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.delete('/api/vocabulary/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM vocabulary_words WHERE id = $1', [req.params.id]);
    res.json({ message: 'Vocabulary word deleted' });
  } catch (error) {
    console.error('Error deleting vocabulary:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.delete('/api/goals/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM goals WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Goal deleted' });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.delete('/api/essays/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM essays WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Essay deleted' });
  } catch (error) {
    console.error('Error deleting essay:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.put('/api/quizzes/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, subject, topic, difficultyLevel, timeLimitMinutes } = req.body;
    const result = await pool.query(
      `UPDATE quizzes SET title = COALESCE($1, title), description = COALESCE($2, description),
       subject = COALESCE($3, subject), topic = COALESCE($4, topic),
       difficulty_level = COALESCE($5, difficulty_level), time_limit_minutes = COALESCE($6, time_limit_minutes)
       WHERE id = $7 RETURNING *`,
      [title, description, subject, topic, difficultyLevel, timeLimitMinutes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.put('/api/practice-problems/:id', authenticateToken, async (req, res) => {
  try {
    const { title, problemText, subject, topic, difficultyLevel, solution } = req.body;
    const result = await pool.query(
      `UPDATE practice_problems SET title = COALESCE($1, title), problem_text = COALESCE($2, problem_text),
       subject = COALESCE($3, subject), topic = COALESCE($4, topic),
       difficulty_level = COALESCE($5, difficulty_level), solution = COALESCE($6, solution)
       WHERE id = $7 RETURNING *`,
      [title, problemText, subject, topic, difficultyLevel, solution, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating practice problem:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.delete('/api/practice-problems/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM practice_problems WHERE id = $1', [req.params.id]);
    res.json({ message: 'Practice problem deleted' });
  } catch (error) {
    console.error('Error deleting practice problem:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.put('/api/flashcard-decks/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, subject, topic } = req.body;
    const result = await pool.query(
      `UPDATE flashcard_decks SET title = COALESCE($1, title), description = COALESCE($2, description),
       subject = COALESCE($3, subject), topic = COALESCE($4, topic)
       WHERE id = $5 RETURNING *`,
      [title, description, subject, topic, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating flashcard deck:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.put('/api/video-lessons/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, subject, topic, videoUrl, durationMinutes, instructor } = req.body;
    const result = await pool.query(
      `UPDATE video_lessons SET title = COALESCE($1, title), description = COALESCE($2, description),
       subject = COALESCE($3, subject), topic = COALESCE($4, topic),
       video_url = COALESCE($5, video_url), duration_minutes = COALESCE($6, duration_minutes),
       instructor = COALESCE($7, instructor) WHERE id = $8 RETURNING *`,
      [title, description, subject, topic, videoUrl, durationMinutes, instructor, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating video lesson:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.put('/api/vocabulary/:id', authenticateToken, async (req, res) => {
  try {
    const { word, definition, partOfSpeech, exampleSentence, difficultyLevel } = req.body;
    const result = await pool.query(
      `UPDATE vocabulary_words SET word = COALESCE($1, word), definition = COALESCE($2, definition),
       part_of_speech = COALESCE($3, part_of_speech), example_sentence = COALESCE($4, example_sentence),
       difficulty_level = COALESCE($5, difficulty_level) WHERE id = $6 RETURNING *`,
      [word, definition, partOfSpeech, exampleSentence, difficultyLevel, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vocabulary:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.put('/api/writing-prompts/:id', authenticateToken, async (req, res) => {
  try {
    const { title, promptText, genre, difficultyLevel, wordCountTarget } = req.body;
    const result = await pool.query(
      `UPDATE writing_prompts SET title = COALESCE($1, title), prompt_text = COALESCE($2, prompt_text),
       genre = COALESCE($3, genre), difficulty_level = COALESCE($4, difficulty_level),
       word_count_target = COALESCE($5, word_count_target) WHERE id = $6 RETURNING *`,
      [title, promptText, genre, difficultyLevel, wordCountTarget, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating writing prompt:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.delete('/api/writing-prompts/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM writing_prompts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Writing prompt deleted' });
  } catch (error) {
    console.error('Error deleting writing prompt:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.put('/api/math-problems/:id', authenticateToken, async (req, res) => {
  try {
    const { problemText, problemType, difficultyLevel, finalAnswer, topic } = req.body;
    const result = await pool.query(
      `UPDATE math_problems SET problem_text = COALESCE($1, problem_text), problem_type = COALESCE($2, problem_type),
       difficulty_level = COALESCE($3, difficulty_level), final_answer = COALESCE($4, final_answer),
       topic = COALESCE($5, topic) WHERE id = $6 RETURNING *`,
      [problemText, problemType, difficultyLevel, finalAnswer, topic, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating math problem:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.delete('/api/math-problems/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM math_problems WHERE id = $1', [req.params.id]);
    res.json({ message: 'Math problem deleted' });
  } catch (error) {
    console.error('Error deleting math problem:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ==================== BULK DELETE ENDPOINTS ====================

const bulkDeleteHandler = (table, ownerColumn = null) => async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    let query = `DELETE FROM ${table} WHERE id = ANY($1)`;
    const params = [ids];
    if (ownerColumn) {
      query += ` AND ${ownerColumn} = $2`;
      params.push(req.user.id);
    }
    const result = await pool.query(query, params);
    res.json({ deleted: result.rowCount });
  } catch (error) {
    console.error(`Bulk delete ${table} error:`, error);
    res.status(500).json({ error: 'Bulk delete failed' });
  }
};

app.post('/api/learning-paths/bulk-delete', authenticateToken, bulkDeleteHandler('learning_paths'));
app.post('/api/study-materials/bulk-delete', authenticateToken, bulkDeleteHandler('study_materials'));
app.post('/api/quizzes/bulk-delete', authenticateToken, bulkDeleteHandler('quizzes'));
app.post('/api/practice-problems/bulk-delete', authenticateToken, bulkDeleteHandler('practice_problems'));
app.post('/api/flashcard-decks/bulk-delete', authenticateToken, bulkDeleteHandler('flashcard_decks'));
app.post('/api/video-lessons/bulk-delete', authenticateToken, bulkDeleteHandler('video_lessons'));
app.post('/api/vocabulary/bulk-delete', authenticateToken, bulkDeleteHandler('vocabulary_words'));
app.post('/api/goals/bulk-delete', authenticateToken, bulkDeleteHandler('goals', 'user_id'));
app.post('/api/essays/bulk-delete', authenticateToken, bulkDeleteHandler('essays', 'user_id'));
app.post('/api/homework/bulk-delete', authenticateToken, bulkDeleteHandler('homework_assignments', 'user_id'));
app.post('/api/writing-prompts/bulk-delete', authenticateToken, bulkDeleteHandler('writing_prompts'));
app.post('/api/math-problems/bulk-delete', authenticateToken, bulkDeleteHandler('math_problems'));
app.post('/api/achievements/bulk-delete', authenticateToken, bulkDeleteHandler('achievements'));

// ==================== CSV EXPORT ENDPOINTS ====================

const csvExportHandler = (table, columns, ownerColumn = null) => async (req, res) => {
  try {
    let query = `SELECT ${columns.join(', ')} FROM ${table}`;
    const params = [];
    if (ownerColumn) {
      query += ` WHERE ${ownerColumn} = $1`;
      params.push(req.user.id);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);

    const header = columns.join(',');
    const rows = result.rows.map(row => columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    }).join(','));

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${table}_export.csv"`);
    res.send(csv);
  } catch (error) {
    console.error(`CSV export ${table} error:`, error);
    res.status(500).json({ error: 'Export failed' });
  }
};

app.get('/api/learning-paths/export/csv', authenticateToken, csvExportHandler('learning_paths', ['title', 'description', 'subject', 'difficulty_level', 'estimated_hours', 'created_at']));
app.get('/api/study-materials/export/csv', authenticateToken, csvExportHandler('study_materials', ['title', 'subject', 'topic', 'material_type', 'difficulty_level', 'created_at']));
app.get('/api/quizzes/export/csv', authenticateToken, csvExportHandler('quizzes', ['title', 'subject', 'topic', 'difficulty_level', 'time_limit_minutes', 'created_at']));
app.get('/api/vocabulary/export/csv', authenticateToken, csvExportHandler('vocabulary_words', ['word', 'definition', 'part_of_speech', 'example_sentence', 'difficulty_level']));
app.get('/api/goals/export/csv', authenticateToken, csvExportHandler('goals', ['title', 'description', 'category', 'status', 'progress_percentage', 'target_date'], 'user_id'));
app.get('/api/essays/export/csv', authenticateToken, csvExportHandler('essays', ['title', 'subject', 'word_count', 'status', 'ai_score', 'created_at'], 'user_id'));
app.get('/api/homework/export/csv', authenticateToken, csvExportHandler('homework_assignments', ['title', 'subject', 'description', 'due_date', 'status'], 'user_id'));
app.get('/api/math-problems/export/csv', authenticateToken, csvExportHandler('math_problems', ['problem_text', 'problem_type', 'difficulty_level', 'final_answer', 'topic']));

// ==================== PDF EXPORT ENDPOINTS ====================

const pdfExportHandler = (table, titleField, contentFields, ownerColumn = null) => async (req, res) => {
  try {
    if (!PDFDocument) return res.status(501).json({ error: 'PDF export not available' });
    const allCols = [titleField, ...contentFields].join(', ');
    let query = `SELECT ${allCols} FROM ${table}`;
    const params = [];
    if (ownerColumn) {
      query += ` WHERE ${ownerColumn} = $1`;
      params.push(req.user.id);
    }
    query += ' ORDER BY created_at DESC LIMIT 50';
    const result = await pool.query(query, params);

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${table}_export.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).text(`${table.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Export`, { align: 'center' });
    doc.moveDown();

    for (const row of result.rows) {
      doc.fontSize(14).text(String(row[titleField] || 'Untitled'), { underline: true });
      for (const field of contentFields) {
        if (row[field]) {
          doc.fontSize(10).text(`${field.replace(/_/g, ' ')}: ${String(row[field]).substring(0, 500)}`);
        }
      }
      doc.moveDown();
      if (doc.y > 700) doc.addPage();
    }

    doc.end();
  } catch (error) {
    console.error(`PDF export ${table} error:`, error);
    res.status(500).json({ error: 'PDF export failed' });
  }
};

app.get('/api/essays/export/pdf', authenticateToken, pdfExportHandler('essays', 'title', ['subject', 'content', 'ai_score', 'ai_feedback'], 'user_id'));
app.get('/api/goals/export/pdf', authenticateToken, pdfExportHandler('goals', 'title', ['description', 'category', 'status', 'progress_percentage'], 'user_id'));
app.get('/api/study-materials/export/pdf', authenticateToken, pdfExportHandler('study_materials', 'title', ['subject', 'topic', 'content']));
app.get('/api/homework/export/pdf', authenticateToken, pdfExportHandler('homework_assignments', 'title', ['subject', 'description', 'due_date', 'status'], 'user_id'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Tutor Backend running on port ${PORT}`);
});
