const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sfl-tracker-super-secret-key-123';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập để tiếp tục.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.' });
    }
    req.user = user;
    next();
  });
};

module.exports = {
  verifyToken,
  JWT_SECRET
};
