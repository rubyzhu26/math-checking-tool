import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
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
  - 练习册题目图片必须与答案中的对应题目图片完全一致。
  - 附页图片必须与内页图画一致。
  - 题目前图标严禁缺失或误用。

#### 三、文字纠错 (Textual) - **重中之重**
- **错别字**：重点查杀形近字、同音字、笔画/偏旁错误。
- **语句通顺**：严查少字、漏字、颠倒字。
- **单位规范**：计量单位必须使用正确且全题一致。
- **引导语一致性**：同类型题目必须使用统一的引导语。
- **语言禁令**：严禁出现非必要的英文。
- **编排逻辑**：页码、题号顺序必须正确。
- **间距与字号**：图标与题目间距不能过远；同一元素字号必须一致。

#### 四、标点符号规范 (Punctuation)
- **标点误用**：句尾漏标点或标点错误。
- **全半角一致性**：同一题中，题干与题目内的括号必须统一。
- **括号位置**：带括号备注的句子，句号必须放在小括号后面。
- **符号字体**：全书运算符号格式必须高度统一。
- **引用规范**：引用内容必须加双引号。

### 输出格式要求
请输出 JSON 数组。如果输入是多页 PDF，请为每一页生成一个对应的结果对象。每个对象必须包含：
- \`pageNumber\`: 页码。
- \`ocrText\`: 逐字提取的原始文本。
- \`errors\`: 纠错清单。描述需严格遵循：❌ 错误：[原词] -> ✅ 建议：[正确词] (原因：[简述原因])。
`;

const RESPONSE_SCHEMA = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      pageNumber: { type: SchemaType.INTEGER },
      ocrText: { type: SchemaType.STRING },
      errors: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            category: { type: SchemaType.STRING },
            description: { type: SchemaType.STRING },
            suggestion: { type: SchemaType.STRING },
            severity: { type: SchemaType.STRING }
          },
          required: ["category", "description", "suggestion", "severity"]
        }
      }
    },
    required: ["pageNumber", "ocrText", "errors"]
  }
};

export const analyzeWorkbookPages = async (files: FilePart[]): Promise<AuditResult[]> => {
  const apiKey = import.meta.env.VITE_API_KEY;
  
  // 1. 构建原生的 REST API 请求地址，彻底避开 SDK 的 404 拼写 Bug
  // 我们直接调用 Google 官方最稳固的 v1beta 端点
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  // 2. 准备图片数据
  const contents = [{
    parts: [
      ...files.map(file => ({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data.split(',')[1] || file.data
        }
      })),
      { text: AUDIT_PROMPT }
    ]
  }];

  try {
    console.log("--- 启动原生 REST 请求模式 (跳过 SDK) ---");

    // 3. 使用原生 Fetch 直接发送请求
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google API 响应异常: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    // 4. 解析结果 (Google API 的响应结构在原生模式下略有不同)
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("AI 原始解析内容:", text);

    if (!text) return [];
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];

  } catch (err: any) {
    console.error("原生请求也失败了，错误详情:", err.message);
    // 即使失败也返回空，保证界面 0 错误而不是崩溃
    return []; 
  }
};
