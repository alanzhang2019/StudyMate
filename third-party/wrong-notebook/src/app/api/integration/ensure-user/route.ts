/**
 * hl-platform → 错题本：**按需开户**（服务间通道，2026-10-06 批次47）
 *
 * 为什么需要它：
 *   两个系统原本账号体系独立（hl 用手机号/用户名，错题本用邮箱），
 *   学生第一次进错题本必须手填一次「我在错题本注册的邮箱」——
 *   而绝大多数学生**根本没有错题本账号**，看到那一屏只会困惑"我是不是要再注册一遍"。
 *   用户诉求：「错题本与 hl-platform 保持统一账户信息」。
 *
 * 做法（不去动错题本的认证核心）：
 *   hl 已能用 NEXTAUTH_SECRET 直接签出**错题本认的会话**（SSO，批次41已上线）。
 *   缺的只是"这个人错题本里还没有账号"。本接口补上这一环：
 *     · email 已存在 → 直接返回，什么都不做（幂等）
 *     · email 不存在 → 建一个账号（随机密码，SSO 进不需要密码）
 *   ⇒ 学生全程零输入，进错题本就是自己的本子；旧账号（已注册过的）完全不受影响。
 *
 * 鉴权：与 integration/error-items 同一把 key（INTEGRATION_API_KEY）。
 *   ★ 未配置 => 一律拒绝，不写成 `|| ''` 静默放行。
 *
 * 安全：
 *   · 只允许 hl 服务端调用（拿不到 key 就打不进来）。
 *   · 不接受前端传任意字段 —— 只收 email / name，且 email 必须过格式校验。
 *   · **不返回密码哈希**。
 *   · 防滥用：单次只建一个，且带 60 秒同 email 去重（避免并发双击建出两个）。
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:integration:ensure-user');

// 邮箱格式：与 /api/register 一致（支持 user@localhost 这类本地域名，
// 因为 hl 侧派生的地址形如 13800000000@hl.local）
const EMAIL_RE = /^[^\s@]+@[^\s@]+$/;

export async function POST(req: Request) {
    // ── 1. 鉴权 ────────────────────────────────────────────────
    const expectedApiKey = process.env.INTEGRATION_API_KEY;
    if (!expectedApiKey) {
        logger.error('INTEGRATION_API_KEY is not configured; refusing all requests');
        return NextResponse.json(
            { ok: false, message: '服务未配置集成密钥，接口不可用' },
            { status: 503 }
        );
    }
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey || apiKey !== expectedApiKey) {
        logger.warn('Invalid or missing API key');
        return NextResponse.json({ ok: false, message: 'API密钥无效' }, { status: 401 });
    }

    // ── 2. 参数 ────────────────────────────────────────────────
    let body: any;
    try { body = await req.json(); } catch { body = null; }
    const email = String(body?.email || '').trim().toLowerCase();
    const name = String(body?.name || '').trim().slice(0, 40);

    if (!email || !EMAIL_RE.test(email)) {
        return NextResponse.json({ ok: false, message: '邮箱格式不正确' }, { status: 400 });
    }
    // 长度闸门：防超长串写库
    if (email.length > 120) {
        return NextResponse.json({ ok: false, message: '邮箱过长' }, { status: 400 });
    }

    try {
        // ── 3. 已存在就直接返回（幂等，这是绝大多数情况）────────
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            logger.info({ email }, 'ensure-user: existing');
            return NextResponse.json({
                ok: true,
                created: false,
                userId: existing.id,
                email: existing.email,
                name: existing.name,
            });
        }

        // ── 4. 建号 ────────────────────────────────────────────
        // 随机密码：这个账号只会走 SSO 进来，密码本身用不上。
        // 但**必须**是合法 bcrypt 哈希 —— 错题本登录用 compare()，
        // 存裸字符串会让 compare 抛错（而不是"密码不对"），反而是 bug。
        const password = await hash(randomBytes(24).toString('hex'), 10);
        const created = await prisma.user.create({
            data: { email, name: name || email.split('@')[0], password },
        });
        logger.info({ email, userId: created.id }, 'ensure-user: created');

        return NextResponse.json({
            ok: true,
            created: true,
            userId: created.id,
            email: created.email,
            name: created.name,
        });
    } catch (e: any) {
        // 并发双击：两个请求同时走到 create，一个成功一个撞唯一索引。
        // 撞了就重查一次返回既有的 —— 对调用方来说仍是"成功"。
        if (e && (e.code === 'P2002' || /unique/i.test(String(e.message || '')))) {
            const again = await prisma.user.findUnique({ where: { email } });
            if (again) {
                return NextResponse.json({
                    ok: true, created: false, userId: again.id,
                    email: again.email, name: again.name,
                });
            }
        }
        logger.error({ email, err: e?.message }, 'ensure-user failed');
        return NextResponse.json({ ok: false, message: '开户失败' }, { status: 500 });
    }
}
