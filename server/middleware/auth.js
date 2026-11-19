const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { get } = require('../db');

// Middleware to authenticate JWT if present, otherwise treat as guest
function authenticateOptional(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = { role: 'guest' };
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Fetch fresh user record from DB to verify user still exists and has updated role/scope
    const user = get('SELECT id, email, role, display_name, staff_scope FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      req.user = { role: 'guest' };
      return next();
    }
    req.user = user;
    next();
  } catch (err) {
    // If token was provided but expired/invalid, let's return 401 so frontend can clear stale token
    return res.status(401).json({ error: 'Session expired or invalid token', code: 'INVALID_TOKEN' });
  }
}

// Middleware requiring authenticated user (not guest)
function requireAuth(req, res, next) {
  authenticateOptional(req, res, () => {
    if (!req.user || req.user.role === 'guest') {
      return res.status(401).json({ error: 'Authentication required for this action', code: 'AUTH_REQUIRED' });
    }
    next();
  });
}

// Middleware requiring specific role(s) - e.g. requireRole('staff')
function requireRole(...roles) {
  return (req, res, next) => {
    authenticateOptional(req, res, () => {
      if (!req.user || req.user.role === 'guest') {
        return res.status(401).json({ error: 'Please sign in to continue', code: 'AUTH_REQUIRED' });
      }
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ 
          error: `Forbidden: Access restricted to ${roles.join(' or ')}`, 
          code: 'FORBIDDEN',
          userRole: req.user.role 
        });
      }
      next();
    });
  };
}

// Middleware checking staff scope for space modification
function checkStaffScope(spaceId, user) {
  if (user.role !== 'staff') return false;
  if (!user.staff_scope || user.staff_scope === 'all') return true;
  
  const space = get('SELECT owner_scope FROM spaces WHERE id = ?', [spaceId]);
  if (!space) return true; // Let the 404 handler catch missing space
  return space.owner_scope === user.staff_scope;
}

module.exports = {
  authenticateOptional,
  optionalAuth: authenticateOptional,
  requireAuth,
  requireRole,
  checkStaffScope
};
