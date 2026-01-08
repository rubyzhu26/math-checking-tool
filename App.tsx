
import React, { useState, useRef, useEffect } from 'react';
import { WorkbookState, AuditResult, FilePart } from './types';
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

  // Convert PDF file to an array of base64 images (one per page)
  const pdfToImages = async (file: File): Promise<FilePart[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const images: FilePart[] = [];

    // Limit to first 10 pages for performance/token reasons in this prototype
    const pagesToProcess = Math.min(pdf.numPages, 10);

    for (let i = 1; i <= pagesToProcess; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      images.push({ data: dataUrl, mimeType: 'image/jpeg' });
    }
    return images;
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    setState(prev => ({ ...prev, isAnalyzing: true, fileName: file.name, error: null, results: [] }));
    
    try {
      let fileParts: FilePart[] = [];
      
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        fileParts = await pdfToImages(file);
      } else {
        const base64 = await readFileAsDataURL(file);
        fileParts = [{
          data: base64,
          mimeType: file.type || 'image/jpeg'
        }];
      }

      await processAnalysis(fileParts, file.name);
    } catch (err) {
      console.error("File processing error:", err);
      setState(prev => ({ ...prev, isAnalyzing: false, error: "文档处理失败，请重试" }));
    }
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
    setState(prev => ({ ...prev, isAnalyzing: true, error: null, results: [] }));
    await processAnalysis([{ data: croppedBase64, mimeType: 'image/jpeg' }], `局部捕捉_${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
  };

  const processAnalysis = async (files: FilePart[], name: string) => {
    try {
      const results = await analyzeWorkbookPages(files);
      setState(prev => ({ ...prev, isAnalyzing: false, results, fileName: name }));
    } catch (err) {
      console.error("API Error:", err);
      setState(prev => ({ ...prev, isAnalyzing: false, error: "专家系统解析失败，请检查网络或文档清晰度" }));
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
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-indigo-100/50 px-10 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5 cursor-pointer group" onClick={reset}>
            <div className="w-12 h-12 bg-slate-900 rounded-[1.2rem] flex items-center justify-center shadow-xl shadow-slate-200 transition-all duration-300 group-hover:scale-105 group-hover:rotate-3">
              <span className="text-white font-black text-xl">∑</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">MathAudit <span className="text-indigo-600">Expert</span></h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1.5 font-mono text-xs">Verbatim Precision Engine</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {state.fileName && !state.isAnalyzing && (
               <div className="flex items-center gap-3 animate-slide-up">
                 <button onClick={exportToCSV} className="px-6 py-2.5 bg-slate-900 text-white text-xs font-black rounded-full hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200">
                   导出 CSV 报告
                 </button>
                 <button onClick={reset} className="px-6 py-2.5 text-xs font-black text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all">
                   重置
                 </button>
               </div>
             )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 lg:px-10 mt-16 pb-32">
        {!state.fileName || (state.isAnalyzing && state.results.length === 0) ? (
          <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="flex flex-col items-center text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black tracking-widest uppercase mb-6 border border-indigo-100 shadow-sm">
                Industrial-Grade Audit System
              </div>
              <h2 className="text-5xl lg:text-6xl font-black text-slate-900 mb-8 tracking-tighter leading-[1.1]">
                数学练习册<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600">工业级逐字审校台</span>
              </h2>
              <p className="text-slate-400 text-lg lg:text-xl font-medium max-w-2xl leading-relaxed">
                遵循 2024 最新出版规范，深度核查新教材列式、Logo细节、<br/>**逐字 OCR 文字提取**、PDF 多页审校及错别字精准识别。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              <div 
                onClick={handleStartCapture}
                className="relative cursor-pointer rounded-[3rem] p-12 bg-slate-900 text-white shadow-2xl shadow-indigo-100 group overflow-hidden transition-all duration-700 hover:-translate-y-2 border border-slate-800"
              >
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="w-14 h-14 bg-white/10 backdrop-blur-2xl rounded-2xl flex items-center justify-center mb-10 ring-1 ring-white/20">
                      <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" strokeWidth="2.5" /></svg>
                    </div>
                    <h3 className="text-2xl font-black mb-4 tracking-tight">截屏核查局部</h3>
                    <p className="text-slate-400 text-base font-medium leading-relaxed mb-8">
                      精确框选练习册中的某个题目或图形，立即进行针对性纠错分析。
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest group-hover:gap-4 transition-all">
                    开始截屏 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </div>

              <FileUpload onFileSelect={handleFileSelect} isProcessing={state.isAnalyzing} />
            </div>
          </div>
        ) : (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
               <div>
                 <div className="flex items-center gap-3 mb-4">
                   <div className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-indigo-200">ACTIVE SESSION</div>
                   <h2 className="text-sm font-black text-slate-400 tracking-widest uppercase font-mono">Document: {state.fileName}</h2>
                 </div>
                 <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter">专家审校反馈清单</h1>
               </div>
               <div className="flex items-center gap-3">
                 <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                    <span className="text-2xl font-black text-slate-900">{state.results.length}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Total Pages</span>
                 </div>
                 <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                    <span className="text-2xl font-black text-rose-600">{state.results.reduce((acc, r) => acc + r.errors.length, 0)}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Detected Issues</span>
                 </div>
               </div>
            </div>
            
            <div className="flex flex-col gap-24">
              {state.results.map((result, idx) => (
                <ResultCard key={idx} result={result} />
              ))}
            </div>

            <div className="mt-20 pt-20 border-t border-slate-200 text-center">
               <button 
                  onClick={reset}
                  className="px-10 py-4 bg-slate-900 text-white rounded-full font-black text-sm tracking-widest uppercase hover:scale-105 transition-transform"
               >
                 审校完成，上传新文件
               </button>
            </div>
          </div>
        )}
      </main>

      {/* Snipping Overlay */}
      {isSnipMode && captureBase64 && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex flex-col items-center justify-center animate-fade-in">
          <div className="absolute top-10 flex flex-col items-center z-[210] pointer-events-none">
            <div className="px-10 py-4 bg-indigo-600 text-white rounded-2xl shadow-2xl flex items-center gap-4">
               <span className="text-lg font-black tracking-tight">请拖拽鼠标框选核查区域</span>
            </div>
          </div>
          <div className="absolute bottom-10 z-[210]">
             <button onClick={confirmSnip} className="px-12 py-5 bg-white text-slate-900 rounded-3xl font-black text-xl shadow-2xl hover:scale-105 active:scale-95 transition-transform">
                确认审校
             </button>
          </div>
          <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} className="cursor-snip" />
        </div>
      )}

      {/* Shutter Flash */}
      {isFlashing && (
        <div className="fixed inset-0 bg-white z-[300] shutter-flash pointer-events-none" />
      )}

      {/* Expert Loading Overlay */}
      {state.isAnalyzing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[999] flex items-center justify-center p-8 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-12 max-w-sm w-full text-center relative overflow-hidden shadow-[0_32px_128px_-16px_rgba(0,0,0,0.4)] border border-white/20 transform-gpu">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 overflow-hidden">
                <div className="h-full bg-indigo-600 w-1/3 animate-[progress_1.5s_ease-in-out_infinite]"></div>
            </div>
            
            <div className="relative flex flex-col items-center">
                <div className="relative w-32 h-32 mb-10">
                    <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-25"></div>
                    <div className="absolute inset-0 border-4 border-slate-50 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200/50">
                            <span className="text-white font-black text-3xl">∑</span>
                        </div>
                    </div>
                </div>

                <h4 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">
                    资深专家文档审校中...
                </h4>
                <p className="text-slate-500 font-medium text-sm leading-relaxed">
                    正在提取内容并检测错别字、<br/>
                    拼点规则及数学逻辑规范...
                </p>

                <div className="mt-8 flex flex-col gap-2 items-center">
                   <div className="flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expert Engine Active</span>
                   </div>
                   <div className="text-[10px] text-slate-300 font-medium">遵循 2024 出版规范</div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {state.error && (
        <div className="fixed bottom-12 right-12 bg-rose-600 text-white px-8 py-5 rounded-[2rem] shadow-2xl z-[160] text-sm font-bold flex items-center gap-4 animate-slide-up border border-rose-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{state.error}</span>
          <button onClick={() => setState(s => ({...s, error: null}))} className="ml-4 hover:scale-110 transition-transform">✕</button>
        </div>
      )}
    </div>
  );
};

export default App;
