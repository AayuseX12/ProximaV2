require('dotenv').config(); // Load .env file

const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- API Key Check ---
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Gemini API Key is missing! Add GEMINI_API_KEY in your .env file.");
  process.exit(1);
} else {
  console.log("✅ Gemini API Key loaded.");
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Handle prompt
const handleComplexPrompt = async (prompt) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash", // ✅ supported free tier model
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 8192,
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Prompt error:", error);
    throw error;
  }
};

// GET /chat
app.get('/chat', async (req, res) => {
  try {
    const { message } = req.query;
    if (!message) {
      return res.status(400).json({
        error: 'Message parameter is required',
        usage: 'GET /chat?message=your_message_here'
      });
    }
    const decodedMessage = decodeURIComponent(message);
    const text = await handleComplexPrompt(decodedMessage);
    res.json({ reply: text });
  } catch (error) {
    if (error.message?.includes("API_KEY_INVALID")) {
      return res.status(401).json({ reply: "❌ Invalid API Key." });
    }
    res.status(500).json({ reply: "⚠️ Processing error." });
  }
});

// POST /chat
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ reply: "Message is required in request body" });

    const text = await handleComplexPrompt(message);
    res.json({ reply: text });
  } catch (error) {
    console.error("POST Error:", error);
    res.status(500).json({ reply: "⚠️ Processing error." });
  }
});

// POST /chat/conversation
app.post('/chat/conversation', async (req, res) => {
  try {
    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ reply: "Messages array is required" });
    }

    const conversationPrompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const fullPrompt = context ? `${context}\n\n${conversationPrompt}` : conversationPrompt;

    const text = await handleComplexPrompt(fullPrompt);
    res.json({ reply: text });
  } catch (error) {
    console.error("Conversation Error:", error);
    res.status(500).json({ reply: "⚠️ Conversation processing error." });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({
    status: "running",
    service: "Proxima Gemini API Gateway",
    version: "2.86.0",
    creator: "Aayusha Shrestha",
    model: "gemini-2.0-flash",
    endpoints: {
      chat_get: "/chat?message=your_message",
      chat_post: "/chat (POST)",
      conversation: "/chat/conversation (POST)",
      test: "/test"
    }
  });
});

// Status
app.get('/status', (req, res) => {
  res.json({
    status: "operational",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    model: "gemini-2.0-flash"
  });
});

// Test endpoint
app.get('/test', async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent("Hello, are you working?");
    const response = await result.response;
    res.json({
      status: "success",
      test_response: response.text(),
      model: "gemini-2.0-flash",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Proxima Gemini API running on port ${PORT}`);
  console.log(`💬 Chat endpoint: /chat?message=your_message`);
  console.log(`🧪 Test endpoint: /test`);
  console.log(`🤖 Using model: gemini-2.0-flash`);
});
