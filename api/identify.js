
import { resolveComicMetadata } from './_services/metadataService.js';

export const config = {
  api: {
    bodyParser: { sizeLimit: "10mb" },
  },
};

const extractBase64 = (input) => {
  if (typeof input === 'string') return input.replace(/^data:image\/\w+;base64,/, '').trim();
  if (input && typeof input === 'object') {
    if (typeof input.base64 === 'string') return input.base64.trim();
  }
  return null;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const body = req.body || {};
    const base64Data = extractBase64(body.image);

    if (!base64Data) {
      return res.status(400).json({ ok: false, error: 'No image data provided' });
    }

    // 1. OpenAI Vision Identification
    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY");
      // Fallback for demo without key
      return res.status(200).json({
        ok: true,
        best: { title: "Unidentified (Missing Key)", issue: "#0", confidence: 0 },
        candidates: [],
        variantRisk: "LOW"
      });
    }

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Identify this comic. Return valid JSON only: { \"title\": \"...\", \"issue\": \"...\", \"publisher\": \"...\", \"year\": \"...\" }" },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
            ]
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const aiDataJSON = await aiResp.json();
    const aiContent = aiDataJSON.choices?.[0]?.message?.content;
    let aiResult = {};

    try {
      aiResult = JSON.parse(aiContent);
    } catch (e) {
      console.error("AI JSON Parse Error", e);
      aiResult = { title: "Unknown", issue: "?" };
    }

    // 2. Resolve Candidates (Mock or Real via MetadataService)
    // For now, allow Search logic to handle "candidates" based on AI title
    // In a real flow, we'd search Metron here.

    // Simulating Metron/CV Candidates
    const candidates = [
      {
        editionId: `cv-${aiResult.title}-${aiResult.issue}-A`,
        displayName: `${aiResult.title} #${aiResult.issue}`,
        coverUrl: "https://comicvine.gamespot.com/a/uploads/scale_small/11112/111123579/8679069-spiderman1.jpg", // Placeholder
        variantHint: "Direct Edition",
        confidence: 0.9,
        year: aiResult.year,
        publisher: aiResult.publisher
      }
    ];

    return res.status(200).json({
      ok: true,
      best: {
        title: aiResult.title,
        issue: aiResult.issue,
        year: aiResult.year,
        publisher: aiResult.publisher,
        confidence: 0.9
      },
      candidates: candidates,
      variantRisk: "LOW"
    });

  } catch (e) {
    console.error("Identify Error", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
