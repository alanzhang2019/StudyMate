'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';

// Force dynamic rendering on every request. Without this, Next.js prerenders
// the HTML at build time and caches it for a year (`Cache-Control:
// s-maxage=31536000`), which means the AccessCodeGuard's runtime check for
// `process.env.ACCESS_CODE` is frozen at build time. If you ever flip the
// access code on or off in `.env`, users keep seeing the old behavior until
// the static cache expires or is manually purged.
export const dynamic = 'force-dynamic';

import { Card } from '@/components/ui/card';
import { useI18n } from '@/lib/hooks/use-i18n';
import { getHomeworkHomeContent } from '@/lib/mistake/ui/content';
import { useProfileStore } from '@/lib/store/profile';
import { useAudioRecorder } from '@/lib/hooks/use-audio-recorder';
import { ImageCropper } from '@/components/image-cropper';
import { saveGenerationPreviewSession } from '@/lib/mistake/ui/generation-preview-storage';
import { writePendingRecognizeSession } from '@/lib/mistake/ui/recognize-session';
import { buildPendingRecognizeImageUrl } from '@/lib/mistake/ui/pending-recognize-image';
import { buildMistakeClassroomRequirement } from '@/lib/mistake/openmaic/build-requirement';
import { normalizeFetchErrorMessage } from '@/lib/mistake/ui/normalize-fetch-error';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import { nanoid } from 'nanoid';
import { buildMistakeExtractHeaders } from './extract-api-headers';

import { Camera, History, Sparkles, AlertTriangle, Mic, Loader2, Keyboard, Send, ImagePlus, Crop, Trash2 } from 'lucide-react';

type PageStatus =
  | 'idle'
  | 'extracting'
  | 'creating_session'
  | 'starting_preview'
  | 'error';

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  cropped?: boolean;
}

export default function HomeworkPage() {
  const { t } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isTextMode, setIsTextMode] = useState(false);
  const [status, setStatus] = useState<PageStatus>('idle');
  const [error, setError] = useState('');
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropImageIndex, setCropImageIndex] = useState<number>(-1);
  const activeProfile = useProfileStore((s) => s.activeProfile);
  const homeContent = getHomeworkHomeContent(t);

  const { isRecording, isProcessing, startRecording, stopRecording } = useAudioRecorder({
    onTranscription: (text) => {
      setTextInput((prev) => prev + text);
      setIsTextMode(true);
    },
    onError: (err) => {
      setError(err);
    },
  });

  const isStartingPreview = status === 'creating_session' || status === 'starting_preview';
  const isExtracting = status === 'extracting';
  const isLoading = isExtracting || isStartingPreview;

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [textInput]);

  // Handle file selection
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newImages: ImageItem[] = [];
    Array.from(files).forEach((file) => {
      const previewUrl = URL.createObjectURL(file);
      newImages.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        previewUrl,
      });
    });

    setImages(prev => [...prev, ...newImages]);
    setIsTextMode(false);
    setStatus('idle');
    setError('');

    // Reset input so same file can be selected again
    event.target.value = '';
  }, []);

  // Remove image
  const removeImage = useCallback((index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].previewUrl);
      newImages.splice(index, 1);
      return newImages;
    });
  }, []);

  // Start crop
  const startCrop = useCallback((index: number) => {
    setCropImageUrl(images[index].previewUrl);
    setCropImageIndex(index);
  }, [images]);

  // Handle crop complete
  const handleCropComplete = useCallback((croppedBlob: Blob) => {
    if (cropImageIndex < 0) return;

    const croppedFile = new File([croppedBlob], `cropped_${images[cropImageIndex].file.name}`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    const newPreviewUrl = URL.createObjectURL(croppedBlob);

    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[cropImageIndex].previewUrl);
      newImages[cropImageIndex] = {
        ...newImages[cropImageIndex],
        file: croppedFile,
        previewUrl: newPreviewUrl,
        cropped: true,
      };
      return newImages;
    });

    setCropImageUrl(null);
    setCropImageIndex(-1);
  }, [cropImageIndex, images]);

  // Cancel crop
  const handleCropCancel = useCallback(() => {
    setCropImageUrl(null);
    setCropImageIndex(-1);
  }, []);

  // Convert file to base64
  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleExtract() {
    if (images.length === 0) {
      setError('请先上传图片');
      setStatus('error');
      return;
    }

    setStatus('extracting');
    setError('');

    try {
      const primaryImage = images[0].file;

      // Build FormData for extract API
      const formData = new FormData();
      formData.append('image', primaryImage);
      formData.append('imageCount', images.length.toString());
      formData.append('subject', 'math');

      if (activeProfile?.grade) {
        formData.append('grade', activeProfile.grade.toString());
      }

      // Add additional images if present
      if (images.length > 1) {
        for (let i = 1; i < images.length; i++) {
          formData.append('additionalImages', images[i].file);
        }
      }

      // Call extract API to recognize the problem from image
      const modelConfig = getCurrentModelConfig();
      const response = await fetch('/api/mistake/session/extract', {
        method: 'POST',
        body: formData,
        headers: buildMistakeExtractHeaders(modelConfig),
      });

      const json = await response.json();

      if (!response.ok || json.error) {
        setStatus('error');
        setError(json.error?.message || json.error || '识别题目失败');
        return;
      }

      // Handle API response format: apiSuccess returns { success: true, ...data }
      // So extraction is directly in json, not json.data
      const extraction = json.extraction || json.data?.extraction;

      if (!extraction) {
        setStatus('error');
        setError('未能识别出题目内容，请重试');
        return;
      }

      // Store image in IndexedDB and get storage key
      const imageStorageKey = await buildPendingRecognizeImageUrl(primaryImage);

      // Save extraction result to pending session for recognize page
      try {
        writePendingRecognizeSession({
          ...extraction,
          imageUrl: imageStorageKey,
        });

        // Navigate to recognize page to show extraction result
        router.push('/mistake/recognize');
      } catch (flowError) {
        setStatus('error');
        setError(flowError instanceof Error ? flowError.message : '进入讲解失败');
      }
    } catch (err) {
      console.error('[Mistake] Extract failed:', err);
      setStatus('error');
      setError(
        normalizeFetchErrorMessage(err, {
          fileSizes: images.map((img) => img.file.size),
        }),
      );
    }
  }

  async function handleTextSubmit() {
    if (!textInput.trim()) {
      setError('请输入题目内容');
      setStatus('error');
      return;
    }

    setStatus('extracting');
    setError('');

    try {
      // Call generate-classroom API with text
      const response = await fetch('/api/mistake/session/generate-classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: activeProfile?.grade || 4,
          subject: 'math',
          source: 'manual',
          problemText: textInput.trim(),
          studentName: activeProfile?.name || '学生',
          teachingStyle: activeProfile?.teachingStyle || '幽默风趣',
          studentProfileId: activeProfile?.id,
        }),
      });

      const json = await response.json();

      if (!response.ok || json.error) {
        setStatus('error');
        setError(json.error || '生成课件失败');
        return;
      }

      // Navigate to preview
      setStatus('starting_preview');
      saveGenerationPreviewSession({
        sessionId: nanoid(),
        requirements: {
          requirement: buildMistakeClassroomRequirement({
            grade: activeProfile?.grade || 4,
            subject: 'math',
            source: 'manual',
            problemText: textInput.trim(),
            studentName: activeProfile?.name || '学生',
            teachingStyle: activeProfile?.teachingStyle || '幽默风趣',
          }),
        },
        pdfText: '',
        currentStep: 'generating',
        mistakeSessionId: json.jobId || json.sessionId,
      });
      router.push('/generation-preview');
    } catch (err) {
      console.error('[Mistake] Text submission failed:', err);
      setStatus('error');
      setError(normalizeFetchErrorMessage(err));
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (images.length > 0) {
        handleExtract();
      } else if (textInput.trim()) {
        handleTextSubmit();
      }
    }
  };

  const hasContent = images.length > 0 || textInput.trim();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-indigo-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        type="file"
        multiple
        onChange={handleFileChange}
      />

      {/* Image Cropper Modal */}
      <AnimatePresence>
        {cropImageUrl && (
          <ImageCropper
            imageUrl={cropImageUrl}
            onCrop={handleCropComplete}
            onCancel={handleCropCancel}
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="relative flex-1 flex flex-col mx-auto w-full max-w-3xl px-4 py-8 md:py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm mb-6 border border-blue-100">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-600">AI 智能讲解</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-800 via-blue-700 to-indigo-700 bg-clip-text text-transparent mb-4">
            {homeContent.title}
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            {homeContent.subtitle}
          </p>
          <p className="text-sm text-slate-500 mt-3">{homeContent.uploadTip}</p>
        </motion.div>

        {/* Image Preview Area - Multiple Images */}
        <AnimatePresence>
          {images.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mb-6 space-y-4"
            >
              {/* Image Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {images.map((img, index) => (
                  <motion.div
                    key={img.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    layout
                  >
                    <Card className="overflow-hidden border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                      <div className="relative">
                        <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.previewUrl}
                            alt={`题目图片 ${index + 1}`}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        {/* Image number badge */}
                        <div className="absolute top-3 left-3 px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-lg">
                          {index + 1}
                        </div>
                        {/* Action buttons */}
                        <div className="absolute top-3 right-3 flex gap-2">
                          <button
                            onClick={() => startCrop(index)}
                            className="p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                            title="裁剪"
                          >
                            <Crop className="w-4 h-4 text-slate-600" />
                          </button>
                          <button
                            onClick={() => removeImage(index)}
                            className="p-2 bg-white/90 hover:bg-red-50 rounded-full shadow-lg transition-all duration-200 hover:rotate-90"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Add more images button */}
              {images.length < 4 && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl text-slate-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                >
                  <ImagePlus className="w-5 h-5" />
                  <span>添加更多图片（最多4张）</span>
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Spacer to push input to bottom */}
        <div className="flex-1" />

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Input Bar - Doubao Style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="sticky bottom-4 z-10"
        >
          <Card className="border-0 shadow-2xl shadow-blue-500/10 bg-white/95 backdrop-blur-xl rounded-2xl overflow-hidden">
            <div className="p-3">
              {/* Text Input Mode */}
              <AnimatePresence>
                {isTextMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-3"
                  >
                    <div className="flex items-end gap-2 bg-slate-100 rounded-xl px-4 py-2">
                      <textarea
                        ref={textareaRef}
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="输入题目内容..."
                        rows={1}
                        className="flex-1 bg-transparent border-none outline-none resize-none text-slate-700 placeholder:text-slate-400 max-h-32 py-1"
                      />
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          if (textInput.trim()) {
                            handleTextSubmit();
                          }
                          setIsTextMode(false);
                        }}
                        disabled={isLoading || !textInput.trim()}
                        className={`flex-shrink-0 p-2 rounded-lg transition-colors duration-200 ${
                          isLoading
                            ? 'bg-slate-200 text-slate-400'
                            : textInput.trim()
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-200 text-slate-400'
                        }`}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Input Bar */}
              <div className="flex items-center gap-3">
                {/* Left: Camera Button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 p-3 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 transition-colors duration-200 relative"
                >
                  <Camera className="w-5 h-5" />
                  {images.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {images.length}
                    </span>
                  )}
                </motion.button>

                {/* Center: Voice Button (Doubao Style) */}
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (!isTextMode && !isProcessing) {
                      startRecording();
                    }
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    if (isRecording) {
                      stopRecording();
                    }
                  }}
                  onPointerLeave={(e) => {
                    if (isRecording) {
                      stopRecording();
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={isProcessing || isTextMode}
                  className={`flex-1 py-3 px-6 rounded-full font-medium text-base transition-all duration-200 select-none touch-none ${
                    isRecording
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-[0.98]'
                      : isProcessing
                        ? 'bg-slate-200 text-slate-400'
                        : isTextMode
                          ? 'bg-slate-100 text-slate-400'
                          : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg hover:shadow-xl active:scale-[0.98]'
                  }`}
                >
                  {isRecording ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      松开结束
                    </span>
                  ) : isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      识别中...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Mic className="w-4 h-4" />
                      按住说话
                    </span>
                  )}
                </button>

                {/* Right: Keyboard & Send Buttons */}
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsTextMode(!isTextMode)}
                    className={`flex-shrink-0 p-3 rounded-full transition-colors duration-200 ${
                      isTextMode
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600'
                    }`}
                  >
                    <Keyboard className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      if (images.length > 0) {
                        handleExtract();
                      } else if (textInput.trim()) {
                        handleTextSubmit();
                      }
                    }}
                    disabled={isLoading || !hasContent}
                    className={`flex-shrink-0 p-3 rounded-full transition-all duration-200 ${
                      isLoading
                        ? 'bg-slate-200 text-slate-400'
                        : hasContent
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg hover:shadow-xl'
                          : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </motion.button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* History Button */}
        <div className="flex justify-center mt-4 mb-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/history')}
            className="px-6 py-3 bg-white/80 hover:bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            {homeContent.ctaSecondary}
          </motion.button>
        </div>
      </div>
    </main>
  );
}
