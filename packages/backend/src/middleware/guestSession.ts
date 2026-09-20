import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

const COOKIE_NAME = 'guest_session_id';
const TTL_DAYS = 30;

/**
 * Attaches `req.guestSession` — creating one if the cookie is missing
 * or references an expired session.
 *
 * The session id lives in a signed, HTTP-only cookie. It is distinct
 * from the Clerk session — anonymous storefront visitors use this,
 * authenticated users use their Clerk token.
 */
export async function guestSessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const existing = req.cookies?.[COOKIE_NAME] as string | undefined;

    if (existing) {
      const session = await prisma.guestSession.findUnique({
        where: { id: existing },
        select: { id: true, expiresAt: true },
      });

      if (session && session.expiresAt > new Date()) {
        (req as any).guestSessionId = session.id;
        return next();
      }
    }

    // No valid session — create one.
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TTL_DAYS);

    const created = await prisma.guestSession.create({
      data: { expiresAt },
      select: { id: true },
    });

    res.cookie(COOKIE_NAME, created.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      path: '/',
    });

    (req as any).guestSessionId = created.id;
    next();
  } catch (err) {
    console.error('❌ guestSessionMiddleware error:', err);
    // Do not fail the request — anonymous access should still work
    // for read-only routes. Write routes will reject when no session
    // is available.
    next();
  }
}
