const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT =
  'You are a transliteration assistant. Return only a JSON array of 3-5 Devanagari script transliterations for the given name. No explanation.';

router.post('/', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.length > 100) {
    return res.status(400).json({ error: 'text must be 100 characters or fewer' });
  }
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.trim() }],
    });
    let options;
    try {
      options = JSON.parse(response.content[0].text);
    } catch {
      return res.status(502).json({ error: 'Transliteration service returned invalid JSON' });
    }
    res.json({ options });
  } catch (err) {
    console.error('POST /api/transliterate error:', err.message);
    res.status(502).json({ error: 'Transliteration service error' });
  }
});

module.exports = router;
