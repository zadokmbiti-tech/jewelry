import { put } from '@vercel/blob';
import crypto from 'crypto';

// The file is sent as base64 inside a normal JSON body (see admin.html /
// manage.html). We deliberately avoid sending it as a raw binary body: under
// `vercel dev` for this (non-Next.js) Serverless Function, the raw request
// stream comes back empty no matter how it's read  something upstream
// drains it before our handler runs. JSON is a content type Vercel's
// default body parser handles reliably in both `vercel dev` and production,
// so this sidesteps that problem entirely instead of fighting it.

const ALLOWED_IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
// webm is what the browser-side compressor (resizeImageForUpload's video
// counterpart, in the admin panel) re-encodes everything to via
// MediaRecorder, so it's the type actually hitting this endpoint in
// practice. mp4/quicktime are still accepted for a file that's small enough
// to skip client compression and upload as-is.
const ALLOWED_VIDEO_CONTENT_TYPES = new Set(['video/webm', 'video/mp4', 'video/quicktime']);
const ALLOWED_CONTENT_TYPES = new Set([...ALLOWED_IMAGE_CONTENT_TYPES, ...ALLOWED_VIDEO_CONTENT_TYPES]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
// Vercel Serverless Functions hard-cap the total request body at ~4.5MB --
// a platform limit, not something raisable here or in vercel.json. This
// endpoint receives the file base64-encoded inside a JSON body, and base64
// inflates size by ~33%, so the raw (decoded) file has to be well under
// that 4.5MB body cap or Vercel rejects the request before this handler
// even runs (returning its own plain-text "Request Entity Too Large", not
// JSON). The browser-side compressor (compressVideoForUpload in the admin
// panel) targets ~2.8MB output for exactly this reason -- this check is a
// backstop for anything that skips or exceeds that, not the primary control.
const MAX_VIDEO_BYTES = 3.2 * 1024 * 1024; // ~3.2MB raw -- keeps base64'd body under Vercel's cap

// In-memory per-IP rate limit / lockout for this function instance. Serverless
// instances are ephemeral and this doesn't share state across regions/cold
// starts, so it's a best-effort backstop, not the only line of defense 
// the FastAPI backend's own lockout on ADMIN_SECRET is the primary one.
const failedAttempts = new Map(); // ip -> [timestamps]
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal length to avoid an early-return
    // timing signal on length mismatches.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function isLockedOut(ip) {
  const now = Date.now();
  const attempts = (failedAttempts.get(ip) || []).filter(t => now - t < LOCKOUT_WINDOW_MS);
  failedAttempts.set(ip, attempts);
  return attempts.length >= LOCKOUT_THRESHOLD;
}

function recordFailure(ip) {
  const now = Date.now();
  const attempts = (failedAttempts.get(ip) || []).filter(t => now - t < LOCKOUT_WINDOW_MS);
  attempts.push(now);
  failedAttempts.set(ip, attempts);
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const ip = request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.socket?.remoteAddress || 'unknown';

  const expectedSecret = process.env.ADMIN_SECRET;
  const providedSecret = request.headers['x-admin-secret'];
  if (!expectedSecret) {
    return response.status(500).json({ error: 'Server misconfigured: ADMIN_SECRET not set' });
  }

  if (isLockedOut(ip)) {
    // Same generic message as a bad secret -- never reveal why.
    return response.status(401).json({ error: 'Unauthorized' });
  }

  if (!providedSecret || !timingSafeStringEqual(String(providedSecret), String(expectedSecret))) {
    recordFailure(ip);
    return response.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { filename: rawName, contentType, dataBase64 } = request.body || {};

    if (!dataBase64) {
      return response.status(400).json({ error: 'Upload body was empty  no file data received.' });
    }

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return response.status(400).json({ error: 'Unsupported file type. Images: JPEG, PNG, WEBP, GIF. Videos: WEBM, MP4, MOV.' });
    }

    const isVideo = ALLOWED_VIDEO_CONTENT_TYPES.has(contentType);
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

    const fileBuffer = Buffer.from(dataBase64, 'base64');

    if (!fileBuffer || fileBuffer.length === 0) {
      return response.status(400).json({ error: 'Upload body was empty  decoded file had 0 bytes.' });
    }

    if (fileBuffer.length > maxBytes) {
      const limitMb = maxBytes / (1024 * 1024);
      return response.status(400).json({ error: `File is too large. Max size is ${limitMb}MB for ${isVideo ? 'video' : 'image'} uploads.` });
    }

    const safeName = (rawName || `image-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `products/${Date.now()}-${safeName}`;

    const blob = await put(filename, fileBuffer, {
      access: 'public',
      contentType,
    });

    return response.status(200).json({ url: blob.url });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}