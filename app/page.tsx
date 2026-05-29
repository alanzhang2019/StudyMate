'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/mistake');
  }, [router]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-indigo-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
      </div>
      
      <div className="relative text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl shadow-lg flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
        <p className="text-lg font-medium text-slate-700">Redirecting...</p>
        <p className="text-sm text-slate-500 mt-2">Preparing your AI tutoring experience</p>
      </div>
    </main>
  );
}
