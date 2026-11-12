"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Plus, House, Pencil, FileStack } from "lucide-react";
import Link from "next/link";
import { ErrorList } from "@/components/error-list";
import { RenameNotebookDialog } from "@/components/rename-notebook-dialog";

import { Notebook } from "@/types/api";
import { apiClient } from "@/lib/api-client";

import { useLanguage } from "@/contexts/LanguageContext";

// ... imports

export default function NotebookDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { t } = useLanguage();
    const [notebook, setNotebook] = useState<Notebook | null>(null);
    const [loading, setLoading] = useState(true);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);

    useEffect(() => {
        if (params.id) {
            fetchNotebook(params.id as string);
        }
    }, [params.id]);

    const fetchNotebook = async (id: string) => {
        try {
            const data = await apiClient.get<Notebook>(`/api/notebooks/${id}`);
            setNotebook(data);
        } catch (error) {
            console.error("Failed to fetch notebook:", error);
            alert(t.notebooks?.notFound || "Notebook not found");
            router.push("/notebooks");
        } finally {
            setLoading(false);
        }
    };

    const handleRename = async (name: string) => {
        if (!notebook) return;
        const updated = await apiClient.put<Notebook>(`/api/notebooks/${notebook.id}`, { name });
        setNotebook(updated);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-muted-foreground">{t.common.loading}</p>
            </div>
        );
    }

    if (!notebook) return null;

    return (
        <main className="min-h-screen p-4 md:p-8 bg-background">
            <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
                <div className="flex items-start gap-4">
                    <BackButton fallbackUrl="/notebooks" className="shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{notebook.name}</h1>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setRenameDialogOpen(true)}
                                title={t.notebooks?.rename || "Rename"}
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-muted-foreground text-sm sm:text-base">
                            {(t.notebooks?.totalErrors || "Total {count} errors").replace("{count}", (notebook._count?.errorItems || 0).toString())}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* ★ 批次 WNPAPER：拍整张卷子。与「+ 加一道」并列，因为它解决的是
                            同一个问题（往本子里加错题），只是入口粒度不同：一张 vs 一道。 */}
                        <Link href={`/notebooks/${notebook.id}/paper`}>
                            <Button size="sm" variant="outline" className="hidden sm:flex">
                                <FileStack className="mr-2 h-4 w-4" />
                                {t.paper?.title || "拍整张卷子"}
                            </Button>
                            <Button size="icon" variant="outline" className="sm:hidden" aria-label={t.paper?.title || "拍整张卷子"}>
                                <FileStack className="h-4 w-4" />
                            </Button>
                        </Link>
                        <Link href={`/notebooks/${notebook.id}/add`}>
                            <Button size="sm" className="hidden sm:flex">
                                <Plus className="mr-2 h-4 w-4" />
                                {t.notebooks?.addError || "Add Error"}
                            </Button>
                            <Button size="icon" className="sm:hidden">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </Link>
                        <Link href="/">
                            <Button variant="ghost" size="icon">
                                <House className="h-5 w-5" />
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* ★ WNPAPER：手机上标题栏只剩一个图标，功能会被当成"没做出来"。
                    所以在列表上方补一条带文字的入口（只移动端显示；桌面端用标题栏那个）。 */}
                <Link href={`/notebooks/${notebook.id}/paper`} className="block sm:hidden">
                    <Button variant="outline" className="w-full justify-center">
                        <FileStack className="mr-2 h-4 w-4" />
                        {t.paper?.title || "拍整张卷子"}
                    </Button>
                </Link>

                <ErrorList subjectId={notebook.id} subjectName={notebook.name} />

                <RenameNotebookDialog
                    open={renameDialogOpen}
                    onOpenChange={setRenameDialogOpen}
                    currentName={notebook.name}
                    onRename={handleRename}
                />
            </div>
        </main>
    );
}
