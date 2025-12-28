
import { GoogleGenAI, Type, Modality, Blob } from "@google/genai";
import { Language, FactCheckResult, Verdict } from "../types.ts";

// Simple in-memory cache for speed
const resultCache = new Map<string, FactCheckResult>();

export const checkFact = async (
  query: string, 
  language: Language, 
  imageBase64?: string
): Promise<FactCheckResult> => {
  const cacheKey = `${language}-${query}-${imageBase64 ? 'img' : 'txt'}`;
  if (resultCache.has(cacheKey)) {
    return resultCache.get(cacheKey)!;
  }

  const apiKey = process.env.API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstruction = `
    Professional fact-checker for Indian context. 
    Context: Indian political/Kisan news, local events in regions like Uruwa Bazar, Uttar Pradesh, and Bihar. 
    Language: ${language}.
    
    If the selected language is Bhojpuri, ensure the explanation reflects authentic regional usage (mix of local dialect and standard Hindi/English terms where appropriate) to ensure clarity for rural audiences.
    
    CRITICAL FORMATTING:
    1. Start with a very brief intro.
    2. Provide news points as clear, SEPARATE bullet points using the '•' symbol. 
    3. Each news point MUST be on its own new line.
    4. Use bolding **Example** for key entities.
    5. No wall of text. Clear separation between "News 1", "News 2", etc.
    
    Return JSON: {verdict: "True"|"False"|"Misleading", explanation: "...", sources: [{title: "...", uri: "..."}]}
  `;

  const contents: any[] = [{ text: query }];
  if (imageBase64) {
    contents.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64.split(',')[1] || imageBase64
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: contents },
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdict: { type: Type.STRING },
            explanation: { type: Type.STRING },
            sources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  uri: { type: Type.STRING }
                }
              }
            }
          },
          required: ["verdict", "explanation"]
        }
      }
    });

    if (!response.text) {
      throw new Error("No response from verification engine.");
    }

    const result = JSON.parse(response.text);
    const searchSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(chunk => ({
      title: chunk.web?.title || 'Source',
      uri: chunk.web?.uri || '#'
    })) || [];

    const finalResult: FactCheckResult = {
      verdict: (result.verdict as Verdict) || 'Unverified',
      explanation: result.explanation || 'Verification failed.',
      sources: result.sources?.length ? result.sources : searchSources.slice(0, 3)
    };

    resultCache.set(cacheKey, finalResult);
    return finalResult;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<string> => {
  const apiKey = process.env.API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });
  const cleanText = text.replace(/\*\*/g, '').replace(/•/g, '');
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read: ${cleanText}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
  } catch (e) {
    return '';
  }
};

export const decodeAudio = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function createAudioBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export async function decodeAudioToBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
