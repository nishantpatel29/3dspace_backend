const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token - user not found' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is deactivated' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    });
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
};

// Check if user has required subscription
const requireSubscription = (requiredPlan) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const planHierarchy = { free: 1, pro: 2, enterprise: 3 };
    const userPlan = req.user.subscription.plan;
    const requiredLevel = planHierarchy[requiredPlan];
    const userLevel = planHierarchy[userPlan];

    if (userLevel < requiredLevel) {
      return res.status(403).json({ 
        success: false, 
        message: `${requiredPlan} subscription required`,
        requiredPlan: requiredPlan,
        currentPlan: userPlan
      });
    }

    next();
  };
};

// Check if user owns resource or is collaborator
const requireOwnershipOrCollaboration = (resourceModel, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      const resourceId = req.params[resourceIdParam];
      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        return res.status(404).json({ 
          success: false, 
          message: 'Resource not found' 
        });
      }

      // Check if user owns the resource
      if (resource.owner && resource.owner.toString() === req.user._id.toString()) {
        req.resource = resource;
        return next();
      }

      // Check if user is a collaborator (if resource has collaborators)
      if (resource.collaborators && resource.collaborators.length > 0) {
        const isCollaborator = resource.collaborators.some(
          collab => collab.user.toString() === req.user._id.toString()
        );
        
        if (isCollaborator) {
          req.resource = resource;
          return next();
        }
      }

      // Check if resource is public (for read-only access)
      if (req.method === 'GET' && resource.isPublic) {
        req.resource = resource;
        return next();
      }

      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error checking resource access' 
      });
    }
  };
};

// Rate limiting for specific routes
const createRateLimit = (windowMs, max, message) => {
  const rateLimit = require('express-rate-limit');
  
  return rateLimit({
    windowMs,
    max,
    message: { 
      success: false, 
      message: message || 'Too many requests, please try again later.' 
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Admin only middleware
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireSubscription,
  requireOwnershipOrCollaboration,
  createRateLimit,
  requireAdmin
};



