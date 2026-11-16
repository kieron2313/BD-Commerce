import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser, getUserWithPermissions } from '../db/users.ts';
import { ensureSeeded } from '../db/seed.ts';

export interface AuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
  dbUser?: {
    id: number;
    uid: string;
    email: string;
    displayName: string | null;
    roleId: number | null;
    isActive: boolean;
  };
  role?: {
    id: number;
    name: string;
    slug: string;
  } | null;
  permissions?: Array<{
    module: string;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await ensureSeeded();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    const dbUser = await getOrCreateUser(
      decoded.uid,
      decoded.email || '',
      decoded.name,
      decoded.picture
    );
    if (!dbUser.isActive) {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }
    const details = await getUserWithPermissions(decoded.uid);
    req.dbUser = dbUser;
    req.role = details?.role || null;
    req.permissions = details?.permissions || [];
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  await ensureSeeded();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    const dbUser = await getOrCreateUser(
      decoded.uid,
      decoded.email || '',
      decoded.name,
      decoded.picture
    );
    const details = await getUserWithPermissions(decoded.uid);
    req.dbUser = dbUser;
    req.role = details?.role || null;
    req.permissions = details?.permissions || [];
  } catch {
    // Ignore invalid optional tokens
  }
  next();
};

export const requirePermission = (
  moduleName: string,
  action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete' = 'canView'
) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser || !req.role) {
      return res.status(403).json({ error: 'Forbidden: Administrative access required.' });
    }
    if (req.role.slug === 'super-administrator') {
      return next();
    }
    const perm = req.permissions?.find((p) => p.module === moduleName);
    if (!perm || !perm[action]) {
      return res.status(403).json({
        error: `Forbidden: Missing '${action}' permission for module '${moduleName}'.`,
      });
    }
    next();
  };
};
