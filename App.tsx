
import React, { useState, useRef, useEffect } from 'react';
import { WorkbookState, AuditResult } from './types';
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

  const [isSnipMode, setIsSnipMode] = useState(false);
  const [captureBase64, setCaptureBase64] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectionRef = useRef({ startX: 0, startY: 0, endX: 0, endY: 0, active: false });

  const handleFileSelect = async (file: File) => {
    setState(prev => ({ ...prev, isAnalyzing: true, fileName: file.name, error: null }));
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await processAnalysis([base64], file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleStartCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { displaySurface: "monitor" } as any 
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      
      const fullFrame = canvas.toDataURL('image/jpeg', 1.0);
      setCaptureBase64(fullFrame);
      setIsSnipMode(true);

      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 300);

      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      console.error(err);
      setState(prev => ({ ...prev, error: "无法截屏，请重试" }));
    }
  };

  useEffect(() => {
    if (isSnipMode && captureBase64 && canvasRef.current) {
      renderSelectionCanvas();
    }
  }, [isSnipMode, captureBase64]);

  const renderSelectionCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !captureBase64) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = captureBase64;
    img.onload = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (selectionRef.current.active || selectionRef.current.endX !== 0) {
        const { startX, startY, endX, endY } = selectionRef.current;
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(endX - startX);
        const h = Math.abs(endY - startY);

        ctx.clearRect(x, y, w, h);
        ctx.drawImage(img, (x / canvas.width) * img.width, (y / canvas.height) * img.height, (w / canvas.width) * img.width, (h / canvas.height) * img.height, x, y, w, h);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, w, h);
      }
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    selectionRef.current = { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY, active: true };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectionRef.current.active) return;
    selectionRef.current.endX = e.clientX;
    selectionRef.current.endY = e.clientY;
    renderSelectionCanvas();
  };

  const handleMouseUp = () => { selectionRef.current.active = false; };

  const confirmSnip = async () => {
    const { startX, startY, endX, endY } = selectionRef.current;
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);

    if (w < 20 || h < 20) {
      setState(prev => ({ ...prev, error: "请拖动鼠标选择一个有效的题目区域" }));
      return;
    }

    const img = new Image();
    img.src = captureBase64!;
    await new Promise(r => img.onload = r);

    const canvas = document.createElement('canvas');
    canvas.width = (w / window.innerWidth) * img.width;
    canvas.height = (h / window.innerHeight) * img.height;
    const ctx = canvas.getContext('2d');
    
    ctx?.drawImage(img, (x / window.innerWidth) * img.width, (y / window.innerHeight) * img.height, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
    setIsSnipMode(false);
    setCaptureBase64(null);
    setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
    await processAnalysis([croppedBase64], `局部捕捉_${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
  };

  const processAnalysis = async (images: string[], name: string) => {
    try {
      const results = await analyzeWorkbookPages(images);
      setState(prev => ({ ...prev, isAnalyzing: false, results, fileName: name }));
    } catch (err) {
      setState(prev => ({ ...prev, isAnalyzing: false, error: "专家系统解析失败，请检查网络或图片清晰度" }));
    }
  };

  const exportToCSV = () => {
    if (state.results.length === 0) return;
    let csvContent = "\uFEFF页码,OCR原文,分类,严重程度,描述,建议\n";
    state.results.forEach(res => {
      res.errors.forEach(err => {
        csvContent += `${res.pageNumber},"${res.ocrText.replace(/"/g, '""')}",${err.category},${err.severity},"${err.description.replace(/"/g, '""')}","${err.suggestion.replace(/"/g, '""')}"\n`;
      });
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `审校报告_${state.fileName}.csv`;
    link.click();
  };

  const reset = () => setState({ isAnalyzing: false, fileName: null, results: [], error: null });

  return (
    <div className="min-h-screen bg-[#FDFDFF]">
      <header className="sticky top-0 z-40 glass border-b border-indigo-100/50 px-10 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5 cursor-pointer group" onClick={reset}>
            <div className="w-12 h-12 bg-slate-900 rounded-[1.2rem] flex items-center justify-center shadow-xl shadow-slate-200 transition-all duration-300 group-hover:scale-105 group-hover:rotate-3">
              <span className="text-white font-black text-xl">∑</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">MathAudit <span className="text-indigo-600">Expert</span></h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1.5 font-mono">Verbatim Precision Engine</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {state.fileName && (
               <div className="flex items-center gap-3 animate-slide-up">
                 <button onClick={exportToCSV} className="px-6 py-2.5 bg-slate-900 text-white text-xs font-black rounded-full hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200">
                   导出专家报告
                 </button>
                 <button onClick={reset} className="px-6 py-2.5 text-xs font-black text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all">
                   重置
                 </button>
               </div>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-10 mt-16 pb-32">
        {!state.fileName ? (
          <div className="max-w-5xl mx-auto animate-fade-in">
            <div className="flex flex-col items-center text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black tracking-widest uppercase mb-6 border border-indigo-100 shadow-sm">
                20-Year Senior Expert Persona Active
              </div>
              <h2 className="text-6xl font-black text-slate-900 mb-8 tracking-tighter leading-[1.1]">
                数学练习册<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600">工业级逐字审校台</span>
              </h2>
              <p className="text-slate-400 text-xl font-medium max-w-2xl leading-relaxed">
                遵循 2024 最新出版规范，深度核查新教材列式、Logo细节、<br/>**逐字 OCR 文字提取**及错别字精准识别。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-stretch">
              <div 
                onClick={handleStartCapture}
                className="md:col-span-5 relative cursor-pointer rounded-[3.5rem] p-12 bg-slate-900 text-white shadow-2xl shadow-indigo-100 group overflow-hidden transition-all duration-700 hover:-translate-y-3"
              >
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-2xl rounded-[1.5rem] flex items-center justify-center mb-12 ring-1 ring-white/20">
                      <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                    </div>
                    <h3 className="text-3xl font-black mb-4 tracking-tight">立即截屏核查</h3>
                    <p className="text-slate-400 text-lg font-medium leading-relaxed mb-10">
                      逐字 OCR 提取，精准识别形近字、笔画错误及数学逻辑规范。
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-3 px-6 py-3 bg-indigo-600 rounded-full text-xs font-black uppercase tracking-widest w-fit">
                    立即选取题目 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 flex flex-col gap-8">
                <FileUpload onFileSelect={handleFileSelect} isProcessing={state.isAnalyzing} />
                <div className="bg-white rounded-[3rem] p-10 border border-slate-100 card-shadow flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-lg">专家级知识库</h4>
                      <p className="text-slate-400 text-sm font-medium">覆盖乘除法列式规范与 Logo 设计细节</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center justify-between bg-white/90 backdrop-blur-xl rounded-[3rem] p-12 border border-slate-200/50 card-shadow">
               <div className="flex items-center gap-8">
                  <div className="w-20 h-20 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center shadow-2xl rotate-2">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5l5 5v11a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-1">{state.fileName}</h3>
                    <p className="text-slate-400 font-bold text-sm tracking-wide uppercase">
                      Audit result by 20-year experience expert
                    </p>
                  </div>
               </div>
            </div>
            <div className="flex flex-col gap-16">
              {state.results.map((result, idx) => <ResultCard key={idx} result={result} />)}
            </div>
          </div>
        )}
      </main>

      {/* Snipping Overlay */}
      {isSnipMode && captureBase64 && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex flex-col items-center justify-center">
          <div className="absolute top-10 flex flex-col items-center z-[210] pointer-events-none">
            <div className="px-10 py-4 bg-indigo-600 text-white rounded-2xl shadow-2xl flex items-center gap-4">
               <span className="text-lg font-black tracking-tight">请拖拽鼠标框选核查区域</span>
            </div>
          </div>
          <div className="absolute bottom-10 z-[210]">
             <button onClick={confirmSnip} className="px-12 py-5 bg-white text-slate-900 rounded-3xl font-black text-xl shadow-2xl">
                确认审校
             </button>
          </div>
          <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} className="cursor-snip" />
        </div>
      )}

      {state.isAnalyzing && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl z-[150] flex items-center justify-center p-8 animate-fade-in">
          <div className="bg-white rounded-[4rem] p-20 max-w-lg w-full text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500 scan-animation"></div>
            <div className="relative w-36 h-36 mx-auto mb-14 border-[8px] border-slate-100 rounded-full flex items-center justify-center">
               <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-2xl">
                 <span className="text-white font-black text-2xl">∑</span>
               </div>
            </div>
            <h4 className="text-3xl font-black text-slate-900 mb-6 tracking-tight">资深校对专家分析中</h4>
            <p className="text-slate-400 font-medium text-sm leading-relaxed">
              正在执行 OCR 逐字提取，检测错别字、偏旁错误、<br/>形近字混淆及数学教材出版规范...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
