const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT =
  'You are a transliteration assistant. Return only a JSON array of 3-5 Devanagari script transliterations for the given name. No explanation.';

// Tolerant parse: strip ``` fences / stray prose and extract the JSON array.
function parseOptions(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('[');
  const b = s.lastIndexOf(']');
  if (a !== -1 && b > a) s = s.slice(a, b + 1);
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x.trim()) : null;
  } catch {
    return null;
  }
}

router.post('/', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.length > 100) {
    return res.status(400).json({ error: 'text must be 100 characters or fewer' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('POST /api/transliterate: ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'Transliteration not configured (missing ANTHROPIC_API_KEY)' });
  }
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.trim() }],
    });
    const raw = response && response.content && response.content[0] && response.content[0].text;
    const options = parseOptions(raw);
    if (!options || options.length === 0) {
      console.error('POST /api/transliterate: could not parse model output:', raw);
      return res.status(502).json({ error: 'Transliteration service returned invalid output' });
    }
    res.json({ options });
  } catch (err) {
    console.error('POST /api/transliterate error:', err.status || '', err.message);
    res.status(502).json({ error: 'Transliteration service error' });
  }
});

module.exports = router;
