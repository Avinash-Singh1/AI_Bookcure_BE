const express = require('express');
const { handleChat, getHistory, getSessions, deleteSessionById } = require('../controllers/chat.controller');

const router = express.Router();

// POST /api/chat — send a message and get AI response
router.post('/chat', handleChat);

// GET /api/sessions — list all chat sessions
router.get('/sessions', getSessions);

// GET /api/chat/:sessionId — retrieve chat history
router.get('/chat/:sessionId', getHistory);

// DELETE /api/chat/:sessionId — delete a session and its messages
router.delete('/chat/:sessionId', deleteSessionById);

module.exports = router;
