# -*- coding: utf-8 -*-
"""向 exam_papers_manifest.json 追加 2025 深圳中考回忆版真题条目（幂等）。"""
import json, os, sys

MANIFEST = r"D:\AItrade\ai-math-mistake-machine\.workbuddy\exam_papers_manifest.json"
SRC_BASE = r"D:\ima_work\深圳K12教材与真题\中考真题\广东\广东省2025\深圳市"

NEW = [
    dict(
        slug="chinese-2025-recall",
        subject="chinese",
        year=2025,
        variant="recall",
        title="语文 · 2025 · 真题（回忆版）",
        fileName="chinese-2025-recall.pdf",
        src=os.path.join(SRC_BASE, r"语文（真题+答案）\2025年深圳市中考语文学真题回忆版.pdf"),
    ),
    dict(
        slug="english-2025-recall-key",
        subject="english",
        year=2025,
        variant="recall-key",
        title="英语 · 2025 · 参考答案（回忆版）",
        fileName="english-2025-recall-key.pdf",
        src=os.path.join(SRC_BASE, r"英语（真题+答案）\2025年深圳市中考英语真题答案回忆版.pdf"),
    ),
    dict(
        slug="biology-2025-recall-answer",
        subject="biology",
        year=2025,
        variant="recall-answer",
        title="生物 · 2025 · 真题及答案（回忆版）",
        fileName="biology-2025-recall-answer.pdf",
        src=os.path.join(SRC_BASE, r"生物（真题+答案）\2025年深圳市中考生物真题及答案回忆版.pdf"),
    ),
    dict(
        slug="ethics-2025-recall-key",
        subject="ethics",
        year=2025,
        variant="recall-key",
        title="道德与法治 · 2025 · 参考答案（回忆版）",
        fileName="ethics-2025-recall-key.pdf",
        src=os.path.join(SRC_BASE, r"道法（真题+答案）\2025 深圳中考道法(回忆版)参考答案.pdf"),
    ),
]

with open(MANIFEST, encoding="utf-8") as f:
    m = json.load(f)

have = {e["slug"] for e in m}
added = 0
for e in NEW:
    if e["slug"] in have:
        print("skip(exists):", e["slug"])
        continue
    if not os.path.isfile(e["src"]):
        print("MISSING SRC:", e["src"], file=sys.stderr)
        sys.exit(1)
    size = os.path.getsize(e["src"])
    e = dict(e)
    e["ext"] = "pdf"
    e["sizeBytes"] = size
    m.append(e)
    added += 1
    print("added:", e["slug"], size)

with open(MANIFEST, "w", encoding="utf-8", newline="\n") as f:
    json.dump(m, f, ensure_ascii=False, indent=1)
    f.write("\n")

print("total entries:", len(m), "| newly added:", added)
