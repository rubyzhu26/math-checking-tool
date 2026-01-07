
export enum ErrorCategory {
  Pedagogical = '教学错误',
  Visual = '画面设计',
  Textual = '文字标点'
}

export interface ErrorDetail {
  category: ErrorCategory;
  description: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
}

export interface AuditResult {
  pageNumber: number;
  imageUrl?: string; // Original base64 or processed image
  errors: ErrorDetail[];
}

export interface WorkbookState {
  isAnalyzing: boolean;
  fileName: string | null;
  results: AuditResult[];
  error: string | null;
}
