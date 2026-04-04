const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const { generateMedicalResponse } = require('../services/ai.service');
const { detectEmergency, EMERGENCY_WARNING } = require('../services/emergency.service');

const MAX_HISTORY = 10;

async function handleChat(req, res) {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }

    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'message must be a non-empty string' });
    }

    // Ensure session exists
    await ChatSession.findOneAndUpdate(
      { sessionId },
      { sessionId },
      { upsert: true, new: true }
    );

    // Store user message
    await ChatMessage.create({
      sessionId,
      role: 'user',
      content: message.trim(),
    });

    // Check for emergency keywords
    const { isEmergency } = detectEmergency(message);

    // Retrieve last N messages for context
    const history = await ChatMessage.find({ sessionId })
      .sort({ timestamp: -1 })
      .limit(MAX_HISTORY)
      .lean();

    // Reverse to chronological order
    const conversationHistory = history.reverse().map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Generate AI response
    let reply = await generateMedicalResponse(conversationHistory);

    // Prepend emergency warning if applicable
    if (isEmergency) {
      reply = `${EMERGENCY_WARNING}\n\n${reply}`;
    }

    // Store AI response
    await ChatMessage.create({
      sessionId,
      role: 'assistant',
      content: reply,
    });

    return res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

async function getHistory(req, res) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const messages = await ChatMessage.find({ sessionId })
      .sort({ timestamp: 1 })
      .lean();

    return res.json({
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
    });
  } catch (error) {
    console.error('History error:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve chat history.' });
  }
}

async function getSessions(_req, res) {
  try {
    const sessions = await ChatSession.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // For each session, get the first user message as title
    const enriched = await Promise.all(
      sessions.map(async (s) => {
        const firstMsg = await ChatMessage.findOne({
          sessionId: s.sessionId,
          role: 'user',
        })
          .sort({ timestamp: 1 })
          .lean();

        return {
          sessionId: s.sessionId,
          title: firstMsg
            ? firstMsg.content.substring(0, 60) + (firstMsg.content.length > 60 ? '...' : '')
            : 'New conversation',
          createdAt: s.createdAt,
        };
      })
    );

    return res.json({ sessions: enriched });
  } catch (error) {
    console.error('Sessions error:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve sessions.' });
  }
}

async function deleteSessionById(req, res) {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    await ChatMessage.deleteMany({ sessionId });
    await ChatSession.deleteOne({ sessionId });

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error.message);
    return res.status(500).json({ error: 'Failed to delete session.' });
  }
}

module.exports = { handleChat, getHistory, getSessions, deleteSessionById };
