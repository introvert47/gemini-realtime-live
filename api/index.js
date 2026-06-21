import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Higher limit to handle video frames
app.use(express.static('public')); // Serve frontend files from a 'public' directory

// Initialize Gemini API Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/analyze', async (req, res) => {
  try {
    const { image, prompt } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Get the Gemini 2.5 Flash model
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Clean up the base64 string coming from frontend
    const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");

    // Structure data exactly how the Gemini SDK wants it
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: 'image/jpeg'
      }
    };

    // Generate content using both the visual frame and text prompt
    const result = await model.generateContent([imagePart, prompt || "What is this?"]);
    const responseText = result.response.text();

    res.json({ text: responseText });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'Failed to process request with AI' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running smoothly on http://localhost:${PORT}`);
});