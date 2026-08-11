import { put } from '@vercel/blob';
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const expectedSecret = process.env.ADMIN_SECRET;
  const providedSecret = request.headers['x-admin-secret'];
  if (!expectedSecret) {
    return response.status(500).json({ error: 'Server misconfigured: ADMIN_SECRET not set' });
  }
  if (!providedSecret || providedSecret !== expectedSecret) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { filename: rawName, contentType, dataBase64 } = request.body || {};

    if (!dataBase64) {
      return response.status(400).json({ error: 'Upload body was empty  no file data received.' });
    }

    const fileBuffer = Buffer.from(dataBase64, 'base64');

    if (!fileBuffer || fileBuffer.length === 0) {
      return response.status(400).json({ error: 'Upload body was empty  decoded file had 0 bytes.' });
    }

    const safeName = (rawName || `image-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `products/${Date.now()}-${safeName}`;

    const blob = await put(filename, fileBuffer, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
    });

    return response.status(200).json({ url: blob.url });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}