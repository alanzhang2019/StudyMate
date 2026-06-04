"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useProfileStore, StudentProfile } from "@/lib/store/profile";
import { Pencil } from "lucide-react";

const TTS_VOICES = [
  { id: '', name: '默认 (全局设置)' },
  { id: 'FunAudioLLM/CosyVoice2-0.5B:alex', name: 'Alex (男声)' },
  { id: 'FunAudioLLM/CosyVoice2-0.5B:diana', name: 'Diana (女声)' },
  { id: 'FunAudioLLM/CosyVoice2-0.5B:bella', name: 'Bella (热情女声)' },
  { id: 'FunAudioLLM/CosyVoice2-0.5B:anna', name: 'Anna (温柔女声)' },
];

export default function SelectProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const setActiveProfile = useProfileStore((state) => state.setActiveProfile);
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", grade: "4", teachingStyle: "gentle", ttsVoice: "" });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated") {
      fetchProfiles();
    }
  }, [status, router]);

  const fetchProfiles = async () => {
    try {
      const res = await fetch("/api/profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } catch (error) {
      console.error("Failed to fetch profiles", error);
    }
  };

  const handleSelect = (profile: StudentProfile) => {
    setActiveProfile(profile);
    router.push("/mistake");
  };

  const handleEditClick = (e: React.MouseEvent, profile: StudentProfile) => {
    e.stopPropagation();
    setEditingId(profile.id);
    setFormData({
      name: profile.name,
      grade: profile.grade.toString(),
      teachingStyle: profile.teachingStyle,
      ttsVoice: profile.ttsVoice || ""
    });
    setShowForm(true);
  };

  const handleCreateClick = () => {
    setEditingId(null);
    setFormData({ name: "", grade: "4", teachingStyle: "gentle", ttsVoice: "" });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { id: editingId, ...formData } : formData;
      
      const res = await fetch("/api/profiles", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        fetchProfiles();
      } else {
        alert(editingId ? "修改档案失败" : "创建档案失败");
      }
    } catch (error) {
      console.error("Error saving profile", error);
    }
  };

  if (status === "loading") return <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">加载中...</div>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-8">谁在用作业通学习？</h1>
      
      <div className="flex flex-wrap gap-6 justify-center">
        {profiles.map((p) => (
          <div 
            key={p.id} 
            onClick={() => handleSelect(p)}
            className="relative flex flex-col items-center cursor-pointer group"
          >
            <div className="w-32 h-32 bg-blue-500 rounded-lg flex items-center justify-center text-4xl font-bold group-hover:ring-4 ring-white transition-all">
              {p.name.charAt(0).toUpperCase()}
            </div>
            <button 
              onClick={(e) => handleEditClick(e, p)}
              className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              title="编辑档案"
            >
              <Pencil className="w-4 h-4 text-white" />
            </button>
            <span className="mt-4 text-xl">{p.name}</span>
          </div>
        ))}
        
        <div 
          onClick={handleCreateClick}
          className="flex flex-col items-center cursor-pointer group"
        >
          <div className="w-32 h-32 border-4 border-gray-600 rounded-lg flex items-center justify-center text-4xl font-bold group-hover:border-white transition-all">
            +
          </div>
          <span className="mt-4 text-xl">添加档案</span>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-lg w-full max-w-md space-y-4">
            <h2 className="text-2xl font-bold">{editingId ? "修改档案" : "创建档案"}</h2>
            
            <div>
              <label className="block text-sm mb-1 text-gray-300">姓名</label>
              <input 
                type="text" placeholder="输入学生姓名" required
                className="w-full p-2 rounded bg-gray-700 text-white"
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1 text-gray-300">年级</label>
              <select 
                className="w-full p-2 rounded bg-gray-700 text-white"
                value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value})}
              >
                <option value="4">四年级</option>
                <option value="5">五年级</option>
                <option value="6">六年级</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm mb-1 text-gray-300">教学风格</label>
              <select 
                className="w-full p-2 rounded bg-gray-700 text-white"
                value={formData.teachingStyle} onChange={e => setFormData({...formData, teachingStyle: e.target.value})}
              >
                <option value="gentle">温柔鼓励型</option>
                <option value="strict">严格直接型</option>
                <option value="socratic">苏格拉底引导型</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1 text-gray-300">TTS 语音风格 (可选)</label>
              <select 
                className="w-full p-2 rounded bg-gray-700 text-white"
                value={formData.ttsVoice} onChange={e => setFormData({...formData, ttsVoice: e.target.value})}
              >
                {TTS_VOICES.map(voice => (
                  <option key={voice.id} value={voice.id}>{voice.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500">取消</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500">保存</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
