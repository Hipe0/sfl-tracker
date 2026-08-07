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
    const usersCollection = getUsersCollection();
    if (!usersCollection) {
      return res.status(500).json({ error: 'SERVER_ERROR', message: 'Chưa kết nối CSDL' });
    }
    
    const user = await usersCollection.findOne({ farmId });

    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Farm ID này không nằm trong danh sách quản lý. Vui lòng liên hệ Admin qua Discord!' });
    }

    const token = jwt.sign({ farmId: user.farmId }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});



module.exports = router;
