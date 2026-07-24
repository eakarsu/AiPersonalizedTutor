'use strict';
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

async function main() {
  if (process.env.BOOTSTRAP_ACKNOWLEDGEMENT !== 'create-initial-admin') throw new Error('Explicit bootstrap acknowledgement is required.');
  const email = String(process.env.PROVISION_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.PROVISION_ADMIN_PASSWORD || '');
  const name = String(process.env.PROVISION_ADMIN_NAME || '').trim();
  if (!email || !name || password.length < 12) throw new Error('Admin email, name, and a 12+ character password are required.');
  await pool.query(`INSERT INTO users(email,password_hash,full_name,role,email_verified) VALUES($1,$2,$3,'admin',true)
    ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,full_name=EXCLUDED.full_name,role='admin',email_verified=true,updated_at=NOW()`,
    [email, await bcrypt.hash(password, 12), name]);
  console.log('Tutor administrator provisioned.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
