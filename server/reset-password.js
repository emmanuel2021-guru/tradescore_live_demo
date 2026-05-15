// One-shot dev utility to reset a user's password without going through email flow.
// Usage:
//   node reset-password.js <email> <new-password>
//
// Example:
//   node reset-password.js funmi@fashionfabrics.ng newpass123

import bcrypt from 'bcryptjs';
import db from './db.js';

const [, , email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.error('Usage: node reset-password.js <email> <new-password>');
  process.exit(1);
}
if (newPassword.length < 6) {
  console.error('Password must be at least 6 characters.');
  process.exit(1);
}

const user = db.prepare('SELECT id, email, first_name, last_name FROM users WHERE email = ?').get(email);
if (!user) {
  console.error(`No user found with email: ${email}`);
  console.log('\nExisting users in this database:');
  const all = db.prepare('SELECT email FROM users').all();
  if (!all.length) console.log('  (none)');
  else all.forEach(u => console.log('  ' + u.email));
  process.exit(1);
}

const hash = bcrypt.hashSync(newPassword, 10);
db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

console.log(`Password reset for ${user.first_name} ${user.last_name} (${user.email}).`);
console.log('You can now log in with the new password.');
