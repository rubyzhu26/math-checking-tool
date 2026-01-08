
import { GoogleGenAI, Type } from "@google/genai";
import { AuditResult, FilePart } from "../types";

const AUDIT_PROMPT = `
你是一位拥有 20 年经验的资深文字校对专家和数学教材审校专家。你的任务是对输入的数学练习册文档（图片或 PDF）进行严苛的质量审核。

### 核心任务流程
1. **逐字 OCR 提取**：请先将图片或文档中的所有文字原封不动地提取出来。严禁自动修正任何你认为“写错”的字。必须保留原始状态。
2. **深度纠错**：基于提取的文字与画面内容，对比以下标准进行校对：

#### 一、教学错误 (Pedagogical)
- **乘除法列式**：严格检查“几个几”的逻辑。新教材要求：相同数在前，个数在后。例如：3个9必须列式为 9×3，严禁写成 3×9。
- **图文一致性**：检查题目配图是否与题目内容相关。例如：加减法单元中不能出现乘除法配图。

#### 二、画面设计错误 (Visual/Design)
- **品牌规范**：检查“斑马Logo”细节。对比标准版，检查是否缺失耳朵、眼睛等关键细节。
- **图层逻辑**：插画必须在第一层，严禁被背景或其他底图盖住。
- **一致性**：
  - 封面、目录配图必须与单元教学内容匹配。
  - 练习册题目图片必须与答案中的对应题目图片完全一致（例如：题中是三角形，答案不能是四边形）。
  - 附页图片必须与内页图画一致。
  - 题目前图标严禁缺失或误用。

#### 三、文字纠错 (Textual) - **重中之重**
- **错别字**：重点查杀形近字（如“诗向”误写为“诗句”、“分线”误写为“分界线”）、同音字、笔画/偏旁错误。
- **语句通顺**：严查少字、漏字、颠倒字。
- **单位规范**：计量单位（如cm, kg, 厘米, 千克）必须使用正确且全题一致。
- **引导语一致性**：同类型题目必须使用统一的引导语/提示语。
- **语言禁令**：严禁出现非必要的英文。
- **编排逻辑**：页码、题号顺序必须正确，目录的周序/天序/页码必须与内页精准对应。
- **间距与字号**：图标与题目间距不能过远；文字中不能有多余或缺少空格；同一元素字号必须一致。

#### 四、标点符号规范 (Punctuation)
- **标点误用**：句尾漏标点或标点错误。
- **全半角一致性**：同一题中，题干与题目内的括号必须统一（如全用全角）。
- **括号位置**：带括号备注的句子，句号必须放在小括号后面。正确格式：(这是示例)。
- **符号字体**：全书运算符号（+、-、×、÷）格式必须高度统一。
- **引用规范**：引用内容必须加双引号。

### 输出格式要求
请输出 JSON 数组。如果输入是多页 PDF，请为每一页生成一个对应的结果对象。每个对象必须包含：
- \`pageNumber\`: 页码。
- \`ocrText\`: 逐字提取的原始文本（文字提取结果：[显示你看到的原始文本]）。
- \`errors\`: 纠错清单。描述需严格遵循：❌ 错误：[原词] -> ✅ 建议：[正确词] (原因：[简述原因，如：形近字误用])。
`;

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      pageNumber: { type: Type.INTEGER },
      ocrText: { type: Type.STRING, description: "文字提取结果：显示的原始文本" },
      errors: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            description: { type: Type.STRING, description: "错误描述，包含 ❌ 错误 -> ✅ 建议 格式" },
            suggestion: { type: Type.STRING, description: "具体的修改建议" },
            severity: { type: Type.STRING, enum: ["high", "medium", "low"] }
          },
          required: ["category", "description", "suggestion", "severity"]
        }
      }
    },
    required: ["pageNumber", "ocrText", "errors"]
  }
};

export const analyzeWorkbookPages = async (files: FilePart[]): Promise<AuditResult[]> => {
  // 1. 钥匙：一定要用 import.meta.env
  const apiKey = import.meta.env.VITE_API_KEY || "";
  const ai = new GoogleGenerativeAI(apiKey);

  // ... (中间转换 parts 的代码不变)

  try {
    // 2. 获取模型：标准写法
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [...parts, { text: AUDIT_PROMPT }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    });

    const response = await result.response;
    return JSON.parse(response.text());

  } catch (err) {
    console.error("Analysis failed:", err);
    // 3. 重点：这就是你说的最后加的那句话，防止前端崩溃
    return []; 
  }
};

    const text = response.text;
    if (!text) throw new Error("AI response empty.");
    const parsedResults = JSON.parse(text);

    return parsedResults.map((item: any, idx: number) => {
      // Map back to the source image data based on index if available
      // If we provided multiple images (like from a PDF split), map them.
      const sourceImage = files[idx]?.data || files[0]?.data;
      const isImage = files[idx]?.mimeType.startsWith('image/') || files[0]?.mimeType.startsWith('image/');
      
      return {
        ...item,
        imageUrl: isImage ? sourceImage : undefined
      };
    });
  } catch (err) {
    console.error("Analysis failed:", err);
    throw err;
  }
};
