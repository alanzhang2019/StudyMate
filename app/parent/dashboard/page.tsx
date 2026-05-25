"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function ParentDashboard() {
  const { data: session } = useSession();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [reports, setReports] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetch("/api/profiles").then(res => res.json()).then(setProfiles);
    }
  }, [session]);

  const generateReport = async (studentId: string) => {
    setLoading(studentId);
    try {
      const res = await fetch("/api/parent/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId })
      });
      if (res.ok) {
        const data = await res.json();
        setReports(prev => ({ ...prev, [studentId]: data.summary }));
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(null);
  };

  return (
    <div className="space-y-8 text-black">
      <h2 className="text-2xl font-bold">Analytics Overview</h2>
      
      {profiles.length === 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <p>No profiles found. Go to <a href="/select-profile" className="text-blue-600 underline">Switch Profile</a> to create one.</p>
        </div>
      )}

      {profiles.map(profile => (
        <div key={profile.id} className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-bold mb-4">{profile.name} - Grade {profile.grade}</h3>
          
          <button 
            onClick={() => generateReport(profile.id)}
            disabled={loading === profile.id}
            className="px-4 py-2 bg-blue-600 text-white rounded mb-4 hover:bg-blue-500 disabled:opacity-50"
          >
            {loading === profile.id ? "Generating..." : "Generate AI Report"}
          </button>

          {reports[profile.id] && (
            <div className="p-4 bg-blue-50 rounded text-gray-800 mb-4 border border-blue-100">
              <h4 className="font-bold mb-2">AI Analysis</h4>
              <p>{reports[profile.id]}</p>
            </div>
          )}

          <p className="text-gray-500 italic">Knowledge Graphs coming in future iterations...</p>
        </div>
      ))}
    </div>
  );
}
