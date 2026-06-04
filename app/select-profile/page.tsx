import React from 'react';

export default function SelectProfilePage() {
  // Using simple state to toggle modal for visual logic completeness
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-extrabold tracking-tight mb-12 text-center text-slate-800">谁在学习？</h1>
        
        <div className="flex gap-8 justify-center flex-wrap">
          {/* Avatar 1 */}
          <button className="flex flex-col items-center gap-3 group relative">
            <div className="w-32 h-32 bg-sky-400 rounded-3xl shadow-md shadow-sky-200/50 hover:ring-4 ring-sky-300 transition-all group-hover:-translate-y-1 flex items-center justify-center text-white text-3xl font-bold relative">
              小明
              {/* Pencil Icon */}
              <div className="absolute -bottom-2 -right-2 bg-white/80 text-slate-600 p-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
            </div>
            <span className="text-lg font-bold text-slate-700">小明</span>
          </button>

          {/* Add Profile Button */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex flex-col items-center gap-3 group"
          >
            <div className="w-32 h-32 bg-white border-4 border-dashed border-slate-300 hover:border-sky-400 rounded-3xl flex items-center justify-center transition-all text-slate-400 hover:text-sky-500">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-lg font-medium text-slate-500 group-hover:text-sky-600">添加档案</span>
          </button>
        </div>

        {/* Frosted Glass Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200 text-slate-800">
              <h2 className="text-2xl font-bold mb-6 text-slate-800">新建学习档案</h2>
              <form 
                className="flex flex-col gap-5" 
                onSubmit={(e) => {
                  e.preventDefault();
                  setIsModalOpen(false);
                }}
              >
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-500 ml-1">昵称</label>
                  <input 
                    type="text" 
                    placeholder="输入名字..." 
                    className="bg-slate-50 text-slate-800 border-2 border-slate-100 focus:outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20 rounded-xl px-4 py-3 transition-all placeholder:text-slate-400"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-bold transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    type="submit" 
                    className="px-6 py-3 bg-sky-500 text-white hover:bg-sky-400 rounded-xl font-bold shadow-md shadow-sky-500/30 transition-all"
                  >
                    保存
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
