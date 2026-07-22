const data = require('../brand-data.json');

const { guard } = require('./_guard');

module.exports = async (req, res) => {
  if (guard(req, res, { method: 'GET' })) return;

  try {
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error brand-info:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
