
import { GoogleGenAI, Type } from "@google/genai";
import { AuditResult, ErrorCategory } from "../types";

const AUDIT_PROMPT = `
你是一位极其严谨的数学教材审校专家。请根据以下详尽的工业级标准对数学练习册内容进行深度审校：

一、教学错误 (Pedagogical Errors)
1. 乘除法列式规范：核查“几个几”的列式。旧教材为“个数×相同数”（如3个9写成3×9），新教材必须严格执行“相同数×个数”（如3个9必须写成9×3）。
2. 图文一致性：配图需与内容完全相关。严查加减法单元禁止出现乘除法配图等逻辑错误。

二、画面设计错误 (Visual/Design Errors)
1. 品牌Logo：核查斑马Logo细节（如是否缺失耳朵、眼睛等）。
2. 图层逻辑：插画必须在最顶层，严禁被背景遮挡。
3. 题目答案同步：练习册题目图片与答案图片必须完全一致（如形状、颜色、类型）。
4. 对齐规范：严查排版对齐。题目序号与小括号（如 (1), (2)）必须在一条竖直线上且严格左对齐。
5. 图标规范：题目前的引导图标不得缺失或错误。

三、文字与标点错误 (Textual & Punctuation Errors)
1. 基础文字：纠正错别字、少字、语句不通顺。严禁出现英文。
2. 单位统一：同一题干中相同物品的计量单位必须绝对一致。
3. 排版逻辑：核查题号、页码、周序、天序的连续性；核查目录与内页对应关系。
4. 标点符号：
   - 括号全半角统一：题干与题目中的括号格式必须一致。
   - 备注格式：带括号备注的句子，句号必须放在小括号后面。例：(这是示例)。
   - 符号一致性：全书运算符号（+、-、×、÷）字体必须统一。
   - 引用规范：引用内容必须加双引号。

请针对输入的图片，对比上述规则，返回详细、专业的结构化错误报告。
`;

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      pageNumber: { type: Type.INTEGER },
      errors: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            suggestion: { type: Type.STRING },
            severity: { type: Type.STRING }
          },
          required: ["category", "description", "suggestion", "severity"]
        }
      }
    },
    required: ["pageNumber", "errors"]
  }
};

export const analyzeWorkbookPages = async (imagesBase64: string[]): Promise<AuditResult[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  
  const parts = imagesBase64.map(data => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: data.split(',')[1] || data
    }
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [
          ...parts,
          { text: AUDIT_PROMPT }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI response was empty.");
    const parsed = JSON.parse(text);
    
    // In multi-image analysis, map each result back to its source image
    return parsed.map((item: any, index: number) => ({
      ...item,
      imageUrl: imagesBase64[index] || ""
    }));
  } catch (err) {
    console.error("Audit analysis failed:", err);
    throw err;
  }
};
