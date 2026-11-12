import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { calculateGrade } from "@/lib/grade-calculator";
import { unauthorized, badRequest, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { findParentTagIdForGrade } from "@/lib/tag-recognition";
import { inferSubjectFromName } from "@/lib/knowledge-tags";

const logger = createLogger('api:paper-scans');

/** 一次最多几页、几条题 —— 防手滑和防刷。手机上拍一张卷子 3~6 页够用。 */
const MAX_PAGES = 6;
const MAX_ITEMS = 60;
const MAX_PAGE_BYTES = 3_000_000; // base64 字符数，约 2.2MB 原图
/** 判重时比对题干前多少字符（同一张卷子拍两次、或同题从两个入口进来） */
const DEDUP_PREFIX = 40;

/**
 * 拍整张卷子入库。
 * ============================================================
 * 一次请求完成三件事：建卷子 → 存整页图 → 把选中的错题/空白题写成 ErrorItem。
 *
 * ★★★ 三条不能动的规矩：
 *   ① **绝不写答案**。answerText / analysis / mistakeAnalysis 一律 null ——
 *      哪怕前端手滑把答案塞进 body 也不接（这个接口不读这些字段）。
 *   ② **整页图一页只存一份**（PaperPage），同一页上的 8 道错题都指回那一行。
 *      不像单题拍照那样每题存一份整页 base64，那是把库撑爆最快的办法。
 *   ③ 判重：同一个人 + 同题干前 40 字已在库里 ⇒ 跳过并如实回报，
 *      免得学生把同一张卷子拍两遍，错题本里出现两套一模一样的题。
 */
export async function POST(req: Request) {
    logger.info('POST /api/paper-scans called');

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return unauthorized("No session");
    }

    try {
        const body = await req.json();
        const {
            subjectId,
            title,
            gradeSemester,
            paperLevel,
            pages = [],
            items = [],
        } = body || {};

        if (!Array.isArray(pages) || pages.length === 0) return badRequest('Missing pages');
        if (pages.length > MAX_PAGES) return badRequest(`Too many pages (max ${MAX_PAGES})`);
        if (!Array.isArray(items) || items.length === 0) return badRequest('Missing items');
        if (items.length > MAX_ITEMS) return badRequest(`Too many items (max ${MAX_ITEMS})`);

        for (const p of pages) {
            const raw = typeof p?.imageBase64 === 'string' ? p.imageBase64 : '';
            if (!raw) return badRequest('Page image missing');
            if (raw.length > MAX_PAGE_BYTES) return badRequest('Page image too large');
        }

        const user = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (!user) return unauthorized("No user found in DB");

        let finalGradeSemester = typeof gradeSemester === 'string' && gradeSemester.trim()
            ? gradeSemester.trim()
            : null;
        if (!finalGradeSemester && user.educationStage && user.enrollmentYear) {
            finalGradeSemester = calculateGrade(user.educationStage, user.enrollmentYear);
        }

        const subject = subjectId
            ? await prisma.subject.findUnique({ where: { id: subjectId } })
            : null;
        const subjectKey = inferSubjectFromName(subject?.name ?? null) || 'other';

        // ── 先把标签准备好（同一个事务里建，避免"题进库了标签没建"的半截状态）
        const tagNamesOf = (it: any): string[] =>
            Array.isArray(it?.knowledgePoints)
                ? it.knowledgePoints.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 3)
                : [];

        const allTagNames = Array.from(new Set(items.flatMap(tagNamesOf)));
        const tagIdByName = new Map<string, string>();
        for (const name of allTagNames) {
            let tag = await prisma.knowledgeTag.findFirst({
                where: { name, OR: [{ isSystem: true }, { userId: user.id }] },
            });
            if (!tag) {
                const parentId = await findParentTagIdForGrade(finalGradeSemester, subjectKey);
                tag = await prisma.knowledgeTag.create({
                    data: { name, subject: subjectKey, isSystem: false, userId: user.id, parentId },
                });
            }
            tagIdByName.set(name, tag.id);
        }

        // ── 判重：同人 + 题干前缀已存在 ⇒ 跳过
        const existed = await prisma.errorItem.findMany({
            where: {
                userId: user.id,
                questionText: { not: null },
                ...(subjectId ? { subjectId } : {}),
            },
            select: { questionText: true },
            orderBy: { createdAt: 'desc' },
            take: 2000,
        });
        const existingPrefixes = new Set(
            existed.map((e) => (e.questionText || '').slice(0, DEDUP_PREFIX))
        );

        const accepted: any[] = [];
        let duplicates = 0;
        let invalid = 0;
        for (const it of items) {
            const questionText = String(it?.questionText || '').trim();
            const verdict = it?.verdict === 'blank' ? 'blank' : (it?.verdict === 'wrong' ? 'wrong' : '');
            if (!questionText || !verdict) { invalid++; continue; }
            const prefix = questionText.slice(0, DEDUP_PREFIX);
            if (existingPrefixes.has(prefix)) { duplicates++; continue; }
            existingPrefixes.add(prefix); // 同一次提交里的重复也算
            accepted.push({ ...it, questionText, verdict });
        }

        if (accepted.length === 0) {
            return NextResponse.json({
                scanId: null, created: 0, duplicates, invalid,
                message: duplicates > 0 ? 'DUPLICATE' : 'NO_ITEM',
            });
        }

        const pageCount = pages.length;

        const result = await prisma.$transaction(async (tx) => {
            const scan = await tx.paperScan.create({
                data: {
                    userId: user.id,
                    subjectId: subjectId || null,
                    title: typeof title === 'string' ? title.slice(0, 80) : null,
                    gradeSemester: finalGradeSemester,
                    paperLevel: typeof paperLevel === 'string' ? paperLevel : null,
                    pageCount,
                },
            });

            for (let i = 0; i < pages.length; i++) {
                const p = pages[i];
                await tx.paperPage.create({
                    data: {
                        scanId: scan.id,
                        pageNo: Number(p?.pageNo) > 0 ? Number(p.pageNo) : i + 1,
                        imageUrl: String(p.imageBase64),
                        width: Number(p?.width) || null,
                        height: Number(p?.height) || null,
                    },
                });
            }

            const createdIds: string[] = [];
            for (const it of accepted) {
                const pageNo = Number(it.pageNo) > 0 ? Number(it.pageNo) : 1;
                const tagNames = tagNamesOf(it);
                const item = await tx.errorItem.create({
                    data: {
                        userId: user.id,
                        subjectId: subjectId || null,
                        originalImageUrl: '', // ★ 不存图：整页图在 PaperPage 里，这里只指回去
                        questionText: it.questionText,
                        // ★★★ 下面四个字段**永远为空**：拍卷子不给答案（防抄作业）
                        answerText: null,
                        analysis: null,
                        mistakeAnalysis: null,
                        wrongAnswerText: String(it?.studentAnswer || '').trim() || null,
                        mistakeStatus: it.verdict === 'blank' ? 'not_attempted' : 'wrong_attempt',
                        knowledgePoints: JSON.stringify(tagNames),
                        gradeSemester: finalGradeSemester,
                        paperLevel: typeof paperLevel === 'string' ? paperLevel : null,
                        source: 'paper_scan', // 前端据此显示「拍照收卷」并隐藏答案区
                        paperScanId: scan.id,
                        paperPageNo: pageNo,
                        masteryLevel: 0,
                        tags: {
                            connect: tagNames.map((n) => ({ id: tagIdByName.get(n)! })).filter((x) => !!x.id),
                        },
                    },
                });
                createdIds.push(item.id);
            }

            return { scanId: scan.id, created: createdIds.length, ids: createdIds };
        }, { maxWait: 5000, timeout: 30000 });

        logger.info({ ...result, duplicates, invalid, pageCount }, 'Paper scan saved');

        return NextResponse.json({
            scanId: result.scanId,
            created: result.created,
            duplicates,
            invalid,
        }, { status: 201 });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ error: msg }, 'Failed to save paper scan');
        return internalError('Failed to save paper scan');
    }
}
