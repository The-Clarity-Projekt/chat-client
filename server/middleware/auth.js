const jwt = require('jsonwebtoken');
const { User } = require('../models/user');

async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid authentication'
    });
  }
}

// Keep requireAdmin for system-level operations
async function requireAdmin(req, res, next) {
  try {
    await requireAuth(req, res, async () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }
      next();
    });
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
}

module.exports = {
  requireAuth,
  requireAdmin
}; 