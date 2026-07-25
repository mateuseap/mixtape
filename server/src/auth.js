import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export const COOKIE_NAME = 'mixtape_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function createSessionToken(secret) {
  const payload = JSON.stringify({ iat: Date.now() });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string') return false;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    return Date.now() - payload.iat < SESSION_TTL_MS;
  } catch {
    return false;
  }
}

export function requireAuth(secret) {
  return (req, res, next) => {
    if (!verifySessionToken(req.cookies?.[COOKIE_NAME], secret)) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  };
}

export function createAuthRouter({ sessionSecret, passwordHash }) {
  const router = Router();

  router.post('/login', async (req, res) => {
    const { password } = req.body ?? {};
    if (typeof password !== 'string') {
      return res.status(400).json({ error: 'password required' });
    }
    const valid = await bcrypt.compare(password, passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'invalid password' });
    }
    const token = createSessionToken(sessionSecret);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_MS,
    });
    res.json({ status: 'ok' });
  });

  router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ status: 'ok' });
  });

  return router;
}
