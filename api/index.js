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
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ reply: "API Key is missing on Vercel environment settings." });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // 1. Build a pure Google Gemini API payload structure
    let parts = [{ text: prompt }];

    if (image && image.includes(',')) {
      const base64Data = image.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      });
    }

    // 2. Fire a direct HTTP POST request straight to Google's endpoints
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: parts }] })
      }
    );

    const data = await response.json();

    // 3. Carefully parse out the text response safely
    if (data && data.candidates && data.candidates[0].content.parts[0].text) {
      const replyText = data.candidates[0].content.parts[0].text;
      return res.status(200).json({ reply: replyText });
    } else {
      console.error("Unexpected Gemini Payload structure:", data);
      return res.status(200).json({ reply: "I can see the camera feed, but I couldn't formulate a text answer." });
    }

  } catch (error) {
    console.error("Direct API Error:", error);
    return res.status(500).json({ 
      reply: "Backend server communication failed.", 
      details: error.message 
    });
  }
}