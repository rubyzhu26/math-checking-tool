
import React, { useState } from 'react';
import { AuditResult } from '../types';

const SeverityBadge = ({ severity }: { severity: string }) => {
  const styles = {
    high: 'bg-rose-100 text-rose-700 border-rose-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-indigo-100 text-indigo-700 border-indigo-200'
  }[severity] || 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight ${styles}`}>
      {severity === 'high' ? '严重错误' : severity === 'medium' ? '设计风险' : '规范提示'}
    </span>
  );
};

const ResultCard: React.FC<{ result: AuditResult }> = ({ result }) => {
  const [showOCR, setShowOCR] = useState(false);

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start animate-slide-up">
      {/* Left: Page Preview Card */}
      <div className="w-full lg:w-72 shrink-0">
        <div className="sticky top-32">
          <div className="group relative bg-white rounded-2xl border border-slate-200 p-2 shadow-lg shadow-slate-200/50 hover:shadow-indigo-100/50 transition-all duration-500 overflow-hidden">
             <div className="absolute top-4 left-4 z-10">
                <div className="px-3 py-1 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black rounded-lg shadow-lg">
                  PAGE {result.pageNumber}
                </div>
             </div>
             
             {result.imageUrl ? (
               <div className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center border border-slate-100">
                 <img 
                    src={result.imageUrl} 
                    className="w-full h-full object-contain hover:scale-105 transition-transform duration-700" 
                    alt={`Page ${result.pageNumber} preview`} 
                 />
               </div>
             ) : (
               <div className="aspect-[3/4] bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 italic text-sm">
                 无图像
               </div>
             )}

             <button 
                onClick={() => setShowOCR(!showOCR)}
                className="w-full mt-2 py-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 tracking-widest uppercase transition-colors"
             >
                {showOCR ? '隐藏 OCR 文本' : '查看原始提取文本'}
             </button>
          </div>
          
          {showOCR && (
            <div className="mt-4 p-4 bg-slate-900 rounded-2xl border border-slate-800 text-[11px] font-mono text-slate-300 leading-relaxed max-h-48 overflow-y-auto shadow-2xl animate-fade-in">
              <div className="text-slate-500 mb-2 border-b border-slate-800 pb-1 font-black uppercase tracking-tighter">Verified Verbatim OCR</div>
              {result.ocrText}
            </div>
          )}
        </div>
      </div>

      {/* Right: Audit Dialog Box */}
      <div className="flex-1 w-full">
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-900 tracking-widest uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
              第 {result.pageNumber} 页 审校报告
            </h3>
            <span className="text-[10px] font-black text-slate-400">MATH-AUDIT-LOG-P{result.pageNumber}</span>
          </div>

          <div className="p-8 space-y-6">
            {result.errors.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p className="text-sm font-bold text-slate-900">质量达标，未发现预设错误</p>
              </div>
            ) : (
              result.errors.map((error, idx) => (
                <div key={idx} className="group border-l-4 border-indigo-500 bg-slate-50/30 p-6 rounded-r-3xl transition-all hover:bg-indigo-50/30">
                  <div className="flex items-center gap-3 mb-3">
                    <SeverityBadge severity={error.severity} />
                    <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">{error.category}</span>
                  </div>
                  
                  <div className="space-y-4">
                    <p className="text-sm font-bold text-slate-800 leading-relaxed">
                      {error.description}
                    </p>
                    <div className="flex gap-3 items-start bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                      <div className="p-1 rounded bg-emerald-100 text-emerald-600 shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <p className="text-xs font-bold text-slate-600 leading-normal">
                        <span className="text-emerald-600 font-black uppercase tracking-tighter mr-2">专家建议:</span>
                        {error.suggestion}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
