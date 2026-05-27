import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import config from '../config/index';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    wallet: string;
    address: string;
  };
}

export function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { wallet: string };
    req.user = { wallet: decoded.wallet, address: decoded.wallet };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function verifyWalletSignature(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const address = req.headers['x-wallet-address'] as string;
  const signature = req.headers['x-wallet-signature'] as string;
  const message = req.headers['x-signed-message'] as string;

  if (!address || !signature || !message) {
    res.status(401).json({ error: 'Wallet authentication headers required: x-wallet-address, x-wallet-signature, x-signed-message' });
    return;
  }

  try {
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      res.status(401).json({ error: 'Invalid wallet signature' });
      return;
    }
    req.user = { wallet: address.toLowerCase(), address: address.toLowerCase() };
    next();
  } catch (err) {
    logger.warn('Signature verification failed', err);
    res.status(401).json({ error: 'Signature verification failed' });
  }
}
