
import React, { useState } from 'react';
import { WorkbookState, AuditResult, ErrorDetail } from './types';
import FileUpload from './components/FileUpload';
import ResultCard from './components/ResultCard';
import { analyzeWorkbookPages } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<WorkbookState>({
    isAnalyzing: false,
    fileName: null,
    results: [],
    error: null,
  });

  const handleFileSelect = async (file: File) => {
    setState(prev => ({ ...prev, isAnalyzing: true, fileName: file.name, error: null }));
    
    // In a real browser environment with PDF.js, we would split PDF into images here.
    // For this implementation, we handle single or multiple image uploads via File API.
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await processAnalysis([base64], file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureScreenshot = async () => {
    try {
      setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } as any });
      const track = stream.getVideoTracks()[0];
      const imageCapture = new (window as any).ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(bitmap, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      
      track.stop();
      await processAnalysis([base64], `截图审校_${new Date().toLocaleTimeString()}`);
    } catch (err: any) {
      setState(prev => ({ ...prev, isAnalyzing: false, error: "未获得截图权限或操作取消" }));
    }
  };

  const processAnalysis = async (images: string[], name: string) => {
    try {
      const results = await analyzeWorkbookPages(images);
      setState(prev => ({ ...prev, isAnalyzing: false, results, fileName: name }));
    } catch (err) {
      setState(prev => ({ ...prev, isAnalyzing: false, error: "AI 分析引擎异常，请检查配置" }));
    }
  };

  const exportToCSV = () => {
    if (state.results.length === 0) return;

    // BOM for Excel Chinese compatibility
    let csvContent = "\uFEFF页码,分类,严重程度,问题描述,修改建议\n";
    state.results.forEach(res => {
      res.errors.forEach(err => {
        const row = [
          res.pageNumber,
          err.category,
          err.severity === 'high' ? '严重' : err.severity === 'medium' ? '中等' : '低',
          `"${err.description.replace(/"/g, '""')}"`,
          `"${err.suggestion.replace(/"/g, '""')}"`
        ].join(",");
        csvContent += row + "\n";
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `数学审校报告_${state.fileName || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setState({ isAnalyzing: false, fileName: null, results: [], error: null });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 glass border-b border-slate-200/50 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-lg">∑</span>
            </div>
            <div>
              <h1 className="text-md font-extrabold tracking-tight text-slate-900">MATH AUDIT <span className="text-indigo-600">PRO</span></h1>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">教育出版级审校系统</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {state.fileName && (
               <>
                 <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 transition-all">
                   <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5l5 5v11a2 2 0 01-2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                   导出 Excel 报告
                 </button>
                 <button onClick={reset} className="px-4 py-2 rounded-full text-[11px] font-bold text-slate-500 hover:text-indigo-600 border border-slate-200">重新开始</button>
               </>
             )}
             {!state.fileName && !state.isAnalyzing && (
               <button onClick={handleCaptureScreenshot} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100">
                 截图审校
               </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 mt-12 pb-32">
        {!state.fileName ? (
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-8">
              <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">
                数学练习册<span className="text-indigo-600">AI 智能审校</span>
              </h2>
              <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
                深度集成“乘法规范、对齐准则、Logo识别”等出版级核心逻辑。
              </p>
            </div>
            <FileUpload onFileSelect={handleFileSelect} isProcessing={state.isAnalyzing} />
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 opacity-60">
              {["列式规范核查", "左对齐准则", "Logo细节比对", "标点全半角"].map(tag => (
                <div key={tag} className="px-4 py-2 rounded-xl bg-white border border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tag}</div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between bg-white/50 rounded-3xl p-6 border border-slate-200">
               <div>
                  <h3 className="text-xl font-bold text-slate-900">{state.fileName}</h3>
                  <p className="text-slate-500 text-xs mt-1">共分析 {state.results.length} 页内容</p>
               </div>
               <div className="flex gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-black text-rose-600">{state.results.reduce((acc, r) => acc + r.errors.filter(e => e.severity === 'high').length, 0)}</div>
                    <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest">严重问题</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black text-indigo-600">{state.results.reduce((acc, r) => acc + r.errors.length, 0)}</div>
                    <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">总检出项</div>
                  </div>
               </div>
            </div>

            <div className="flex flex-col gap-10">
              {state.results.map((result, idx) => <ResultCard key={idx} result={result} />)}
            </div>
          </div>
        )}
      </main>

      {state.error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 text-xs font-bold border border-white/10">
          ⚠️ {state.error}
        </div>
      )}
    </div>
  );
};

export default App;
