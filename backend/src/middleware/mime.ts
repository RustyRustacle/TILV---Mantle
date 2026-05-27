import { Request, Response, NextFunction } from 'express';

const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  'application/pdf': [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])],
  'image/png': [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  'image/jpeg': [
    new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
    new Uint8Array([0xff, 0xd8, 0xff, 0xe1]),
    new Uint8Array([0xff, 0xd8, 0xff, 0xe2]),
  ],
};

const ALLOWED_MIME_TYPES = Object.keys(MAGIC_BYTES);

function matchesMagic(buffer: Buffer, magic: Uint8Array): boolean {
  if (buffer.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) return false;
  }
  return true;
}

export function verifyMimeType(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) {
    next();
    return;
  }

  const declaredType = req.file.mimetype;
  if (!ALLOWED_MIME_TYPES.includes(declaredType)) {
    res.status(400).json({ error: `File type '${declaredType}' not allowed` });
    return;
  }

  const magics = MAGIC_BYTES[declaredType];
  const buffer = req.file.buffer;
  const matches = magics.some((magic) => matchesMagic(buffer, magic));

  if (!matches) {
    res.status(400).json({ error: 'File content does not match declared type' });
    return;
  }

  next();
}
