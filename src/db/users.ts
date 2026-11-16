import { db } from './index.ts';
import { users, roles, permissions, customers } from './schema.ts';
import { eq, sql } from 'drizzle-orm';

const OWNER_ADMIN_EMAILS = new Set(['ebazarcyprus@gmail.com']);

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string,
  photoUrl?: string
) {
  try {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const isOwnerEmail = OWNER_ADMIN_EMAILS.has(normalizedEmail);

    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      let nextRoleId = existing[0].roleId;

      if (isOwnerEmail) {
        const superAdminRole = await db
          .select()
          .from(roles)
          .where(eq(roles.slug, 'super-administrator'))
          .limit(1);
        if (superAdminRole.length > 0) {
          nextRoleId = superAdminRole[0].id;
        }
      }

      const updated = await db
        .update(users)
        .set({
          email: normalizedEmail || existing[0].email,
          displayName: displayName || existing[0].displayName,
          photoUrl: photoUrl || existing[0].photoUrl,
          roleId: nextRoleId,
          updatedAt: new Date(),
        })
        .where(eq(users.uid, uid))
        .returning();
      return updated[0];
    }

    // Grant Super Administrator to owner email or if no Super Administrator exists yet
    const existingUsersCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    const totalUsers = existingUsersCount[0]?.count ?? 0;

    const superAdminRole = await db
      .select()
      .from(roles)
      .where(eq(roles.slug, 'super-administrator'))
      .limit(1);

    let hasAnySuperAdmin = false;
    if (superAdminRole.length > 0 && totalUsers > 0) {
      const existingAdmins = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.roleId, superAdminRole[0].id));
      hasAnySuperAdmin = (existingAdmins[0]?.count ?? 0) > 0;
    }

    let assignedRoleId: number | null = null;
    if ((isOwnerEmail || totalUsers === 0 || !hasAnySuperAdmin) && superAdminRole.length > 0) {
      assignedRoleId = superAdminRole[0].id;
    } else {
      const customerRole = await db
        .select()
        .from(roles)
        .where(eq(roles.slug, 'customer'))
        .limit(1);
      if (customerRole.length > 0) {
        assignedRoleId = customerRole[0].id;
      }
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        displayName: displayName || normalizedEmail.split('@')[0],
        photoUrl: photoUrl || '',
        roleId: assignedRoleId,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          displayName: displayName || normalizedEmail.split('@')[0],
          ...(assignedRoleId ? { roleId: assignedRoleId } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    const userRecord = result[0];

    // Ensure a linked customer profile exists for order/inquiry history
    const nameParts = (displayName || normalizedEmail.split('@')[0] || 'Customer').split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'Member';
    const existingCust = await db
      .select()
      .from(customers)
      .where(eq(customers.email, normalizedEmail))
      .limit(1);
    if (existingCust.length === 0) {
      await db.insert(customers).values({
        userId: userRecord.id,
        firstName,
        lastName,
        email: normalizedEmail,
      });
    } else if (!existingCust[0].userId) {
      await db
        .update(customers)
        .set({ userId: userRecord.id })
        .where(eq(customers.id, existingCust[0].id));
    }

    return userRecord;
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Database user synchronization failed.', { cause: error });
  }
}

export async function getUserWithPermissions(uid: string) {
  try {
    const userRows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (userRows.length === 0) return null;
    const user = userRows[0];

    let role = null;
    let perms: Array<typeof permissions.$inferSelect> = [];
    if (user.roleId) {
      const roleRows = await db.select().from(roles).where(eq(roles.id, user.roleId)).limit(1);
      if (roleRows.length > 0) {
        role = roleRows[0];
        perms = await db.select().from(permissions).where(eq(permissions.roleId, role.id));
      }
    }
    return { user, role, permissions: perms };
  } catch (error) {
    console.error('Database query failed in getUserWithPermissions:', error);
    throw new Error('Failed to fetch user permissions.', { cause: error });
  }
}
