const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Enhanced error handling for complex prompts
const handleComplexPrompt = async (prompt) => {
  try {
    // Handle very long prompts by chunking if needed
    if (prompt.length > 30000) {
      const chunks = prompt.match(/.{1,25000}/g) || [prompt];
      const responses = [];
      
      for (const chunk of chunks) {
        const model = genAI.getGenerativeModel({ 
          model: "gemini-pro",
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.9,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        });
        
        const result = await model.generateContent(chunk);
        const response = await result.response;
        responses.push(response.text());
      }
      
      return responses.join(' ');
    } else {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-pro",
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.9,
          maxOutputTokens: 2048,
        }
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    }
  } catch (error) {
    console.error('Complex prompt error:', error);
    throw error;
  }
};

// Chat endpoint - compatible with Proxima code
app.get('/chat', async (req, res) => {
  try {
    const { message } = req.query;
    
    if (!message) {
      return res.status(400).json({
        error: 'Message parameter is required',
        usage: 'GET /chat?message=your_message_here'
      });
    }

    // Decode the message if it's URL encoded
    const decodedMessage = decodeURIComponent(message);
    
    // Handle the complex enhanced prompt from Proxima
    const text = await handleComplexPrompt(decodedMessage);
    
    // Return in the exact format expected by the Proxima code
    res.json({
      reply: text
    });
    
  } catch (error) {
    console.error('Error:', error);
    
    // Enhanced error handling for different scenarios
    if (error.message && error.message.includes('API_KEY_INVALID')) {
      return res.status(401).json({
        reply: 'I apologize, but I\'m having authentication issues. Please check the API configuration.'
      });
    }
    
    if (error.message && error.message.includes('SAFETY')) {
      return res.status(400).json({
        reply: 'I cannot process that request due to safety guidelines. Could you please rephrase your question?'
      });
    }
    
    if (error.message && error.message.includes('QUOTA_EXCEEDED')) {
      return res.status(429).json({
        reply: 'I\'m experiencing high demand right now. Please try again in a moment.'
      });
    }
    
    // Generic fallback response that matches Proxima's style
    res.status(500).json({
      reply: 'I encountered a processing challenge. Let me try to help you differently.'
    });
  }
});

// Health check endpoint - enhanced for Proxima monitoring
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'Proxima V2.85 Gemini API Gateway',
    version: '2.85.0',
    creator: 'Aayusha Shrestha',
    endpoints: {
      chat_get: '/chat?message=your_message',
      chat_post: '/chat (POST with message in body)',
      conversation: '/chat/conversation (POST with messages array)',
      health: '/',
      status: '/status'
    },
    features: [
      'Enhanced prompt processing',
      'Complex conversation handling', 
      'Safety filtering',
      'Error resilience',
      'Batch processing support'
    ]
  });
});

// Status endpoint for monitoring
app.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// POST endpoint for larger messages from Proxima
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        reply: 'Message is required in request body'
      });
    }
    
    const text = await handleComplexPrompt(message);
    
    res.json({
      reply: text
    });
    
  } catch (error) {
    console.error('POST Error:', error);
    
    // Handle different error types with Proxima-style responses
    if (error.message && error.message.includes('SAFETY')) {
      return res.status(400).json({
        reply: 'I cannot process that request due to content guidelines. Please try rephrasing.'
      });
    }
    
    res.status(500).json({
      reply: 'I encountered a processing challenge. Let me approach this differently.'
    });
  }
});

// Additional endpoint to handle batch requests (if needed for complex conversations)
app.post('/chat/conversation', async (req, res) => {
  try {
    const { messages, context } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        reply: 'Messages array is required'
      });
    }
    
    // Handle conversation context from Proxima
    const conversationPrompt = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    const fullPrompt = context ? `${context}\n\n${conversationPrompt}` : conversationPrompt;
    
    const text = await handleComplexPrompt(fullPrompt);
    
    res.json({
      reply: text
    });
    
  } catch (error) {
    console.error('Conversation Error:', error);
    res.status(500).json({
      reply: 'I encountered a processing challenge with the conversation context.'
    });
  }
});

// Start server with enhanced logging
app.listen(PORT, () => {
  console.log(`🚀 Proxima V2.85 Gemini API Gateway running on port ${PORT}`);
  console.log(`📝 Chat endpoint: /chat?message=your_message`);
  console.log(`💬 POST endpoint: /chat (JSON body)`);
  console.log(`🔄 Conversation endpoint: /chat/conversation`);
  console.log(`✨ Enhanced for complex AI interactions`);
  console.log(`👤 Created by: Aayusha Shrestha`);
});
