const { guard } = require('./_guard');

module.exports = async (req, res) => {
  if (guard(req, res, { method: 'GET' })) return;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    const models = (data.models || [])
      .filter(m => {
        const name = m.name || '';
        const methods = m.supportedGenerationMethods || [];
        return /image|imagen/i.test(name) || methods.some(x => /image/i.test(x));
      })
      .map(m => ({
        name: m.name,
        displayName: m.displayName,
        methods: m.supportedGenerationMethods,
      }));

    const all = (data.models || []).map(m => m.name);

    return res.status(200).json({ imageRelated: models, allCount: all.length, all });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
