"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ProgressStatus = 'compressing' | 'uploading' | 'analyzing' | 'processing' | 'saving' | 'idle';

interface ProgressFeedbackProps {
    status: ProgressStatus;
    progress?: number;
    message?: string;
    /** 已经等了多少秒（可选）。★ 2026-11-12：上游模型耗时 30~184s 波动极大，
     *  这条进度条本身是**模拟**的（见调用方 setInterval），光看百分比会以为"卡在 91%"。
     *  把真实等待秒数并排显示出来，学生/家长才判断得出"是在跑"还是"该重试"。 */
    elapsedSec?: number;
    className?: string;
}

import { useLanguage } from "@/contexts/LanguageContext";

export function ProgressFeedback({ status, progress, message, elapsedSec, className }: ProgressFeedbackProps) {
    const { t } = useLanguage();
    // 确保只在客户端挂载完成后才渲染遮罩层，防止 SSR/Hydration 问题
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // 只有在客户端挂载完成且 status 不为 idle 时才渲染
    if (!isMounted || status === 'idle') return null;

    return (
        <div className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
            className
        )}>
            <div className="w-full max-w-md p-6 space-y-6 bg-card rounded-lg border shadow-lg mx-4">
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                    <div className="relative">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            {/* Optional: Add an icon inside the spinner if needed */}
                        </div>
                    </div>

                    <div className="space-y-2 w-full">
                        <h3 className="text-lg font-semibold tracking-tight">
                            {message}
                        </h3>
                        {progress !== undefined && (
                            <Progress value={progress} className="h-2 w-full" />
                        )}
                    </div>

                    <p className="text-sm text-muted-foreground">
                        {progress !== undefined ? `${Math.round(progress)}%` : (t.common.pleaseWait || 'Please wait...')}
                        {elapsedSec !== undefined && elapsedSec > 0 ? ` · ${elapsedSec}s` : ''}
                    </p>
                    {elapsedSec !== undefined && elapsedSec > 45 && (
                        <p className="text-xs text-muted-foreground/80">
                            {t.common.progress?.stillWorking || '题目解析中，通常需要 30~90 秒，请先别关页面…'}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

