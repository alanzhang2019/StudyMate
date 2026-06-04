export function getHomeworkResultShellLayout(showSimple: boolean) {
  return {
    rootClassName: 'relative min-h-0 flex-1 overflow-hidden bg-background',
    stageHostClassName: 'absolute inset-0 min-h-0 flex flex-col',
    summaryPanelClassName:
      'pointer-events-none absolute right-4 bottom-4 z-30 flex justify-end',
    summaryCardClassName: showSimple
      ? 'pointer-events-auto w-[420px] max-w-md rounded-2xl border bg-background/95 shadow-xl backdrop-blur'
      : 'pointer-events-auto w-[420px] max-w-md rounded-2xl border bg-background/92 shadow-xl backdrop-blur',
  };
}
