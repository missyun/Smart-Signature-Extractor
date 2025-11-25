import { AIProvider } from '../types';

// Configuration for supported providers
const PROVIDERS = {
  zhipu: {
    name: "智谱AI (GLM-4V-Flash)",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4v-flash",
    headers: (apiKey: string) => ({
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    })
  },
  aliyun: {
    name: "阿里云 (Qwen-VL-Max)",
    // Aliyun DashScope OpenAI Compatible Endpoint
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: "qwen-vl-max",
    headers: (apiKey: string) => ({
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    })
  }
};

/**
 * Sends a signature image to the AI service to recognize handwritten text.
 * @param base64Image Base64 string of the image (without data prefix)
 * @param apiKey The user provided API Key
 * @param provider The selected AI provider ('zhipu' or 'aliyun')
 * @returns The recognized text
 */
export const recognizeSignature = async (
  base64Image: string, 
  apiKey: string, 
  provider: AIProvider = 'zhipu'
): Promise<string> => {
  if (!apiKey) {
    return "请配置API Key";
  }

  const currentProvider = PROVIDERS[provider];
  if (!currentProvider) return "无效的服务商配置";

  // Highly optimized prompt for handwriting OCR, explicitly forbidding conversational filler
  const systemPrompt = `你是一个纯粹的OCR引擎。只输出识别到的文字本身。

严格禁止输出以下内容：
- “图中写着...”
- “识别结果是...”
- “图片包含...”
- 句号（除非是日期的一部分）

规则：
1. 若是姓名，只输出姓名（如：王顺培）。
2. 若是日期，保留原始格式（如：2022.5.19）。
3. 严禁添加任何解释性文字或标点符号。`;

  try {
    const response = await fetch(currentProvider.endpoint, {
      method: "POST",
      headers: currentProvider.headers(apiKey),
      body: JSON.stringify({
        model: currentProvider.model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}` // Using JPEG as defined in imageProcessing
                }
              },
              {
                type: "text",
                text: "图里写的什么字？直接输出内容。"
              }
            ]
          }
        ],
        temperature: 0.01, // Very low temperature for consistent OCR
        max_tokens: 50
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error(`${provider} API Error:`, errData);
      
      if (response.status === 401 || response.status === 403) return "Key无效或无权限";
      if (response.status === 429) return "请求太频繁";
      if (response.status === 402) return "账户余额不足/欠费";
      if (response.status === 400 && errData.code === 'DataInspectionFailed') return "图片内容违规";
      
      return `请求失败 (${response.status})`;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return "未识别";

    // Post-processing
    let cleanedContent = content.trim();
    
    // 1. Aggressive prefix cleaning for Chinese models which tend to be chatty
    // Removes: "图中写着：", "图片中的文字是", "识别结果：", etc.
    const prefixesToRemove = [
        /^识别结果[：:]?\s*/,
        /^图片中的文字(是|为)?[：:]?\s*/,
        /^图中(的)?文字(是|为)?[：:]?\s*/,
        /^图中写着[：:]?\s*/,
        /^图里的字(是|为)?[：:]?\s*/,
        /^内容(是|为)?[：:]?\s*/,
        /^文字内容(是|为)?[：:]?\s*/,
        /^显示(了|着)?[：:]?\s*/
    ];

    prefixesToRemove.forEach(regex => {
        cleanedContent = cleanedContent.replace(regex, '');
    });

    // 2. Remove surrounding quotes that AI might add around the name
    cleanedContent = cleanedContent.replace(/^["'“]+|["'”]+$/g, '');
    
    // 3. Remove trailing period ONLY if it looks like a sentence end, 
    // BUT NOT if it looks like a date end (though dates usually don't end in dot).
    // e.g. "王顺培。" -> "王顺培"
    if (cleanedContent.endsWith('。')) {
      cleanedContent = cleanedContent.slice(0, -1);
    }
    // Also remove English period if it's not part of a date pattern (like 2022.5.19.)
    if (cleanedContent.endsWith('.') && !/\d+\.$/.test(cleanedContent)) {
        cleanedContent = cleanedContent.slice(0, -1);
    }

    // 4. Fix potential spacing issues in dates caused by OCR (e.g., "2022 . 5 . 19")
    // If we see Digits + Dots + Spaces + Digits, collapse the spaces.
    if (/^[\d\s\.]+$/.test(cleanedContent)) {
       cleanedContent = cleanedContent.replace(/\s+/g, '');
    }

    return cleanedContent;

  } catch (error) {
    console.error("Network Error:", error);
    return "网络连接错误";
  }
};