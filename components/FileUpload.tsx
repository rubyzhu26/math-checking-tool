
import React, { useRef, useState } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isProcessing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !isProcessing && fileInputRef.current?.click()}
      className={`relative overflow-hidden cursor-pointer rounded-[2.5rem] p-20 transition-all duration-500 flex flex-col items-center justify-center border-2 border-dashed
        ${isDragging ? 'border-indigo-400 bg-indigo-50 scale-[0.98]' : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-200 card-shadow'}
        ${isProcessing ? 'cursor-wait' : ''}`}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleChange} 
        accept="application/pdf,image/*" 
        className="hidden" 
      />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-20 h-20 mb-8 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-100 animate-float">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        
        <h3 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">导入审校文档</h3>
        <p className="text-slate-500 text-center max-w-sm text-lg font-normal leading-relaxed">
          拖拽 PDF 或点击此处上传文件进行离线分析
        </p>

        <div className="mt-8 flex gap-3">
            <span className="px-4 py-1.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest border border-slate-200">PDF Supported</span>
            <span className="px-4 py-1.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest border border-slate-200">Images Ready</span>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
