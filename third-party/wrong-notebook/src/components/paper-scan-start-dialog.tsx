"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Check, Loader2, Plus } from "lucide-react";

import { Notebook } from "@/types/api";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/LanguageContext";

interface PaperScanStartDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    notebooks: Notebook[];
    /** 新建成功后把新本子交给父页面，不用整页重刷 */
    onCreated?: (notebook: Notebook) => void;
}

/**
 * 「拍整张卷子」的入口弹窗（2026-11-12）。
 *
 * 为什么要有这一步：拍卷子挂在 /notebooks/[id]/paper 下，需要有归属本子。
 * 入口放在错题本首页后，用户可能一个本子都没有（刚注册），也可能有好几个。
 * 所以先问一句「归到哪个本子」，一个都没有就现场建一个再拍 —— 不能让人
 * 因为「还没建文件夹」就卡住。
 */
export function PaperScanStartDialog({ open, onOpenChange, notebooks, onCreated }: PaperScanStartDialogProps) {
    const router = useRouter();
    const { t } = useLanguage();
    const [selectedId, setSelectedId] = useState("");
    const [newName, setNewName] = useState("");
    const [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState(false);

    // 每次打开重置：只有一个本子就直接选它；一个都没有就直接进「新建」态
    useEffect(() => {
        if (!open) return;
        setSelectedId(notebooks.length === 1 ? notebooks[0].id : "");
        setAdding(notebooks.length === 0);
        setNewName("");
        setBusy(false);
        // 只在弹窗打开那一刻重置，不跟 notebooks 变动走
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const goScan = (notebookId: string) => {
        onOpenChange(false);
        router.push(`/notebooks/${notebookId}/paper`);
    };

    const handleStart = async () => {
        if (busy) return;
        if (!adding && selectedId) {
            goScan(selectedId);
            return;
        }
        const name = newName.trim();
        if (!name) return;
        setBusy(true);
        try {
            const created = await apiClient.post<Notebook>("/api/notebooks", { name });
            onCreated?.(created);
            goScan(created.id);
        } catch (error: any) {
            const message =
                error?.data?.message ||
                t.paper?.createNotebookFailed ||
                "新建错题本失败，换个名字再试。";
            alert(message);
        } finally {
            setBusy(false);
        }
    };

    const canStart = adding ? !!newName.trim() : !!selectedId;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t.paper?.title || "拍整张卷子"}</DialogTitle>
                    <DialogDescription>
                        {t.paper?.notice || "卷子里的错题和空白题会收进错题本，但不给答案。"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <p className="text-sm font-medium">
                        {notebooks.length === 0
                            ? (t.paper?.noNotebookHint || "你还没有错题本。给这张卷子的科目起个名字，就建好了。")
                            : (t.paper?.chooseNotebook || "这张卷子归到哪个错题本？")}
                    </p>

                    {notebooks.length > 0 && !adding && (
                        <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                            {notebooks.map((nb) => {
                                const active = nb.id === selectedId;
                                return (
                                    <button
                                        key={nb.id}
                                        type="button"
                                        onClick={() => setSelectedId(nb.id)}
                                        className={
                                            "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition " +
                                            (active
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/40 hover:bg-muted/50")
                                        }
                                    >
                                        <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{nb.name}</span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {(nb._count?.errorItems ?? 0)} {t.notebooks?.items || "题"}
                                        </span>
                                        {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {notebooks.length > 0 && !adding && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-muted-foreground"
                            onClick={() => setAdding(true)}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {t.paper?.newNotebook || "新建一个本子"}
                        </Button>
                    )}

                    {adding && (
                        <div className="space-y-2">
                            <Input
                                autoFocus
                                placeholder={t.paper?.newNotebookPlaceholder || "比如：语文、物理"}
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleStart();
                                }}
                            />
                            {notebooks.length > 0 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground"
                                    onClick={() => {
                                        setAdding(false);
                                        setNewName("");
                                    }}
                                >
                                    {t.paper?.backToPick || "还是选已有的本子"}
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        {t.common.cancel}
                    </Button>
                    <Button onClick={handleStart} disabled={busy || !canStart}>
                        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {adding
                            ? (t.paper?.newNotebookThenScan || "新建并开始拍照")
                            : (t.paper?.goScan || "去拍照")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
