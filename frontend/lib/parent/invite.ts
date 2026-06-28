/**
 * Parent invite-code helpers.
 *
 * A student clicks "Invite parents" in their mistake-book page,
 * we mint a 6-digit code bound to the student's visitorId and
 * store it in `parent_invite_codes` for 10 minutes. The parent
 * enters the code on /parent/bind, we mark the code used and
 * create a durable `parent_bindings` row.
 *
 * The bindings table holds the long-term identity of the parent
 * (parentVisitorId) so the same parent can revisit the dashboard
 * from any device without re-entering the code, as long as the
 * cookie is present.
 */

import { randomInt } from 'node:crypto';
import { db } from '@/lib/db';

const CODE_TTL_MINUTES = 10;
const MAX_GENERATION_ATTEMPTS = 20;

/**
 * Drop codes whose 10-minute window has elapsed. We do this
 * opportunistically before minting a new code so the table
 * doesn't accumulate unreachable rows that reduce the success
 * probability of subsequent generations.
 */
function cleanupExpiredCodes(): void {
  const all = db.parentInviteCode.findMany({});
  const now = Date.now();
  for (const c of all) {
    if (new Date(c.expiresAt).getTime() < now) {
      db.parentInviteCode.delete({ where: { id: c.id } });
    }
  }
}

function generateUniqueCode(): string {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const existing = db.parentInviteCode.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error('UNABLE_TO_GENERATE_CODE');
}

export function createInviteCode(studentVisitorId: string): {
  code: string;
  expiresAt: string;
} {
  cleanupExpiredCodes();

  // Drop any unused, not-yet-redeemed codes for THIS student so that
  // older test runs don't permanently shrink the available 6-digit
  // space. A code only needs to remain valid while the parent is
  // actively typing it in.
  const studentCodes = db.parentInviteCode.findMany({
    where: { studentVisitorId },
  });
  for (const c of studentCodes) {
    if (!c.usedAt) {
      db.parentInviteCode.delete({ where: { id: c.id } });
    }
  }

  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const code = generateUniqueCode();
  const row = db.parentInviteCode.create({
    data: {
      code,
      studentVisitorId,
      expiresAt,
    },
  });
  return { code: row.code, expiresAt: row.expiresAt };
}

export type RedeemResult =
  | {
      ok: true;
      studentVisitorId: string;
      parentBindingId: string;
      alreadyBound: boolean;
    }
  | { ok: false; reason: 'not-found' | 'expired' | 'used' };

/**
 * Redeem an invite code. Marks the code as used and creates (or
 * returns) the long-term parent_bindings row. The caller is
 * responsible for minting `parentVisitorId` (typically via a
 * parent-only cookie) and persisting it in the response.
 */
export function redeemInviteCode(
  code: string,
  parentVisitorId: string,
): RedeemResult {
  const row = db.parentInviteCode.findUnique({ where: { code } });
  if (!row) return { ok: false, reason: 'not-found' };
  if (row.usedAt) return { ok: false, reason: 'used' };
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  // Mark the code used immediately. This is intentionally eager so
  // that two parents racing the same code never both succeed.
  db.parentInviteCode.update({
    where: { id: row.id },
    data: { usedAt: new Date().toISOString() },
  });

  // Reuse a non-revoked binding for this (parent, student) pair
  // if one exists, so redeeming twice does not create ghost rows.
  const existing = db.parentBinding.findFirst({
    where: {
      parentVisitorId,
      studentVisitorId: row.studentVisitorId,
      revokedAt: null,
    },
  });
  if (existing) {
    return {
      ok: true,
      studentVisitorId: row.studentVisitorId,
      parentBindingId: existing.id,
      alreadyBound: true,
    };
  }

  const binding = db.parentBinding.create({
    data: {
      parentVisitorId,
      studentVisitorId: row.studentVisitorId,
    },
  });
  return {
    ok: true,
    studentVisitorId: row.studentVisitorId,
    parentBindingId: binding.id,
    alreadyBound: false,
  };
}

export function revokeBinding(
  bindingId: string,
  revokedBy: 'student' | 'parent' | 'system' = 'student',
): boolean {
  const row = db.parentBinding.findUnique({ where: { id: bindingId } });
  if (!row || row.revokedAt) return false;
  db.parentBinding.update({
    where: { id: bindingId },
    data: { revokedAt: new Date().toISOString(), revokedBy },
  });
  return true;
}

export function listActiveBindingsForParent(parentVisitorId: string) {
  return db.parentBinding.findMany({
    where: { parentVisitorId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

export function listActiveBindingsForStudent(studentVisitorId: string) {
  return db.parentBinding.findMany({
    where: { studentVisitorId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

export function getBindingById(bindingId: string) {
  return db.parentBinding.findUnique({ where: { id: bindingId } });
}

export function isBindingOwnedByStudent(
  bindingId: string,
  studentVisitorId: string,
): boolean {
  const row = getBindingById(bindingId);
  if (!row) return false;
  return row.studentVisitorId === studentVisitorId && !row.revokedAt;
}
