import { GoogleGenAI } from "@google/genai";

// Initialize the Google Gen AI SDK
// It automatically picks up the GEMINI_API_KEY environment variable from Vercel
const ai = new GoogleGenAI();

export default async function handler(req, res) {
  // Clear CORS blocks
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, image } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    let contents = [prompt];

    // If an image is sent, strip the header data and format it perfectly for Gemini
    if (image && image.includes(',')) {
      const base64Data = image.split(',')[1];
      contents.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      });
    }

    // Call Gemini 2.5 Flash (the fastest real-time model to beat the 10-second timeout)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        maxOutputTokens: 100 // Keep responses short so Text-to-Speech starts instantly!
      }
    });

    const replyText = response.text || "I see you, but I couldn't generate a text response.";
    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error("Gemini Backend Error:", error);
    return res.status(500).json({ 
      reply: "Backend processing error.", 
      details: error.message 
    });
  }
}