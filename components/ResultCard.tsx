
import React from 'react';
import { AuditResult } from '../types';

const SeverityBadge = ({ severity }: { severity: string }) => {
  const styles = {
    high: 'bg-rose-100 text-rose-700 border-rose-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-indigo-100 text-indigo-700 border-indigo-200'
  }[severity] || 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase border-b-2 ${styles}`}>
      {severity === 'high' ? '严重错误' : severity === 'medium' ? '设计风险' : '规范提示'}
    </span>
  );
};

const ResultCard: React.FC<{ result: AuditResult }> = ({ result }) => {
  return (
    <div className="bg-white rounded-[3rem] overflow-hidden border border-slate-200 card-shadow transition-all duration-500 w-full flex flex-col xl:flex-row">
      
      {/* Visual & OCR Preview */}
      <div className="w-full xl:w-2/5 flex flex-col border-r border-slate-100 bg-slate-50/30">
        {/* Verbatim OCR Block */}
        <div className="p-8 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">OCR</div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">文字提取结果 (原始文本)</h4>
          </div>
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-mono text-slate-600 leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
            {result.ocrText || "未提取到有效文字内容"}
          </div>
        </div>

        {/* Image Preview */}
        <div className="flex-1 p-8 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">IMG</div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">审校参考图例</h4>
          </div>
          {result.imageUrl ? (
            <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-4 shadow-inner flex items-center justify-center">
              <img src={result.imageUrl} className="max-w-full max-h-[400px] object-contain rounded" alt="Audit Preview" />
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-300 italic text-sm">暂无图像</div>
          )}
        </div>
      </div>

      {/* Audit Findings */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
           <div className="flex flex-col">
             <h3 className="text-lg font-black text-slate-900 tracking-tight">资深专家纠错清单</h3>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Audit Findings & Correction List</p>
           </div>
           <span className="text-xs font-black text-indigo-600 bg-white px-4 py-2 rounded-full border border-indigo-100 shadow-sm">
             待修正项: {result.errors.length}
           </span>
        </div>
        
        <div className="flex-1 overflow-y-auto max-h-[700px]">
          {result.errors.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center text-slate-400">
               <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6 border border-emerald-100">
                 <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
               </div>
               <span className="text-lg font-bold text-slate-900">质量达标</span>
               <span className="text-sm font-medium mt-1">当前内容符合所有工业级审校标准</span>
            </div>
          ) : (
            result.errors.map((error, idx) => (
              <div key={idx} className="p-8 border-b border-slate-50 last:border-0 hover:bg-indigo-50/20 transition-all group">
                <div className="flex items-center justify-between mb-5">
                   <div className="flex items-center gap-4">
                      <div className="px-3 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-500 uppercase tracking-tighter border border-slate-200">
                        {error.category}
                      </div>
                      <SeverityBadge severity={error.severity} />
                   </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-rose-50/50 p-6 rounded-[1.5rem] border border-rose-100 transition-all group-hover:bg-rose-50">
                    <p className="text-sm font-bold text-rose-700 leading-relaxed">
                      {error.description}
                    </p>
                  </div>
                  
                  <div className="flex gap-4 pl-4">
                    <div className="w-1.5 h-full bg-emerald-500 rounded-full shrink-0"></div>
                    <div className="py-1">
                      <span className="text-[10px] font-black text-emerald-600 uppercase block mb-2 tracking-widest">✅ 专家修改建议</span>
                      <p className="text-sm text-slate-700 font-bold leading-relaxed">{error.suggestion}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
