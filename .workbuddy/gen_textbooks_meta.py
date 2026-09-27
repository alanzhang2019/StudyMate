# -*- coding: utf-8 -*-
"""扫描 E:/教材/*.pdf，解析科目/版本/年级/学期（义务教育）与高中册次（高中50本），
生成:
  1) frontend/lib/textbooks.ts        —— 站点元数据
  2) .workbuddy/textbook-upload-map.tsv —— slug 与原文件名映射（供 scp 上传与核对）

高中教材：E:/教材 下命名形如「高中地理人教版_必修第一册.pdf」，
HS_VOLUMES 定义了深圳高中全系列 50 本（卷名 → 册次/显示名）；
有对应 PDF 的生成真实条目，没有的自动补齐 pending: true 条目（sizeBytes: 0）。
"""
import os
import re
import sys
from collections import Counter

SRC_DIR = r"E:\教材"
TS_OUT = r"D:\AItrade\ai-math-mistake-machine\frontend\lib\textbooks.ts"
MAP_OUT = r"D:\AItrade\ai-math-mistake-machine\.workbuddy\textbook-upload-map.tsv"

# 科目固定顺序（页面按此排序）
SUBJECT_ORDER = [
    "chinese", "math", "english", "science",
    "physics", "chemistry", "biology", "history", "geography", "ethics", "politics",
]

SUBJECT_LABEL = {
    "chinese": "语文", "math": "数学", "english": "英语", "science": "科学",
    "physics": "物理", "chemistry": "化学", "biology": "生物",
    "history": "历史", "geography": "地理", "ethics": "道德与法治", "politics": "思想政治",
}

SUBJECT_NOTE = {
    "chinese": "部编版 · 全国统一",
    "math": "北师大版 · 深圳在用",
    "english": "沪教牛津版 · 深圳在用",
    "science": "教科版 · 深圳在用",
    "physics": "人教版 · 深圳在用",
    "chemistry": "人教版 · 深圳在用",
    "biology": "人教版 · 深圳在用",
    "history": "人教版 · 深圳在用",
    "geography": "湘教版 · 深圳在用",
    "ethics": "人教版 · 深圳在用",
    "politics": "统编版 · 全国统一",
}

# 义务教育 (正则, 科目, 版本中文名, 版本代号)
PATTERNS = [
    (re.compile(r"^语文部编版(\d)年级(上|下)册\.pdf$"), "chinese", "部编版", "bj"),
    (re.compile(r"^数学北师大版(\d)年级(上|下)册\.pdf$"), "math", "北师大版", "bnu"),
    (re.compile(r"^英语沪教牛津版(\d)年级(上|下)册\.pdf$"), "english", "沪教牛津版", "ox"),
    (re.compile(r"^英语沪教版([四五])年级(上|下)册\.pdf$"), "english", "沪教版", "sh"),
    (re.compile(r"^科学教科版(\d)年级(上|下)册\.pdf$"), "science", "教科版", "ed"),
    (re.compile(r"^科学([四五])年级(上|下)册\(?压缩\)?\.pdf$"), "science", "教科版", "ed"),
    (re.compile(r"^物理人教版(\d)年级(上|下|全一)册\.pdf$"), "physics", "人教版", "pep"),
    (re.compile(r"^化学人教版(\d)年级(上|下)册\.pdf$"), "chemistry", "人教版", "pep"),
    (re.compile(r"^生物人教版(\d)年级(上|下)册\.pdf$"), "biology", "人教版", "pep"),
    (re.compile(r"^历史人教版(\d)年级(上|下)册\.pdf$"), "history", "人教版", "pep"),
    (re.compile(r"^地理湘教版(\d)年级(上|下)册\.pdf$"), "geography", "湘教版", "xj"),
    (re.compile(r"^道德与法治人教版(\d)年级(上|下)册\.pdf$"), "ethics", "人教版", "pep"),
]

CN_NUM = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
GRADE_CN = {1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "七", 8: "八", 9: "九"}

# 高中：科目 → (版本代号, 版本中文名)
HS_META = {
    "chinese": ("tb", "统编版"),
    "math": ("rja", "人教A版"),
    "english": ("wy", "外研社版"),
    "physics": ("pep", "人教版"),
    "chemistry": ("pep", "人教版"),
    "biology": ("pep", "人教版"),
    "history": ("tb", "统编版"),
    "geography": ("pep", "人教版"),
    "politics": ("tb", "统编版"),
}

# 高中 50 本：卷名（=PDF 文件名去掉「高中<科目><版本>_」前缀）→ (hs序号, semester, title后缀)
HS_VOLUMES = {
    "chinese": [
        ("必修上册", (1, "必修上册", "必修上册（高中）")),
        ("必修下册", (2, "必修下册", "必修下册（高中）")),
        ("选择性必修上册", (3, "选择性必修上册", "选择性必修上册（高中）")),
        ("选择性必修中册", (4, "选择性必修中册", "选择性必修中册（高中）")),
        ("选择性必修下册", (5, "选择性必修下册", "选择性必修下册（高中）")),
    ],
    "math": [
        ("必修第一册", (1, "必修第一册", "必修第一册（高中）")),
        ("必修第二册", (2, "必修第二册", "必修第二册（高中）")),
        ("选择性必修第一册", (3, "选择性必修第一册", "选择性必修第一册（高中）")),
        ("选择性必修第二册", (4, "选择性必修第二册", "选择性必修第二册（高中）")),
        ("选择性必修第三册", (5, "选择性必修第三册", "选择性必修第三册（高中）")),
    ],
    "english": [
        ("必修第一册", (1, "必修第一册", "必修第一册（高中）")),
        ("必修第二册", (2, "必修第二册", "必修第二册（高中）")),
        ("必修第三册", (3, "必修第三册", "必修第三册（高中）")),
        ("选择性必修第一册", (4, "选择性必修第一册", "选择性必修第一册（高中）")),
        ("选择性必修第二册", (5, "选择性必修第二册", "选择性必修第二册（高中）")),
        ("选择性必修第三册", (6, "选择性必修第三册", "选择性必修第三册（高中）")),
        ("选择性必修第四册", (7, "选择性必修第四册", "选择性必修第四册（高中）")),
    ],
    "physics": [
        ("必修第一册", (1, "必修第一册", "必修第一册（高中）")),
        ("必修第二册", (2, "必修第二册", "必修第二册（高中）")),
        ("必修第三册", (3, "必修第三册", "必修第三册（高中）")),
        ("选择性必修第一册", (4, "选择性必修第一册", "选择性必修第一册（高中）")),
        ("选择性必修第二册", (5, "选择性必修第二册", "选择性必修第二册（高中）")),
        ("选择性必修第三册", (6, "选择性必修第三册", "选择性必修第三册（高中）")),
    ],
    "chemistry": [
        ("必修第一册", (1, "必修第一册", "必修第一册（高中）")),
        ("必修第二册", (2, "必修第二册", "必修第二册（高中）")),
        ("选择性必修1化学反应原理", (3, "选择性必修1", "选择性必修1 · 化学反应原理")),
        ("选择性必修2物质结构与性质", (4, "选择性必修2", "选择性必修2 · 物质结构与性质")),
        ("选择性必修3有机化学基础", (5, "选择性必修3", "选择性必修3 · 有机化学基础")),
    ],
    "biology": [
        ("必修1分子与细胞", (1, "必修1", "必修1 · 分子与细胞")),
        ("必修2遗传与进化", (2, "必修2", "必修2 · 遗传与进化")),
        ("选择性必修1稳态与调节", (3, "选择性必修1", "选择性必修1 · 稳态与调节")),
        ("选择性必修2生物与环境", (4, "选择性必修2", "选择性必修2 · 生物与环境")),
        ("选择性必修3生物技术与工程", (5, "选择性必修3", "选择性必修3 · 生物技术与工程")),
    ],
    "history": [
        ("必修中外历史纲要（上）", (1, "必修上册", "必修上册 · 中外历史纲要（上）")),
        ("必修中外历史纲要（下）", (2, "必修下册", "必修下册 · 中外历史纲要（下）")),
        ("选择性必修1国家制度与社会治理", (3, "选择性必修1", "选择性必修1 · 国家制度与社会治理")),
        ("选择性必修2经济与社会生活", (4, "选择性必修2", "选择性必修2 · 经济与社会生活")),
        ("选择性必修3文化交流与传播", (5, "选择性必修3", "选择性必修3 · 文化交流与传播")),
    ],
    "geography": [
        ("必修第一册", (1, "必修第一册", "必修第一册（高中）")),
        ("必修第二册", (2, "必修第二册", "必修第二册（高中）")),
        ("选择性必修1自然地理基础", (3, "选择性必修1", "选择性必修1 · 自然地理基础")),
        ("选择性必修2区域发展", (4, "选择性必修2", "选择性必修2 · 区域发展")),
        ("选择性必修3资源、环境与国家安全", (5, "选择性必修3", "选择性必修3 · 资源、环境与国家安全")),
    ],
    "politics": [
        ("必修1", (1, "必修1", "必修1（高中）")),
        ("必修2", (2, "必修2", "必修2（高中）")),
        ("必修3", (3, "必修3", "必修3（高中）")),
        ("必修4", (4, "必修4", "必修4（高中）")),
        ("选择性必修1", (5, "选择性必修1", "选择性必修1（高中）")),
        ("选择性必修2", (6, "选择性必修2", "选择性必修2（高中）")),
        ("选择性必修3", (7, "选择性必修3", "选择性必修3（高中）")),
    ],
}

SEMESTER_UNION = [
    "上册", "下册", "全一册",
    "必修上册", "必修下册",
    "必修第一册", "必修第二册", "必修第三册",
    "必修1", "必修2", "必修3", "必修4",
    "选择性必修上册", "选择性必修中册", "选择性必修下册",
    "选择性必修第一册", "选择性必修第二册", "选择性必修第三册", "选择性必修第四册",
    "选择性必修1", "选择性必修2", "选择性必修3",
]


def parse_compulsory(name: str):
    for pat, subject, publisher, pubcode in PATTERNS:
        m = pat.match(name)
        if not m:
            continue
        raw_grade, sem = m.group(1), m.group(2)
        grade = CN_NUM.get(raw_grade) or int(raw_grade)
        lite = "压缩" in name
        if sem == "全一":
            semester = "全一册"
            sem_code = ""
        else:
            semester = f"{sem}册"
            sem_code = "a" if sem == "上" else "b"
        slug = f"{subject}-{pubcode}-g{grade}{sem_code}"
        if lite:
            slug += "-lite"
        return {
            "slug": slug,
            "subject": subject,
            "grade": grade,
            "semester": semester,
            "publisher": publisher,
            "lite": lite,
            "original": name,
            "size": os.path.getsize(os.path.join(SRC_DIR, name)),
            "stage": "compulsory",
        }
    return None


def parse_highschool(name: str):
    """返回 (subject, volume) 或 None。命名：高中<科目><版本>_<卷名>.pdf"""
    m = re.match(r"^高中(.+?)_(.+)\.pdf$", name)
    if not m:
        return None
    head, volume = m.group(1), m.group(2)
    for subject, (pubcode, publisher) in HS_META.items():
        if head == SUBJECT_LABEL[subject] + publisher:
            for vol, _meta in HS_VOLUMES[subject]:
                if vol == volume:
                    return subject, vol
    return None


def main():
    files = sorted(f for f in os.listdir(SRC_DIR) if f.lower().endswith(".pdf"))
    books = []
    hs_files = {}  # (subject, volume) -> size
    errors = []
    for name in files:
        info = parse_compulsory(name)
        if info is not None:
            books.append(info)
            continue
        hs = parse_highschool(name)
        if hs is not None:
            hs_files[hs] = os.path.getsize(os.path.join(SRC_DIR, name))
            continue
        errors.append(name)

    if errors:
        print("!! 以下文件未匹配到规则:")
        for e in errors:
            print("   ", e)
        sys.exit(1)

    # 高中 50 本：有文件的生成真实条目，没有的补齐 pending
    for subject in HS_META:
        pubcode, publisher = HS_META[subject]
        for volume, (hsn, semester, suffix) in HS_VOLUMES[subject]:
            title = f"{SUBJECT_LABEL[subject]} · {suffix}"
            if (subject, volume) in hs_files:
                size = hs_files[(subject, volume)]
                pending = False
            else:
                size = 0
                pending = True
            books.append({
                "slug": f"{subject}-{pubcode}-hs{hsn}",
                "subject": subject,
                "grade": 10,
                "semester": semester,
                "publisher": publisher,
                "title": title,
                "size": size,
                "lite": False,
                "original": None if pending else f"高中{SUBJECT_LABEL[subject]}{publisher}_{volume}.pdf",
                "stage": "highschool",
                "pending": pending,
            })

    # 排序：义务教育（科目顺序 → 年级 → 学期 → 压缩版在后），高中（科目顺序 → 册次）
    sem_rank = {"上册": 0, "下册": 1, "全一册": 2, "必修上册": 3, "必修下册": 4}
    books.sort(key=lambda b: (
        SUBJECT_ORDER.index(b["subject"]),
        b["stage"],
        0 if b["stage"] == "compulsory" else b["grade"],
        0 if b["stage"] == "compulsory" else int(re.search(r"hs(\d+)$", b["slug"]).group(1)),
        b["grade"] if b["stage"] == "compulsory" else 0,
        sem_rank.get(b["semester"], 5) if b["stage"] == "compulsory" else 0,
        1 if b["lite"] else 0,
    ))

    # slug 查重
    slugs = [b["slug"] for b in books]
    dup = {s for s in slugs if slugs.count(s) > 1}
    if dup:
        print("!! slug 重复:", dup)
        sys.exit(1)

    # 1) 生成 TS
    lines = []
    lines.append("// 自动生成：python 脚本扫描 E:/教材 生成，请勿手工排序/改名。")
    lines.append("// slug 即 nginx /textbooks/ 直出的文件名（不含扩展名），全 ASCII，")
    lines.append("// 与 .workbuddy/textbook-upload-map.tsv 的映射保持一致。")
    lines.append("")
    lines.append("export type SubjectKey =")
    for i, s in enumerate(SUBJECT_ORDER):
        lines.append(f"  | '{s}'")
    lines[-1] = lines[-1] + ";"
    lines.append("")
    lines.append("export type Semester =")
    for i, s in enumerate(SEMESTER_UNION):
        lines.append(f"  | '{s}'")
    lines[-1] = lines[-1] + ";"
    lines.append("")
    lines.append("/** 学段：义务教育（1-9 年级）或高中（必修/选择性必修） */")
    lines.append("export type Stage = 'compulsory' | 'highschool';")
    lines.append("")
    lines.append("export interface Textbook {")
    lines.append("  /** 文件 slug，URL 为 /textbooks/<slug>.pdf */")
    lines.append("  slug: string;")
    lines.append("  subject: SubjectKey;")
    lines.append("  grade: number; // 义务教育 1-9；高中统一为 10（不用于年级筛选）")
    lines.append("  semester: Semester;")
    lines.append("  publisher: string;")
    lines.append("  /** 完整显示名，如「语文 · 一年级 · 上册」 */")
    lines.append("  title: string;")
    lines.append("  sizeBytes: number;")
    lines.append("  /** 压缩轻量版（同一册的更小体积版本） */")
    lines.append("  lite?: boolean;")
    lines.append("  /** 学段，默认 compulsory（义务教育） */")
    lines.append("  stage?: Stage;")
    lines.append("  /** 已录入但 PDF 尚未上传，页面置灰不可下载 */")
    lines.append("  pending?: boolean;")
    lines.append("}")
    lines.append("")
    lines.append("export const SUBJECT_ORDER: SubjectKey[] = [")
    lines.append("  " + ", ".join(f"'{s}'" for s in SUBJECT_ORDER) + ",")
    lines.append("];")
    lines.append("")
    lines.append("export const SUBJECT_LABEL: Record<SubjectKey, string> = {")
    for s in SUBJECT_ORDER:
        lines.append(f"  {s}: '{SUBJECT_LABEL[s]}',")
    lines.append("};")
    lines.append("")
    lines.append("/** 每个科目的版本说明（深圳在用版本） */")
    lines.append("export const SUBJECT_NOTE: Record<SubjectKey, string> = {")
    for s in SUBJECT_ORDER:
        lines.append(f"  {s}: '{SUBJECT_NOTE[s]}',")
    lines.append("};")
    lines.append("")
    lines.append("export const GRADE_CN: Record<number, string> = {")
    lines.append("  " + ", ".join(f"{g}: '{GRADE_CN[g]}'" for g in range(1, 10)) + ",")
    lines.append("};")
    lines.append("")
    lines.append("export const TEXTBOOKS: Textbook[] = [")
    for b in books:
        if b["stage"] == "compulsory":
            g = GRADE_CN[b["grade"]]
            if b["semester"] == "全一册":
                title = f"{SUBJECT_LABEL[b['subject']]} · {g}年级 · 全一册"
            else:
                title = f"{SUBJECT_LABEL[b['subject']]} · {g}年级 · {b['semester']}"
            if b["lite"]:
                title += "（轻量版）"
            lite = ", lite: true" if b["lite"] else ""
            lines.append(
                "  { slug: '%s', subject: '%s', grade: %d, semester: '%s', publisher: '%s', title: '%s', sizeBytes: %d%s },"
                % (b["slug"], b["subject"], b["grade"], b["semester"], b["publisher"], title, b["size"], lite)
            )
        else:
            pending = ", pending: true" if b["pending"] else ""
            lines.append(
                "  { slug: '%s', subject: '%s', grade: 10, semester: '%s', publisher: '%s', title: '%s', sizeBytes: %d, stage: 'highschool'%s },"
                % (b["slug"], b["subject"], b["semester"], b["publisher"], b["title"], b["size"], pending)
            )
    lines.append("];")
    lines.append("")
    lines.append("export function formatSize(bytes: number): string {")
    lines.append("  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';")
    lines.append("  if (bytes >= 1024 * 1024) return Math.round(bytes / 1024 / 1024) + ' MB';")
    lines.append("  return Math.max(1, Math.round(bytes / 1024)) + ' KB';")
    lines.append("}")
    lines.append("")
    lines.append("/** 按科目分组的教材，供下拉框用 optgroup 渲染（科目顺序 = SUBJECT_ORDER） */")
    lines.append("export interface TextbookGroup {")
    lines.append("  subject: SubjectKey;")
    lines.append("  label: string;")
    lines.append("  books: Textbook[];")
    lines.append("}")
    lines.append("")
    lines.append("export function groupTextbooksBySubject(): TextbookGroup[] {")
    lines.append("  return SUBJECT_ORDER.map((subject) => ({")
    lines.append("    subject,")
    lines.append("    label: SUBJECT_LABEL[subject],")
    lines.append("    books: TEXTBOOKS.filter((t) => t.subject === subject),")
    lines.append("  })).filter((g) => g.books.length > 0);")
    lines.append("}")
    lines.append("")
    lines.append("/** 由 slug 反查显示名（用于作品墙/详情页展示）；非法或空返回 '' */")
    lines.append("export function textbookTitle(slug: string | null | undefined): string {")
    lines.append("  if (!slug) return '';")
    lines.append("  const t = TEXTBOOKS.find((b) => b.slug === slug);")
    lines.append("  return t ? t.title : '';")
    lines.append("}")
    lines.append("")

    with open(TS_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))

    # 2) 生成上传映射 TSV（只含真实文件）
    with open(MAP_OUT, "w", encoding="utf-8", newline="\n") as f:
        for b in books:
            if b["original"] is None:
                continue
            f.write(f"{b['slug']}.pdf\t{b['original']}\t{b['size']}\n")

    total = sum(b["size"] for b in books)
    hs_n = sum(1 for b in books if b["stage"] == "highschool")
    hs_pending = sum(1 for b in books if b.get("pending"))
    print(f"OK: {len(books)} 册, 共 {total/1024/1024:.0f} MB（其中高中 {hs_n} 册、待上传 {hs_pending} 册）")
    print(f"TS -> {TS_OUT}")
    print(f"MAP -> {MAP_OUT}")
    c = Counter(b["subject"] for b in books if b["stage"] == "compulsory")
    for s in SUBJECT_ORDER:
        print(f"  {SUBJECT_LABEL[s]:<6} 义务教育 {c[s]:>2} 册")


if __name__ == "__main__":
    main()
