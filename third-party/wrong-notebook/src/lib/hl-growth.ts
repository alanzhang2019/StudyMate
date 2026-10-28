import { createLogger } from "@/lib/logger";

const logger = createLogger('lib:hl-growth');

/**
 * 通知 hl-platform 给成长值（方案 B，批次263）。
 *
 * 背景：用户 2026-10-27 拍板「错题本完成订正给成长值，与宠物成长值打通」。
 * 身份映射用 hl 侧的 wn_bindings（hl 的 user/space ↔ 错题本 email），
 * 这里只传 email，**不传 spaceId** —— 由 hl 自己查绑定，绝不信任调用方。
 *
 * ★ 服务间调用，失败**静默**：订正/练习本身已经成功，不能因为积分挂了让用户看到报错。
 * ★ 没配 HL_PLATFORM_BASE / INTEGRATION_API_KEY 直接跳过（本地开发 / 未打通时不打扰）。
 */
export async function notifyHlGrowth(
    email: string | null | undefined,
    kind: 'wn_fix' | 'wn_transfer',
    ref: string,
    extra?: { difficulty?: string | null }
) {
    const base = process.env.HL_PLATFORM_BASE;
    const key = process.env.INTEGRATION_API_KEY;
    if (!base || !key || !email) return;
    // ★ 批次266：举一反三按难度分档（2/4/8/10），难度随请求带过去。
    //   ★★ 只传**难度名**，不传分值 —— 分值表只在 hl 的 pet.WN_TRANSFER_TIERS 里有一份，
    //   两边各写一套必然漂（改了这边忘了那边，学生拿到的分数就对不上公告）。
    const payload: Record<string, unknown> = { email, kind, ref };
    if (extra && extra.difficulty) payload.difficulty = String(extra.difficulty);
    try {
        await fetch(base.replace(/\/$/, '') + '/api/integration/growth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': key },
            body: JSON.stringify(payload),
        });
    } catch (e) {
        logger.warn({ error: e }, 'hl growth notify failed');
    }
}
