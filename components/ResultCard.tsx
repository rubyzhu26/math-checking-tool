
import React from 'react';
import { AuditResult, ErrorCategory } from '../types';

const SeverityBadge = ({ severity }: { severity: string }) => {
  const styles = {
    high: 'bg-rose-50 text-rose-600 border-rose-100',
    medium: 'bg-amber-50 text-amber-600 border-amber-100',
    low: 'bg-blue-50 text-blue-600 border-blue-100'
  }[severity] || 'bg-slate-50 text-slate-500 border-slate-100';

  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border ${styles}`}>
      {severity === 'high' ? '严重问题' : severity === 'medium' ? '中等风险' : '细节提示'}
    </span>
  );
};

const CategoryIcon = ({ category }: { category: ErrorCategory }) => {
  switch (category) {
    case ErrorCategory.Pedagogical:
      return <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100 shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></div>;
    case ErrorCategory.Visual:
      return <div className="p-2 bg-purple-50 rounded-lg text-purple-600 border border-purple-100 shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>;
    case ErrorCategory.Textual:
      return <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100 shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div>;
  }
};

const ResultCard: React.FC<{ result: AuditResult }> = ({ result }) => {
  return (
    <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 card-shadow transition-all duration-500 w-full flex flex-col lg:flex-row">
      
      {/* Visual Preview (Smaller) */}
      <div className="relative bg-slate-50 border-r border-slate-100 w-full lg:w-1/3 min-h-[300px]">
        <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur px-2 py-1 rounded-md border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-500">
          参考图例 # {result.pageNumber}
        </div>
        {result.imageUrl ? (
          <div className="relative w-full h-full flex items-center justify-center p-6">
            <img src={result.imageUrl} className="max-w-full max-h-[500px] rounded shadow-md object-contain" alt="Audit Target" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 italic text-sm">暂无预览</div>
        )}
      </div>

      {/* Issues Details Area (Larger) */}
      <div className="flex-1 flex flex-col divide-y divide-slate-100">
        <div className="px-6 py-4 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-900 tracking-widest font-mono">审校分析详情</h3>
            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              检出项: {result.errors.length}
            </span>
        </div>
        
        <div className="overflow-y-auto max-h-[600px]">
          {result.errors.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400">
               <svg className="w-12 h-12 text-emerald-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
               <span className="text-sm font-medium">当前页面符合所有教学与设计规范</span>
            </div>
          ) : (
            result.errors.map((error, idx) => (
              <div key={idx} className="p-6 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-3">
                      <CategoryIcon category={error.category as any} />
                      <span className="text-sm font-bold text-slate-800">{error.category}</span>
                   </div>
                   <SeverityBadge severity={error.severity} />
                </div>
                <div className="pl-11">
                  <p className="text-sm text-slate-600 mb-3 leading-relaxed font-normal">{error.description}</p>
                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex gap-3 shadow-sm">
                    <div className="w-1 h-full bg-indigo-500 rounded-full"></div>
                    <div>
                      <span className="text-[10px] font-black text-indigo-500 uppercase block mb-1">修改意见</span>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">{error.suggestion}</p>
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
