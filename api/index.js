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

    // Format parts matching Google's exact specification
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

    // Fire the request with standard browser/server headers so Google accepts it
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' // Prevents Google from dropping the connection
        },
        body: JSON.stringify({ 
          contents: [{ parts: parts }] 
        })
      }
    );

    const data = await response.json();

    // Safely look inside the JSON tree response
    if (data && data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const replyText = data.candidates[0].content.parts[0].text;
      return res.status(200).json({ reply: replyText });
    } else {
      console.error("Google API rejected or returned error structure:", data);
      return res.status(200).json({ reply: "The server received the message but could not parse an AI response." });
    }

  } catch (error) {
    console.error("Backend Server Error:", error);
    return res.status(500).json({ 
      reply: "Backend server communication failed.", 
      details: error.message 
    });
  }
}