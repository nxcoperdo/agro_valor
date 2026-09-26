const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepository = require('../repositories/userRepository');

const COOKIE_NAME = 'av_token';

function login(username, password, { remember = false } = {}) {
  const user = userRepository.findByUsername(username);
  if (!user) return null;

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return null;

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    env.jwtSecret,
    { expiresIn: remember ? env.jwtRememberExpiresIn : env.jwtExpiresIn }
  );

  return { token, user: { id: user.id, username: user.username, role: user.role } };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch (err) {
    return null;
  }
}

module.exports = { login, verifyToken, COOKIE_NAME };
