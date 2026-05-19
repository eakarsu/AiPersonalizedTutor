const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
let ipKeyGeneratorHelper = null;
try { ipKeyGeneratorHelper = require('express-rate-limit').ipKeyGenerator; } catch (_) {}
const multer = require('multer');
const { body, validationResult } = require('express-validator');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Startup validation — fail fast on missing critical env vars
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET not set. Set it in your .env file before starting the server.');
  process.exit(1);
}

// Resend email client (optional — gracefully degraded if key missing)
let resendClient = null;
try {
  const { Resend } = require('resend');
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
} catch (e) {
  console.warn('Resend not available:', e.message);
}

let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }

// ==================== EMAIL HELPERS ====================

async function sendPasswordResetEmail(email, token, resetUrl) {
  if (!resendClient) {
    console.warn('Resend not configured — password reset email not sent to', email);
    return;
  }
  await resendClient.emails.send({
    from: process.env.EMAIL_FROM || 'AI Tutor <noreply@aitutor.app>',
    to: email,
    subject: 'Reset your AI Tutor password',
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your AI Tutor account.</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
      <p>If you did not request this reset, you can safely ignore this email.</p>
      <hr/>
      <small>Token (for API use): ${token}</small>
    `
  });
}

async function sendEmailVerificationEmail(email, token, verifyUrl) {
  if (!resendClient) {
    console.warn('Resend not configured — verification email not sent to', email);
    return;
  }
  await resendClient.emails.send({
    from: process.env.EMAIL_FROM || 'AI Tutor <noreply@aitutor.app>',
    to: email,
    subject: 'Verify your AI Tutor email address',
    html: `
      <h2>Welcome to AI Tutor!</h2>
      <p>Please verify your email address to activate your account.</p>
      <p><a href="${verifyUrl}" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Verify Email</a></p>
      <p>This link expires in 24 hours.</p>
      <hr/>
      <small>Token (for API use): ${token}</small>
    `
  });
}

// ==================== PROMPT CONTEXT LIMITER ====================

/**
 * Truncate JSON-serialised data to stay within a safe prompt character budget.
 * Returns the JSON string, trimmed to maxChars if needed.
 */
function limitContext(data, maxChars = 6000) {
  const full = JSON.stringify(data);
  if (full.length <= maxChars) return full;
  // For arrays, slice until we fit; for other types just truncate the string.
  if (Array.isArray(data)) {
    let slice = data;
    while (slice.length > 1) {
      slice = slice.slice(0, Math.floor(slice.length * 0.75));
      const candidate = JSON.stringify(slice);
      if (candidate.length <= maxChars) {
        return candidate + ` /* truncated — ${data.length - slice.length} items omitted */`;
      }
    }
  }
  return full.slice(0, maxChars) + '…';
}

// Multer — store uploads in memory (base64 or buffer), max 10 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const pool = require('./config/database');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CORS allowlist — restrict to ALLOWED_ORIGINS env (comma-separated). Falls back to localhost dev.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3601,http://127.0.0.1:3601,http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);                   // server-to-server / curl
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many auth requests, try again later' } });
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests, try again later' } });

// Per-user AI rate limiter: 20 calls per hour, keyed by JWT user id (or IP fallback)
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    if (req.user?.id) return `user:${req.user.id}`;
    if (ipKeyGeneratorHelper) return ipKeyGeneratorHelper(req, res);
    return req.ip || 'unknown';
  },
  message: { error: 'AI hourly limit reached (20/hour). Please wait before making more AI requests.' },
});
app.use('/api/auth/', authLimiter);
app.use('/api/', generalLimiter);

// Per-user AI rate limit registration is moved below `authenticateToken`
// definition to avoid a temporal dead zone reference.
const AI_PATH_PREFIXES = [
  '/api/ai/',
  '/api/essays/',                  // /:id/grade
  '/api/writing-assistant/',
  '/api/learning-style/ai-assess',
  '/api/quiz-generator/generate',
  '/api/progress-predictor/predict',
  '/api/concept-explainer/explain',
  '/api/study-schedule/optimize',
  '/api/homework/quick-help',
  '/api/homework/:id/help',
  '/api/math-tutor/solve',
  '/api/math-tutor/practice',
  '/api/history-explorer/explore',
  '/api/science-lab/simulate',
  '/api/flashcard-generator/generate',
  '/api/spaced-repetition/',
  '/api/adaptive-quiz/',
  '/api/parent-dashboard/',
  '/api/voice-tutor/',
  '/api/math-photo-solver',
];
// (registration done after authenticateToken is defined; see below)

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

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
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

// Now that authenticateToken is defined, register per-user AI rate limit on
// known AI-heavy path prefixes. authenticateToken populates req.user; the
// limiter then keys on req.user.id for accurate per-user throttling.
AI_PATH_PREFIXES.forEach((p) => app.use(p, authenticateToken, aiRateLimiter));

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

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const verifyUrl = `${appUrl}/verify-email?token=${verifyToken}`;
    try {
      await sendEmailVerificationEmail(user.email, verifyToken, verifyUrl);
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr.message);
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });

    // Return verificationToken in dev (when Resend not configured) so the user can verify manually
    const regResponse = { user, token };
    if (!resendClient) regResponse.verificationToken = verifyToken;
    res.json(regResponse);
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

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });

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

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
    try {
      await sendPasswordResetEmail(email, resetToken, resetUrl);
    } catch (emailErr) {
      console.error('Failed to send password reset email:', emailErr.message);
    }

    // In dev without Resend, return token directly so it's still usable
    const responsePayload = { message: 'If that email exists, a reset link has been sent' };
    if (!resendClient) responsePayload.resetToken = resetToken;
    res.json(responsePayload);
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

// ==================== AI LEARNING-STYLE CONTENT RECOMMENDATIONS ====================

// POST /api/ai/learning-style-content-recommend
// Body: { subject, topic?, difficulty?, content_kinds? }
// Uses the user's most recent learning_style_results (or `dominant_style`/`scores`
// passed in the body if no result exists) to recommend specific content items
// (videos, articles, podcasts, hands-on exercises, quizzes) tailored to their
// VARK style. Returns 503 when OPENROUTER_API_KEY is unset.
app.post('/api/ai/learning-style-content-recommend', authenticateToken, async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
      return res.status(503).json({ error: 'AI not configured: OPENROUTER_API_KEY is missing' });
    }

    const { subject, topic, difficulty, content_kinds } = req.body || {};
    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ error: 'subject is required' });
    }

    let scores = null;
    let dominantStyle = (req.body && req.body.dominant_style) || null;

    // Look up the user's most recent learning style result
    try {
      const lsRes = await pool.query(
        'SELECT visual_score, auditory_score, reading_writing_score, kinesthetic_score, dominant_style FROM learning_style_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [req.user.id]
      );
      if (lsRes.rows.length > 0) {
        const row = lsRes.rows[0];
        scores = {
          visual: row.visual_score,
          auditory: row.auditory_score,
          reading_writing: row.reading_writing_score,
          kinesthetic: row.kinesthetic_score
        };
        dominantStyle = dominantStyle || row.dominant_style;
      }
    } catch (e) {
      // table may not exist in some envs; continue with body-provided values
    }

    // Allow caller to provide scores directly (useful before the user has a stored result)
    if (!scores && req.body && req.body.scores && typeof req.body.scores === 'object') {
      scores = {
        visual: Number(req.body.scores.visual) || 0,
        auditory: Number(req.body.scores.auditory) || 0,
        reading_writing: Number(req.body.scores.reading_writing) || 0,
        kinesthetic: Number(req.body.scores.kinesthetic) || 0
      };
      if (!dominantStyle) {
        dominantStyle = Object.entries(scores).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
      }
    }

    if (!dominantStyle) {
      return res.status(400).json({
        error: 'No learning style on file for this user. Take the assessment at /learning-style or include "dominant_style" / "scores" in the request body.'
      });
    }

    const allowedKinds = ['video', 'article', 'podcast', 'hands_on', 'quiz', 'flashcards', 'interactive'];
    const kinds = Array.isArray(content_kinds) && content_kinds.length > 0
      ? content_kinds.filter(k => allowedKinds.includes(k))
      : allowedKinds;

    const systemPrompt = `You are a learning-content curator and instructional designer. Recommend specific, real-world content tailored to a student's VARK learning style. Return ONLY valid JSON in this shape:
{
  "subject": "...",
  "topic": "...",
  "dominant_style": "visual|auditory|reading_writing|kinesthetic",
  "rationale": "<1-2 sentences on why these picks fit the style>",
  "recommendations": [
    {
      "title": "...",
      "kind": "video|article|podcast|hands_on|quiz|flashcards|interactive",
      "why_it_fits_style": "...",
      "estimated_time_minutes": <number>,
      "difficulty": "beginner|intermediate|advanced",
      "url_or_search_query": "<URL if you know it, otherwise a recommended search query>"
    }
  ],
  "study_plan": [
    { "step": <number>, "action": "...", "duration_minutes": <number> }
  ]
}
Provide 6-8 recommendations. If kinds are restricted, only return those kinds.`;

    const userPrompt = `Student profile:
- Subject: ${subject}
- Topic: ${topic || 'general'}
- Difficulty: ${difficulty || 'mixed'}
- Dominant VARK style: ${dominantStyle}
- Style scores: ${scores ? JSON.stringify(scores) : 'unknown'}
- Allowed content kinds: ${kinds.join(', ')}

Recommend tailored learning content and a brief study plan.`;

    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: userPrompt }],
      systemPrompt
    );

    if (aiResponse.error) {
      return res.status(502).json({ error: aiResponse.message || 'AI service error' });
    }

    let parsed = null;
    try {
      // strip markdown fences just in case
      const cleaned = (aiResponse.content || '').replace(/^```(?:json)?\s*/g, '').replace(/```\s*$/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (_e) {
      // fall through; raw will be returned
    }

    res.json({
      subject,
      topic: topic || null,
      dominant_style: dominantStyle,
      scores,
      content_kinds: kinds,
      raw: aiResponse.content,
      parsed
    });
  } catch (error) {
    console.error('Error in /api/ai/learning-style-content-recommend:', error);
    res.status(500).json({ error: 'Failed to generate content recommendations' });
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
    const answersContext = limitContext(answers, 3000);
    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Based on these learning style scores: Visual=${scores.visual}, Auditory=${scores.auditory}, Reading/Writing=${scores.reading_writing}, Kinesthetic=${scores.kinesthetic}. The dominant style is ${dominantStyle}. Answer data (truncated if large): ${answersContext}. Provide a brief personalized analysis (2-3 paragraphs) with specific study recommendations for this learning style.` }],
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

    const perfSummary = limitContext(performance.rows, 3000);
    const aiResponse = await callOpenRouterAI(
      [{ role: 'user', content: `Student's current ${subject} performance: Quiz average ${currentScore}%, Total study time: ${totalStudyMinutes} minutes. Performance breakdown: ${perfSummary}. Target date: ${targetDate}. Predict their likely score by target date and provide specific recommendations to improve. Include confidence level (0-100%) in your prediction.` }],
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

    const performanceData = limitContext(performance.rows.map(p => `${p.subject}: ${Math.round(p.avg_score)}%`).join(', '), 2000);

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
        const descSnippet = e.description ? e.description.substring(0, 1500) : '';
        context = limitContext(`Context: ${e.title} (${e.event_date}) - ${descSnippet}`, 2000);
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
      User's inputs/variables: ${limitContext(userInputs, 2000)}
      Expected results: ${exp.expected_results ? exp.expected_results.substring(0, 1000) : ''}

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

// ==================== PHOTO-BASED MATH SOLVER ====================

/**
 * POST /api/math/solve-photo
 * Accepts either:
 *   - multipart/form-data with field "image" (file upload), OR
 *   - application/json with field "imageBase64" (base64 string, optionally prefixed with data URI)
 * Uses a vision-capable model to extract and solve each math problem in the image.
 */
app.post('/api/math/solve-photo', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    let base64Image = null;
    let mimeType = 'image/jpeg';

    if (req.file) {
      // Multipart upload
      base64Image = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype || 'image/jpeg';
    } else if (req.body && req.body.imageBase64) {
      // JSON body with base64
      const raw = req.body.imageBase64;
      const dataUriMatch = raw.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUriMatch) {
        mimeType = dataUriMatch[1];
        base64Image = dataUriMatch[2];
      } else {
        base64Image = raw;
      }
    }

    if (!base64Image) {
      return res.status(400).json({ error: 'Provide an image via multipart "image" field or JSON "imageBase64" field' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
      return res.status(500).json({ error: 'OpenRouter API key not configured' });
    }

    // Use a vision-capable model
    const visionModel = process.env.VISION_MODEL || 'anthropic/claude-3.5-sonnet';

    const systemPrompt = 'You are a math tutor. Analyze this homework/worksheet image and solve each problem step-by-step. Show your work clearly.';
    const userMessage = {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Image}` }
        },
        {
          type: 'text',
          text: 'Please identify every math problem visible in this image and solve each one step-by-step. Return your answer as a JSON object with key "problems" — an array where each element has: question (string), steps (array of strings), answer (string), explanation (string). Only return JSON, no surrounding text.'
        }
      ]
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Personalized Tutor'
      },
      body: JSON.stringify({
        model: visionModel,
        messages: [
          { role: 'system', content: systemPrompt },
          userMessage
        ],
        max_tokens: 4096
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Vision AI error' });
    }

    let rawContent = data.choices[0].message.content || '';
    // Strip code fences
    rawContent = rawContent.replace(/^```(?:json)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();

    let problems = [];
    try {
      const parsed = JSON.parse(rawContent);
      problems = parsed.problems || parsed || [];
    } catch (parseErr) {
      // If JSON parsing fails, return the raw AI response wrapped in a single problem
      problems = [{ question: 'Parsed from image', steps: [], answer: rawContent, explanation: '' }];
    }

    // Persist to math_tutoring_sessions
    let sessionId = null;
    try {
      const sessionResult = await pool.query(
        `INSERT INTO math_tutoring_sessions (user_id, topic, problem, step_by_step_solution)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          req.user.id,
          'Photo Math Solver',
          `[Photo upload — ${problems.length} problem(s) detected]`,
          JSON.stringify(problems)
        ]
      );
      sessionId = sessionResult.rows[0].id;
    } catch (dbErr) {
      console.error('Error saving photo math session:', dbErr);
    }

    res.json({ problems, sessionId });
  } catch (error) {
    console.error('Error in /api/math/solve-photo:', error);
    res.status(500).json({ error: 'Failed to process math photo' });
  }
});

// ==================== SPACED REPETITION (SM-2) ====================

/**
 * Ensure the three SM-2 columns exist on user_flashcard_progress.
 * Called once at startup — safe to run on every start (IF NOT EXISTS semantics).
 */
async function ensureSpacedRepetitionColumns() {
  const alterStatements = [
    `ALTER TABLE user_flashcard_progress ADD COLUMN IF NOT EXISTS next_review_date TIMESTAMP`,
    `ALTER TABLE user_flashcard_progress ADD COLUMN IF NOT EXISTS ease_factor FLOAT DEFAULT 2.5`,
    `ALTER TABLE user_flashcard_progress ADD COLUMN IF NOT EXISTS interval_days INTEGER DEFAULT 1`
  ];
  for (const sql of alterStatements) {
    try {
      await pool.query(sql);
    } catch (e) {
      // Column already exists or table missing — not fatal
    }
  }
}
ensureSpacedRepetitionColumns();

/**
 * SM-2 algorithm.
 * @param {number} quality — 0..5 rating (0–2 = failed, 3–5 = passed)
 * @param {number} currentEaseFactor
 * @param {number} currentInterval — days
 * @param {number} repetitions — how many times reviewed successfully in a row
 * @returns {{ interval, easeFactor, repetitions, nextReviewDate }}
 */
function sm2(quality, currentEaseFactor = 2.5, currentInterval = 1, repetitions = 0) {
  let interval;
  let easeFactor = currentEaseFactor;
  let reps = repetitions;

  if (quality >= 3) {
    // Correct response
    if (reps === 0) {
      interval = 1;
    } else if (reps === 1) {
      interval = 6;
    } else {
      interval = Math.round(currentInterval * easeFactor);
    }
    reps += 1;
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  } else {
    // Failed — reset
    interval = 1;
    reps = 0;
    // ease factor stays the same on failure (some variants lower it; keeping simple)
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return { interval, easeFactor, repetitions: reps, nextReviewDate };
}

/**
 * POST /api/flashcards/:id/review
 * Body: { quality: 0-5 }
 * Updates SM-2 state for the authenticated user's progress on this flashcard.
 */
app.post('/api/flashcards/:id/review', authenticateToken, async (req, res) => {
  try {
    const { quality } = req.body;
    const flashcardId = req.params.id;

    if (quality === undefined || quality === null || quality < 0 || quality > 5) {
      return res.status(400).json({ error: 'quality must be a number between 0 and 5' });
    }

    // Upsert progress row if it doesn't exist yet
    await pool.query(
      `INSERT INTO user_flashcard_progress (user_id, flashcard_id, confidence_level, times_reviewed, last_reviewed_at, ease_factor, interval_days)
       VALUES ($1, $2, 0, 0, NULL, 2.5, 1)
       ON CONFLICT (user_id, flashcard_id) DO NOTHING`,
      [req.user.id, flashcardId]
    );

    // Fetch current SM-2 state
    const existing = await pool.query(
      `SELECT ease_factor, interval_days, times_reviewed FROM user_flashcard_progress
       WHERE user_id = $1 AND flashcard_id = $2`,
      [req.user.id, flashcardId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Flashcard not found' });
    }

    const row = existing.rows[0];
    const currentEF = parseFloat(row.ease_factor) || 2.5;
    const currentInterval = parseInt(row.interval_days) || 1;
    const repetitions = quality >= 3 ? (parseInt(row.times_reviewed) || 0) : 0;

    const { interval, easeFactor, nextReviewDate } = sm2(quality, currentEF, currentInterval, repetitions);

    const updated = await pool.query(
      `UPDATE user_flashcard_progress
       SET confidence_level = $1,
           times_reviewed = times_reviewed + 1,
           last_reviewed_at = NOW(),
           ease_factor = $2,
           interval_days = $3,
           next_review_date = $4
       WHERE user_id = $5 AND flashcard_id = $6
       RETURNING *`,
      [Math.min(5, quality), easeFactor, interval, nextReviewDate, req.user.id, flashcardId]
    );

    res.json({
      progress: updated.rows[0],
      nextReviewDate,
      intervalDays: interval,
      easeFactor
    });
  } catch (error) {
    console.error('Error in POST /api/flashcards/:id/review:', error);
    res.status(500).json({ error: 'Failed to record flashcard review' });
  }
});

/**
 * GET /api/flashcards/due
 * Returns flashcards due for review today (next_review_date <= NOW() or never reviewed).
 */
app.get('/api/flashcards/due', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, ufp.confidence_level, ufp.times_reviewed, ufp.last_reviewed_at,
              ufp.ease_factor, ufp.interval_days, ufp.next_review_date,
              fd.title as deck_title, fd.subject
       FROM flashcards f
       JOIN flashcard_decks fd ON f.deck_id = fd.id
       LEFT JOIN user_flashcard_progress ufp ON ufp.flashcard_id = f.id AND ufp.user_id = $1
       WHERE fd.user_id = $1
         AND (ufp.next_review_date IS NULL OR ufp.next_review_date <= NOW())
       ORDER BY COALESCE(ufp.next_review_date, '1970-01-01') ASC
       LIMIT 50`,
      [req.user.id]
    );

    res.json({
      due: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error in GET /api/flashcards/due:', error);
    res.status(500).json({ error: 'Failed to fetch due flashcards' });
  }
});

// ====================================================================
// NEW FEATURE: Spaced Repetition (SM-2 algorithm) on flashcards
// SM-2 reference: https://en.wikipedia.org/wiki/SuperMemo
// ====================================================================

/**
 * Apply one SM-2 update step to a card given a quality grade (0..5).
 * 0/1/2 = wrong → reset; 3-5 = right.
 * Returns { repetitions, intervalDays, easeFactor }
 */
function sm2Step({ repetitions, intervalDays, easeFactor }, quality) {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let ef = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ef < 1.3) ef = 1.3;

  let reps = repetitions;
  let interval = intervalDays;
  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(intervalDays * ef);
  }
  return { repetitions: reps, intervalDays: interval, easeFactor: ef };
}

// GET /api/spaced-repetition/due — flashcards due now for the user
app.get('/api/spaced-repetition/due', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const result = await pool.query(
      `SELECT f.id AS flashcard_id, f.front_text, f.back_text, fd.title AS deck_title,
              s.repetitions, s.interval_days, s.ease_factor, s.next_review_at, s.last_quality
         FROM flashcards f
         JOIN flashcard_decks fd ON fd.id = f.deck_id
         LEFT JOIN sr_card_state s ON s.flashcard_id = f.id AND s.user_id = $1
         WHERE fd.user_id = $1
           AND (s.next_review_at IS NULL OR s.next_review_at <= NOW())
         ORDER BY COALESCE(s.next_review_at, '1970-01-01'::timestamp) ASC
         LIMIT $2`,
      [req.user.id, limit]
    );
    res.json({ due: result.rows, count: result.rows.length });
  } catch (e) {
    console.error('SR due error:', e);
    res.status(500).json({ error: 'Failed to fetch due cards' });
  }
});

// POST /api/spaced-repetition/review — submit a quality grade for a card
app.post(
  '/api/spaced-repetition/review',
  authenticateToken,
  body('flashcardId').isUUID().withMessage('flashcardId must be a UUID'),
  body('quality').isInt({ min: 0, max: 5 }).withMessage('quality must be 0..5'),
  validate,
  async (req, res) => {
    try {
      const { flashcardId, quality } = req.body;
      // Verify the card belongs to a deck owned by the user
      const own = await pool.query(
        `SELECT f.id FROM flashcards f
           JOIN flashcard_decks fd ON fd.id = f.deck_id
          WHERE f.id = $1 AND fd.user_id = $2`,
        [flashcardId, req.user.id]
      );
      if (own.rows.length === 0) return res.status(404).json({ error: 'Card not found' });

      const cur = await pool.query(
        `SELECT repetitions, interval_days, ease_factor
           FROM sr_card_state WHERE user_id = $1 AND flashcard_id = $2`,
        [req.user.id, flashcardId]
      );
      const state = cur.rows[0] || { repetitions: 0, interval_days: 1, ease_factor: 2.5 };
      const next = sm2Step(
        {
          repetitions: state.repetitions,
          intervalDays: state.interval_days,
          easeFactor: parseFloat(state.ease_factor),
        },
        quality
      );
      const nextReview = new Date(Date.now() + next.intervalDays * 24 * 60 * 60 * 1000);

      const upserted = await pool.query(
        `INSERT INTO sr_card_state (user_id, flashcard_id, repetitions, interval_days,
                                    ease_factor, next_review_at, last_reviewed_at, last_quality)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
         ON CONFLICT (user_id, flashcard_id) DO UPDATE
           SET repetitions = EXCLUDED.repetitions,
               interval_days = EXCLUDED.interval_days,
               ease_factor = EXCLUDED.ease_factor,
               next_review_at = EXCLUDED.next_review_at,
               last_reviewed_at = NOW(),
               last_quality = EXCLUDED.last_quality
         RETURNING *`,
        [req.user.id, flashcardId, next.repetitions, next.intervalDays, next.easeFactor, nextReview, quality]
      );
      res.json({ state: upserted.rows[0] });
    } catch (e) {
      console.error('SR review error:', e);
      res.status(500).json({ error: 'Failed to record review' });
    }
  }
);

// GET /api/spaced-repetition/stats — aggregate stats for the user
app.get('/api/spaced-repetition/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE next_review_at <= NOW()) AS due_now,
         COUNT(*) FILTER (WHERE next_review_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours') AS due_24h,
         COUNT(*) AS total_cards,
         AVG(ease_factor)::float AS avg_ease
         FROM sr_card_state WHERE user_id = $1`,
      [req.user.id]
    );
    res.json(stats.rows[0]);
  } catch (e) {
    console.error('SR stats error:', e);
    res.status(500).json({ error: 'Failed to fetch SR stats' });
  }
});

// ====================================================================
// NEW FEATURE: Adaptive Quiz — difficulty scales to per-topic confidence
// ====================================================================
function difficultyForConfidence(c) {
  if (c < 35) return 'easy';
  if (c < 70) return 'medium';
  return 'hard';
}

// POST /api/adaptive-quiz/next — generate the next question one notch up/down
app.post(
  '/api/adaptive-quiz/next',
  authenticateToken,
  body('subject').notEmpty(),
  body('topic').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { subject, topic } = req.body;
      const cur = await pool.query(
        `SELECT confidence FROM topic_confidence WHERE user_id = $1 AND subject = $2 AND topic = $3`,
        [req.user.id, subject, topic]
      );
      const confidence = cur.rows[0]?.confidence ?? 50;
      const difficulty = difficultyForConfidence(parseFloat(confidence));

      const aiRaw = await callOpenRouterAI(
        [
          {
            role: 'user',
            content: `Generate ONE multiple-choice question on subject "${subject}", topic "${topic}", at difficulty "${difficulty}". Return JSON: { "questionText": string, "options": ["A","B","C","D"], "correctAnswer": "A|B|C|D", "explanation": string }. Output raw JSON only.`,
          },
        ],
        'You are an expert tutor crafting adaptive quiz questions.'
      );
      if (aiRaw.error) return res.status(500).json({ error: aiRaw.message });
      let parsed;
      try { parsed = JSON.parse(aiRaw.content); } catch { parsed = null; }
      if (!parsed) return res.status(500).json({ error: 'AI returned malformed JSON' });

      const inserted = await pool.query(
        `INSERT INTO adaptive_quiz_questions (user_id, subject, topic, difficulty,
            question_text, options, correct_answer, explanation, ai_results)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          req.user.id,
          subject,
          topic,
          difficulty,
          parsed.questionText,
          JSON.stringify(parsed.options || []),
          parsed.correctAnswer,
          parsed.explanation || '',
          JSON.stringify({ raw: aiRaw.content }),
        ]
      );
      res.json({ question: inserted.rows[0], confidence: parseFloat(confidence), difficulty });
    } catch (e) {
      console.error('Adaptive next error:', e);
      res.status(500).json({ error: 'Failed to generate adaptive question' });
    }
  }
);

// POST /api/adaptive-quiz/answer — submit answer; updates topic_confidence with EMA
app.post(
  '/api/adaptive-quiz/answer',
  authenticateToken,
  body('questionId').isUUID(),
  body('userAnswer').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { questionId, userAnswer } = req.body;
      const q = await pool.query(
        `SELECT * FROM adaptive_quiz_questions WHERE id = $1 AND user_id = $2`,
        [questionId, req.user.id]
      );
      if (q.rows.length === 0) return res.status(404).json({ error: 'Question not found' });
      const row = q.rows[0];
      const isCorrect = String(row.correct_answer).trim().toLowerCase() === String(userAnswer).trim().toLowerCase();

      // EMA: new = old + alpha * (target - old). target = 100 if correct, 0 if not.
      const alpha = 0.25;
      const upserted = await pool.query(
        `INSERT INTO topic_confidence (user_id, subject, topic, confidence, correct_count,
                                        incorrect_count, last_difficulty, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (user_id, subject, topic) DO UPDATE SET
           confidence = topic_confidence.confidence + $8 * ($9 - topic_confidence.confidence),
           correct_count = topic_confidence.correct_count + CASE WHEN $10 THEN 1 ELSE 0 END,
           incorrect_count = topic_confidence.incorrect_count + CASE WHEN $10 THEN 0 ELSE 1 END,
           last_difficulty = $7,
           updated_at = NOW()
         RETURNING *`,
        [
          req.user.id,
          row.subject,
          row.topic,
          isCorrect ? 65 : 35,
          isCorrect ? 1 : 0,
          isCorrect ? 0 : 1,
          row.difficulty,
          alpha,
          isCorrect ? 100 : 0,
          isCorrect,
        ]
      );
      res.json({
        correct: isCorrect,
        explanation: row.explanation,
        confidence: parseFloat(upserted.rows[0].confidence),
      });
    } catch (e) {
      console.error('Adaptive answer error:', e);
      res.status(500).json({ error: 'Failed to record answer' });
    }
  }
);

// GET /api/adaptive-quiz/confidence — paginated topic confidence list
app.get('/api/adaptive-quiz/confidence', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT * FROM topic_confidence WHERE user_id = $1
          ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
        [req.user.id, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM topic_confidence WHERE user_id = $1`, [req.user.id]),
    ]);
    const total = parseInt(count.rows[0].count);
    res.json({
      data: rows.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch confidence list' });
  }
});

// ====================================================================
// NEW FEATURE: Parent / Teacher Dashboard
// ====================================================================

// POST /api/parent-dashboard/link — link guardian to a student by email
app.post(
  '/api/parent-dashboard/link',
  authenticateToken,
  body('studentEmail').isEmail(),
  body('relationship').isIn(['parent', 'teacher', 'tutor']),
  validate,
  async (req, res) => {
    try {
      const { studentEmail, relationship } = req.body;
      const student = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [studentEmail]);
      if (student.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
      if (student.rows[0].id === req.user.id) return res.status(400).json({ error: 'Cannot link yourself' });
      const link = await pool.query(
        `INSERT INTO guardian_links (guardian_user_id, student_user_id, relationship)
         VALUES ($1, $2, $3)
         ON CONFLICT (guardian_user_id, student_user_id) DO UPDATE SET relationship = EXCLUDED.relationship
         RETURNING *`,
        [req.user.id, student.rows[0].id, relationship]
      );
      res.json({ link: link.rows[0] });
    } catch (e) {
      console.error('Link guardian error:', e);
      res.status(500).json({ error: 'Failed to link student' });
    }
  }
);

// GET /api/parent-dashboard/students — list students linked to the current guardian
app.get('/api/parent-dashboard/students', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.grade_level, gl.relationship, gl.created_at AS linked_at
         FROM guardian_links gl
         JOIN users u ON u.id = gl.student_user_id
         WHERE gl.guardian_user_id = $1
         ORDER BY u.full_name`,
      [req.user.id]
    );
    res.json({ students: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// GET /api/parent-dashboard/student/:id/summary — read-only progress summary for a student
app.get('/api/parent-dashboard/student/:id/summary', authenticateToken, async (req, res) => {
  try {
    const link = await pool.query(
      `SELECT 1 FROM guardian_links WHERE guardian_user_id = $1 AND student_user_id = $2`,
      [req.user.id, req.params.id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not linked to this student' });

    const studentId = req.params.id;
    const [quizzes, sessions, essays, sr] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS attempts, AVG(score)::float AS avg_score
           FROM quiz_attempts WHERE user_id = $1 AND completed_at >= NOW() - INTERVAL '30 days'`,
        [studentId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(duration_minutes), 0)::int AS minutes_30d
           FROM study_sessions WHERE user_id = $1 AND started_at >= NOW() - INTERVAL '30 days'`,
        [studentId]
      ),
      pool.query(
        `SELECT COUNT(*) AS essays_30d, AVG(ai_score)::float AS avg_essay_score
           FROM essays WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
        [studentId]
      ),
      pool.query(
        `SELECT COUNT(*) AS due, AVG(ease_factor)::float AS avg_ease
           FROM sr_card_state WHERE user_id = $1`,
        [studentId]
      ),
    ]);

    res.json({
      quizzes: quizzes.rows[0],
      study: sessions.rows[0],
      essays: essays.rows[0],
      spacedRepetition: sr.rows[0],
    });
  } catch (e) {
    console.error('Student summary error:', e);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// POST /api/parent-dashboard/student/:id/weekly-letter — AI-generated weekly progress letter
app.post('/api/parent-dashboard/student/:id/weekly-letter', authenticateToken, async (req, res) => {
  try {
    const link = await pool.query(
      `SELECT 1 FROM guardian_links WHERE guardian_user_id = $1 AND student_user_id = $2`,
      [req.user.id, req.params.id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not linked to this student' });

    const studentId = req.params.id;
    // Compute week range (Mon..Sun) for "previous full week"
    const now = new Date();
    const day = now.getDay() || 7;       // Mon=1..Sun=7
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - day);
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const metrics = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM quiz_attempts WHERE user_id = $1 AND completed_at BETWEEN $2 AND $3) AS quizzes,
         (SELECT COALESCE(AVG(score),0)::float FROM quiz_attempts WHERE user_id = $1 AND completed_at BETWEEN $2 AND $3) AS avg_quiz,
         (SELECT COALESCE(SUM(duration_minutes),0)::int FROM study_sessions WHERE user_id = $1 AND started_at BETWEEN $2 AND $3) AS minutes,
         (SELECT COUNT(*)::int FROM essays WHERE user_id = $1 AND created_at BETWEEN $2 AND $3) AS essays`,
      [studentId, weekStart, weekEnd]
    );
    const m = metrics.rows[0];
    const studentRow = await pool.query('SELECT full_name FROM users WHERE id = $1', [studentId]);
    const studentName = studentRow.rows[0]?.full_name || 'the student';

    const aiRaw = await callOpenRouterAI(
      [
        {
          role: 'user',
          content: `Write a warm, parent-friendly weekly progress letter for ${studentName} covering the week
of ${weekStart.toDateString()} – ${weekEnd.toDateString()}.

Metrics:
- Quizzes taken: ${m.quizzes}
- Average quiz score: ${m.avg_quiz?.toFixed(1) || '0'}
- Study minutes: ${m.minutes}
- Essays submitted: ${m.essays}

Return HTML only (no preamble) — 3 short paragraphs: highlights, areas to grow, suggestion for next week.`,
        },
      ],
      'You write supportive, specific weekly progress letters for parents and teachers.'
    );
    if (aiRaw.error) return res.status(500).json({ error: aiRaw.message });

    const stored = await pool.query(
      `INSERT INTO progress_letters (student_user_id, week_start, week_end, letter_html, metrics, ai_results)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (student_user_id, week_start) DO UPDATE SET
         letter_html = EXCLUDED.letter_html,
         metrics = EXCLUDED.metrics,
         ai_results = EXCLUDED.ai_results
       RETURNING *`,
      [studentId, weekStart, weekEnd, aiRaw.content, JSON.stringify(m), JSON.stringify({ raw: aiRaw.content })]
    );
    res.json({ letter: stored.rows[0] });
  } catch (e) {
    console.error('Weekly letter error:', e);
    res.status(500).json({ error: 'Failed to generate weekly letter' });
  }
});

// ====================================================================
// NEW FEATURE: SSE Streaming chat — /api/ai/stream-chat
// ====================================================================
app.post('/api/ai/stream-chat', authenticateToken, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sseWrite = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
      sseWrite('error', { error: 'OpenRouter API key not configured' });
      return res.end();
    }
    const { messages, systemPrompt } = req.body;
    if (!Array.isArray(messages)) {
      sseWrite('error', { error: 'messages array required' });
      return res.end();
    }

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Personalized Tutor',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt || 'You are a helpful AI tutor.' },
          ...messages,
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      sseWrite('error', { error: `Upstream error ${upstream.status}: ${text.slice(0, 200)}` });
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const data = t.slice(5).trim();
        if (data === '[DONE]') break;
        try {
          const j = JSON.parse(data);
          const tk = j?.choices?.[0]?.delta?.content || '';
          if (tk) sseWrite('token', { token: tk });
        } catch {}
      }
    }
    sseWrite('done', {});
    res.end();
  } catch (e) {
    console.error('stream-chat error:', e);
    try { res.write(`event: error\ndata: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`); } catch {}
    res.end();
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Version endpoint
app.get('/api/version', (req, res) => {
  res.json({
    name: 'ai-tutor-backend',
    version: process.env.npm_package_version || '1.0.0',
    node: process.version,
    uptimeSec: Math.round(process.uptime()),
  });
});

// =============================================================================
// Apply pass 5 — deferred-backlog endpoints.
//
// All additive. Existing routes/schemas untouched. New tables use
// CREATE TABLE IF NOT EXISTS. AI/integration stubs return 503 +
// `missing: <ENV>` when their gating env vars are unset.
//
// Categories:
//  - NEEDS-PRODUCT-DECISION:
//      Parent dashboard scope (`/api/parent/insights`):
//        PRODUCT-DECISION default scope = "summary": last 7d activity, recent
//        quiz scores, last-active timestamp. No raw transcripts (privacy).
//      Voice tutor (`/api/ai/voice/session-start`):
//        PRODUCT-DECISION default = WebRTC offer placeholder; real provider
//        gated on `VOICE_PROVIDER` (deepgram | elevenlabs | openai-realtime).
//  - NEEDS-CREDS:
//      LMS Canvas: CANVAS_API_TOKEN, CANVAS_BASE_URL
//      LMS Schoology: SCHOOLOGY_CONSUMER_KEY, SCHOOLOGY_CONSUMER_SECRET
//      Mobile push APNS: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY
//      Mobile push FCM:  FCM_SERVER_KEY
//  - MECHANICAL:
//      `/api/ai/study-plan-week` — generates a week-long study plan from
//      the user's goals + recent quiz history (returns 503 without API key).
// =============================================================================

(async function ensureBacklogTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parent_links (
        id SERIAL PRIMARY KEY,
        parent_user_id INTEGER NOT NULL,
        student_user_id INTEGER NOT NULL,
        relationship VARCHAR(40) DEFAULT 'guardian',
        scope VARCHAR(40) DEFAULT 'summary',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (parent_user_id, student_user_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS voice_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        provider VARCHAR(40),
        status VARCHAR(20) DEFAULT 'pending',
        room_token TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lms_links (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        provider VARCHAR(40) NOT NULL,
        external_user_id VARCHAR(160),
        access_token TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (user_id, provider)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_devices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        platform VARCHAR(20) NOT NULL,
        token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (token)
      )
    `);
  } catch (e) {
    console.warn('[apply5] backlog table init skipped:', e.message);
  }
})();

// --- NEEDS-PRODUCT-DECISION: Parent dashboard insights ---
// Default scope = "summary" (no transcripts). To expand scope we'd add a
// scope=full mode with explicit consent flow.
app.post('/api/parent/link', authenticateToken, async (req, res) => {
  try {
    const { student_user_id, relationship = 'guardian', scope = 'summary' } = req.body || {};
    if (!student_user_id) return res.status(400).json({ error: 'student_user_id required' });
    const r = await pool.query(
      `INSERT INTO parent_links (parent_user_id, student_user_id, relationship, scope)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (parent_user_id, student_user_id) DO UPDATE
         SET relationship = EXCLUDED.relationship, scope = EXCLUDED.scope
       RETURNING *`,
      [req.user.id, student_user_id, relationship, scope]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/parent/insights', authenticateToken, async (req, res) => {
  try {
    const linksRes = await pool.query(
      `SELECT student_user_id, scope FROM parent_links WHERE parent_user_id = $1`,
      [req.user.id]
    );
    if (!linksRes.rows.length) {
      return res.json({ children: [], note: 'No linked students. POST /api/parent/link first.' });
    }
    const out = [];
    for (const link of linksRes.rows) {
      const studentId = link.student_user_id;
      let recentQuizzes = { rows: [] };
      let lastActive = null;
      try {
        recentQuizzes = await pool.query(
          `SELECT id, score, total_questions, completed_at
             FROM quiz_attempts
            WHERE user_id = $1 AND completed_at IS NOT NULL
            ORDER BY completed_at DESC LIMIT 5`,
          [studentId]
        );
      } catch (e) { /* table may differ */ }
      try {
        const la = await pool.query(
          `SELECT MAX(completed_at) AS last_active FROM quiz_attempts WHERE user_id = $1`,
          [studentId]
        );
        lastActive = la.rows[0]?.last_active || null;
      } catch (e) {}
      out.push({
        student_user_id: studentId,
        scope: link.scope,
        last_active: lastActive,
        recent_quizzes: recentQuizzes.rows,
      });
    }
    res.json({ children: out, scope_default: 'summary' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- NEEDS-CREDS: LMS Canvas/Schoology link ---
app.post('/api/lms/canvas/link', authenticateToken, async (req, res) => {
  const missing = [];
  if (!process.env.CANVAS_API_TOKEN) missing.push('CANVAS_API_TOKEN');
  if (!process.env.CANVAS_BASE_URL) missing.push('CANVAS_BASE_URL');
  if (missing.length) {
    return res.status(503).json({ error: 'Canvas LMS not configured', missing, provider: 'canvas' });
  }
  res.status(503).json({ error: 'Canvas LMS adapter not yet implemented', provider: 'canvas' });
});

app.post('/api/lms/schoology/link', authenticateToken, async (req, res) => {
  const missing = [];
  if (!process.env.SCHOOLOGY_CONSUMER_KEY) missing.push('SCHOOLOGY_CONSUMER_KEY');
  if (!process.env.SCHOOLOGY_CONSUMER_SECRET) missing.push('SCHOOLOGY_CONSUMER_SECRET');
  if (missing.length) {
    return res.status(503).json({ error: 'Schoology LMS not configured', missing, provider: 'schoology' });
  }
  res.status(503).json({ error: 'Schoology LMS adapter not yet implemented', provider: 'schoology' });
});

// --- NEEDS-CREDS: Mobile push registration + dispatch ---
app.post('/api/push/register', authenticateToken, async (req, res) => {
  try {
    const { platform, token } = req.body || {};
    if (!platform || !token) return res.status(400).json({ error: 'platform, token required' });
    await pool.query(
      `INSERT INTO push_devices (user_id, platform, token)
       VALUES ($1,$2,$3) ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id`,
      [req.user.id, platform, token]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/push/notify', authenticateToken, async (req, res) => {
  const provider = process.env.PUSH_PROVIDER;
  const missing = [];
  if (!provider) missing.push('PUSH_PROVIDER');
  if (provider === 'apns') {
    if (!process.env.APNS_KEY_ID) missing.push('APNS_KEY_ID');
    if (!process.env.APNS_TEAM_ID) missing.push('APNS_TEAM_ID');
    if (!process.env.APNS_PRIVATE_KEY) missing.push('APNS_PRIVATE_KEY');
  } else if (provider === 'fcm') {
    if (!process.env.FCM_SERVER_KEY) missing.push('FCM_SERVER_KEY');
  }
  if (missing.length) {
    return res.status(503).json({ error: 'Push not configured', missing, provider: provider || 'unset' });
  }
  res.status(503).json({ error: 'Push dispatcher not yet implemented', provider });
});

// --- NEEDS-PRODUCT-DECISION: Voice tutor session start ---
// PRODUCT-DECISION: gate real voice provider on VOICE_PROVIDER. Without it,
// return a placeholder room token so the FE can render the UI shell.
app.post('/api/ai/voice/session-start', authenticateToken, async (req, res) => {
  const provider = process.env.VOICE_PROVIDER;
  if (!provider) {
    return res.status(503).json({
      error: 'Voice tutor not configured',
      missing: ['VOICE_PROVIDER'],
      supported: ['deepgram', 'elevenlabs', 'openai-realtime'],
    });
  }
  if (provider === 'deepgram' && !process.env.DEEPGRAM_API_KEY) {
    return res.status(503).json({ error: 'DEEPGRAM_API_KEY missing', missing: ['DEEPGRAM_API_KEY'], provider });
  }
  if (provider === 'elevenlabs' && !process.env.ELEVENLABS_API_KEY) {
    return res.status(503).json({ error: 'ELEVENLABS_API_KEY missing', missing: ['ELEVENLABS_API_KEY'], provider });
  }
  if (provider === 'openai-realtime' && !process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY missing', missing: ['OPENAI_API_KEY'], provider });
  }
  try {
    const r = await pool.query(
      `INSERT INTO voice_sessions (user_id, provider, status, room_token)
       VALUES ($1,$2,'pending',$3) RETURNING id, provider, status`,
      [req.user.id, provider, 'placeholder-' + Date.now()]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- MECHANICAL: weekly study plan via existing AI helper ---
app.post('/api/ai/study-plan-week', authenticateToken, async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'AI not configured: OPENROUTER_API_KEY is missing', missing: ['OPENROUTER_API_KEY'] });
  }
  try {
    const { subject = 'general', goal_minutes_per_day = 30, focus_areas = [] } = req.body || {};
    let recentQuizzes = { rows: [] };
    try {
      recentQuizzes = await pool.query(
        `SELECT subject, score, total_questions, completed_at FROM quiz_attempts
          WHERE user_id = $1 AND completed_at IS NOT NULL
          ORDER BY completed_at DESC LIMIT 10`,
        [req.user.id]
      );
    } catch (e) { /* schema may differ */ }
    const prompt = `Build a 7-day study plan for subject "${subject}". Daily budget ${goal_minutes_per_day} min.
Recent quizzes: ${JSON.stringify(recentQuizzes.rows)}.
Focus: ${focus_areas.join(', ') || 'auto'}.
Return STRICT JSON: {"plan":[{"day":"Mon","minutes":30,"topics":[],"resources":[]}],"weekly_goal":"..."}`;
    const aiResponse = await callOpenRouterAI([{ role: 'user', content: prompt }],
      'You are an academic planner. Return only valid JSON.');
    let parsed = null;
    try { parsed = JSON.parse(aiResponse.content || aiResponse); } catch {
      parsed = { raw: aiResponse.content || aiResponse };
    }
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server

// === Custom Feature Mounts (batch_06) ===
app.use('/api/cf-adaptive-quiz-engine', require('./routes/customFeat01_AdaptiveQuizEngine'));
app.use('/api/cf-parent-insights', require('./routes/customFeat02_ParentInsights'));
app.use('/api/cf-content-recommendation', require('./routes/customFeat03_ContentRecommendation'));
app.use('/api/cf-automated-tutoring', require('./routes/customFeat04_AutomatedTutoring'));
app.use('/api/cf-progress-prediction', require('./routes/customFeat05_ProgressPrediction'));


// === Batch 06 Gaps & Frontend Mounts ===
app.use('/api/gap-no-teacher', require('./routes/gapFeat_no_teacher'));
app.use('/api/gap-no-curriculum', require('./routes/gapFeat_no_curriculum'));
app.use('/api/gap-no-peer', require('./routes/gapFeat_no_peer'));
app.use('/api/gap-no-dedicated-routes-directory-all-routes-inline', require('./routes/gapFeat_no_dedicated_routes_directory_all_routes_inline'));
app.use('/api/gap-limited-frontend-only-3-pages-despite-rich-backend', require('./routes/gapFeat_limited_frontend_only_3_pages_despite_rich_backend'));
app.use('/api/gap-no-real-lms-integration-canvas-blackboard-adapter', require('./routes/gapFeat_no_real_lms_integration_canvas_blackboard_adapter'));
app.use('/api/gap-no-payment-billing-for-parent-subscriptions', require('./routes/gapFeat_no_payment_billing_for_parent_subscriptions'));
app.use('/api/gap-no-webhooks', require('./routes/gapFeat_no_webhooks'));
app.use('/api/gap-no-audit-logging-visible', require('./routes/gapFeat_no_audit_logging_visible'));
app.use('/api/gap-limited-rbac-student-parent-teacher-separation-unc', require('./routes/gapFeat_limited_rbac_student_parent_teacher_separation_unc'));

// === Custom Views (Tutor Views — 2 viz + 2 non-viz) ===
app.use('/api/custom-views', require('./routes/customViews'));

app.listen(PORT, () => {
  console.log(`AI Tutor Backend running on port ${PORT}`);
});
