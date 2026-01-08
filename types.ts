
export enum ErrorCategory {
  Pedagogical = '教学错误',
  Visual = '画面设计',
  Textual = '文字纠错',
  Punctuation = '标点规范'
}

export interface ErrorDetail {
  category: string;
  description: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
}

export interface FilePart {
  data: string;
  mimeType: string;
}

export interface AuditResult {
  pageNumber: number;
  imageUrl?: string;
  ocrText: string; // Verbatim OCR extraction
  errors: ErrorDetail[];
}

export interface WorkbookState {
  isAnalyzing: boolean;
  fileName: string | null;
  results: AuditResult[];
  error: string | null;
}
