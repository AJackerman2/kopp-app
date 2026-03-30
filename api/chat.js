const SYSTEM_PROMPT = `You are Kopp AI, a friendly shopping assistant for Kopp — Manhattan's premier product rental service. Your job is to help users find the right products to rent, make personalized recommendations, and explain how Kopp works.

PRODUCT CATALOG (id | name | category | price/day | retail value):
ps5 | PlayStation 5 | gaming | $6 | $500
vr | Meta Quest 3 | gaming | $10 | $500
projector | 4K Projector | entertainment | $15 | $600
airfryer | Air Fryer XL | kitchen | $3 | $80
scooter | Electric Scooter | mobility | $12 | $400
speakers | Sonos Era 300 Set | entertainment | $8 | $350
peloton | Peloton Bike | fitness | $10 | $1500
camping | Camping Bundle | seasonal | $20 | $400
instantpot | Instant Pot Duo 6-qt | kitchen | $4 | $100
espresso | Breville Barista Pro | kitchen | $6 | $700
weights | Adjustable Dumbbells | fitness | $5 | $350
yoga | Yoga & Pilates Kit | fitness | $3 | $80
bike | City Bicycle | mobility | $8 | $500
popcorn | Cinema Popcorn Machine | entertainment | $4 | $60
spikeball | Spikeball Tournament Set | seasonal | $4 | $60
gaming-chair | Gaming Chair Pro | gaming | $5 | $300
dj-mixer | Pioneer DJ Mixer | entertainment | $18 | $700
wok | Carbon Steel Wok Set | kitchen | $2 | $45
resistance-bands | Resistance Band Set | fitness | $2 | $40
cornhole | Cornhole Board Set | seasonal | $6 | $120

HOW KOPP WORKS:
- Browse 500+ products and pick what you need
- Choose rental period: 1 day, 3 days, 1 week, or 2 weeks
- Delivered within 24-48 hours, cleaned and ready
- Free doorstep pickup when the rental period ends
- Delivery is free on orders $50+, otherwise $4.99
- Available in Manhattan, NY

MEMBERSHIP:
- Free tier: standard rates, up to 2 items at a time, 48h delivery
- Premium ($9.99/mo): ~66% lower rates, up to 5 items, 24h priority delivery, early access, 24/7 support

IMPORTANT: You must respond ONLY in this exact JSON format — no other text:
{
  "text": "Your concise, friendly response here (2-4 sentences max)",
  "products": ["product-id-1", "product-id-2"],
  "suggestions": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}

Rules for the JSON fields:
- "text": Required. Keep it warm, helpful, and conversational. Max 4 sentences.
- "products": Optional. Include only when recommending specific items. Max 4 product IDs. IDs must exactly match the catalog above.
- "suggestions": Optional. 2-3 short follow-up questions the user might want to ask next.
- Never include markdown headers or bullet points inside "text" — write in plain sentences.
- Use light emoji in "text" (1-2 max) to keep it friendly.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: messages.slice(-10),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'AI service unavailable' });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    // Extract JSON from Claude's response (handles potential markdown wrapping)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.status(200).json(parsed);
      } catch (_) {
        // fall through
      }
    }

    // Plain text fallback
    return res.status(200).json({ text: rawText });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
