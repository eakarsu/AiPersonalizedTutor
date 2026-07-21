'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    const result = await pool.query('SELECT id,email,password_hash,full_name,role,grade_level,learning_style FROM users WHERE lower(email)=$1 LIMIT 1', [String(email).trim().toLowerCase()]);
    const user = result.rows[0];
    if (!user || !await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
    const safeUser = { id: user.id, email: user.email, name: user.full_name, role: user.role, gradeLevel: user.grade_level, learningStyle: user.learning_style };
    return res.json({ token: jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' }), user: safeUser });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id,email,full_name,role,grade_level,learning_style FROM users WHERE id=$1 LIMIT 1', [req.user.id]);
    if (!result.rows.length) return res.status(401).json({ error: 'Account no longer exists' });
    const user = result.rows[0];
    return res.json({ id: user.id, email: user.email, name: user.full_name, role: user.role, gradeLevel: user.grade_level, learningStyle: user.learning_style });
  } catch (error) {
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
});

module.exports = router;
