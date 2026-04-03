import { GoogleGenAI } from "@google/genai";

async function generateLogo() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = "A professional, minimalist, and modern logo for an AI research engine named 'Atlus AI'. The logo features a sleek, abstract icon that combines a stylized 'A' with a neural network pattern, representing deep intelligence and research. The text 'Atlus AI' is written in a clean, sophisticated, high-tech sans-serif font. Color palette: Deep charcoal background with vibrant cyan and silver accents. The overall feel is authoritative, premium, and powerful.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        console.log(`IMAGE_DATA:${base64EncodeString}`);
      }
    }
  } catch (error) {
    console.error("Error generating logo:", error);
  }
}

generateLogo();
