'use client';

import React, { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({ theme: 'light', difficulty: 'easy' });
  const [loading, setLoading] = useState(true);

  // Mock fetch logic
  useEffect(() => {
    const fetchSettings = async () => {
      // Simulate API call
      setTimeout(() => {
        setSettings({ theme: 'light', difficulty: 'medium' });
        setLoading(false);
      }, 500);
    };
    fetchSettings();
  }, []);

  // Mock save logic
  const handleSave = async () => {
    // Simulate API call
    console.log('Settings saved:', settings);
    alert('Settings saved successfully!');
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div data-testid="settings-wrapper" className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div data-testid="settings-card" className="bg-white p-8 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 max-w-2xl mx-auto">
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-6">
          Settings
        </h2>

        <div className="space-y-6">
          <div>
            <label data-testid="settings-label" className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
              Theme
            </label>
            <select
              name="theme"
              value={settings.theme}
              onChange={handleChange}
              className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-700 font-medium focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20 transition-all outline-none cursor-pointer appearance-none"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div>
            <label data-testid="settings-label" className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
              Difficulty
            </label>
            <select
              name="difficulty"
              value={settings.difficulty}
              onChange={handleChange}
              className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-700 font-medium focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20 transition-all outline-none cursor-pointer appearance-none"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <button
            onClick={handleSave}
            className="bg-sky-500 hover:bg-sky-400 text-white rounded-xl shadow-md shadow-sky-500/30 font-bold px-6 py-3 mt-8 w-full md:w-auto transition-all active:scale-95"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
