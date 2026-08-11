const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middlewares/auth.cjs');

const { getUsersCollection } = require('../config/db.cjs');

router.post('/login', async (req, res) => {
  const { farmId } = req.body;
  if (!farmId) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Vui lòng cung cấp Farm ID' });
  }

  try {
    const token = jwt.sign({ farmId: parseInt(farmId, 10) }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});



module.exports = router;
