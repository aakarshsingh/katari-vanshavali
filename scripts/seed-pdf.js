const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const PDF_PATH = path.join(__dirname, '../docs/vanshavali.pdf');
const OUTPUT_PATH = path.join(__dirname, '../docs/seed.json');

const PROMPT = `Extract all people and parent-child relationships from this family tree document.
Return a JSON object with this exact structure:
{
  "title_en": "...",
  "title_hi": "...",
  "persons": [
    {
      "id": "p1",
      "name_en": "...",
      "name_hi": "...",
      "birth_year": null,
      "death_year": null,
      "spouse_en": "...",
      "spouse_hi": "...",
      "gender": "M"
    }
  ],
  "relationships": [
    { "parent_id": "p1", "child_id": "p2" }
  ]
}
Use short stable IDs like p1, p2, p3. Extract Hindi names from Devanagari text.
If a field is unclear or absent, use null. Gender should be "M", "F", or "other".
Return only the JSON object — no explanation.`;

async function run() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
  if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`PDF not found at ${PDF_PATH}`);
  }

  const pdfBase64 = fs.readFileSync(PDF_PATH).toString('base64');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log('Sending PDF to Claude Vision...');
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: PROMPT,
          },
        ],
      },
    ],
  });

  const raw = response.content[0].text;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON object found in Claude response');

  const data = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(data.persons) || data.persons.length === 0) {
    throw new Error('Claude returned no persons in seed data');
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(`Seed data written to ${OUTPUT_PATH}`);
  console.log(`Extracted: ${data.persons.length} persons, ${data.relationships.length} relationships`);
}

run().catch(err => {
  console.error('seed-pdf.js failed:', err.message);
  process.exit(1);
});
