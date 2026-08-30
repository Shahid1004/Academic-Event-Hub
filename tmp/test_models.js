require('dotenv').config();
const https = require('https');

const key = process.env.GEMINI_API_KEY;

function testModel(model) {
  return new Promise((resolve) => {
    const req = https.request(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, body });
          }
        });
      }
    );

    const payload = JSON.stringify({
      contents: [{ parts: [{ text: 'Return json: {"ok": true}' }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    req.write(payload);
    req.end();
  });
}

(async () => {
  const models = [
    'gemini-3.6-flash',
    'gemini-3.1-flash',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ];

  for (const m of models) {
    const res = await testModel(m);
    console.log(
      m,
      res.status,
      res.data?.candidates
        ? 'SUCCESS: ' + res.data.candidates[0].content.parts[0].text.trim()
        : res.data?.error?.message || res.status
    );
  }
})();
