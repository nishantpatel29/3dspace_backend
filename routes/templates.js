const express = require('express');
const { query, validationResult } = require('express-validator');
const Template = require('../models/Template');
const Design = require('../models/Design');
const Project = require('../models/Project');
const { optionalAuth, authenticateToken, requireSubscription } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/templates
// @desc    Get templates
// @access  Public
router.get('/', [
  optionalAuth,
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('category')
    .optional()
    .isIn(['living', 'bedroom', 'kitchen', 'bathroom', 'office', 'outdoor', 'commercial', 'studio', 'dining'])
    .withMessage('Invalid category'),
  query('difficulty')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Invalid difficulty'),
  query('style')
    .optional()
    .isIn(['modern', 'traditional', 'contemporary', 'minimalist', 'industrial', 'scandinavian', 'bohemian', 'rustic', 'mid-century', 'art-deco'])
    .withMessage('Invalid style'),
  query('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean'),
  query('premium')
    .optional()
    .isBoolean()
    .withMessage('Premium must be a boolean'),
  query('sortBy')
    .optional()
    .isIn(['name', 'popularity', 'usageCount', 'rating', 'createdAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const {
      search,
      category,
      subcategory,
      difficulty,
      style,
      featured,
      premium,
      tags,
      minArea,
      maxArea,
      sortBy = 'popularity',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { isActive: true };

    // Filter by user subscription
    if (req.user) {
      const userPlan = req.user.subscription.plan;
      if (userPlan === 'free') {
        query['requirements.subscription'] = { $in: ['free'] };
      } else if (userPlan === 'pro') {
        query['requirements.subscription'] = { $in: ['free', 'pro'] };
      }
      // Enterprise users can access all templates
    } else {
      // Non-authenticated users can only see free templates
      query['requirements.subscription'] = 'free';
    }

    if (search) {
      query.$text = { $search: search };
    }

    if (category) {
      query.category = category;
    }

    if (subcategory) {
      query.subcategory = { $regex: subcategory, $options: 'i' };
    }

    if (difficulty) {
      query.difficulty = difficulty;
    }

    if (style) {
      query.style = style;
    }

    if (featured !== undefined) {
      query.isFeatured = featured === 'true';
    }

    if (premium !== undefined) {
      query.isPremium = premium === 'true';
    }

    if (tags && Array.isArray(tags)) {
      query.tags = { $in: tags };
    }

    if (minArea !== undefined || maxArea !== undefined) {
      query['metadata.totalArea'] = {};
      if (minArea !== undefined) query['metadata.totalArea'].$gte = parseFloat(minArea);
      if (maxArea !== undefined) query['metadata.totalArea'].$lte = parseFloat(maxArea);
    }

    // Build sort object
    const sort = {};
    if (search && query.$text) {
      sort.score = { $meta: 'textScore' };
    }
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get templates
    const templates = await Template.find(query, search ? { score: { $meta: 'textScore' } } : {})
      .populate('author', 'firstName lastName email avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Template.countDocuments(query);

    // Get aggregation data for filters
    const aggregationData = await Template.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          categories: { $addToSet: '$category' },
          subcategories: { $addToSet: '$subcategory' },
          difficulties: { $addToSet: '$difficulty' },
          styles: { $addToSet: '$style' },
          minArea: { $min: '$metadata.totalArea' },
          maxArea: { $max: '$metadata.totalArea' }
        }
      }
    ]);

    const filters = aggregationData[0] || {
      categories: [],
      subcategories: [],
      difficulties: [],
      styles: [],
      minArea: 0,
      maxArea: 0
    };

    res.json({
      success: true,
      data: {
        templates,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        },
        filters
      }
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching templates'
    });
  }
});

// @route   GET /api/templates/:id
// @desc    Get single template
// @access  Public
router.get('/:id', [
  optionalAuth
], async (req, res) => {
  try {
    const template = await Template.findById(req.params.id)
      .populate('author', 'firstName lastName email avatar');

    if (!template || !template.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Check if user can access template
    if (req.user && !template.canAccess(req.user.subscription.plan)) {
      return res.status(403).json({
        success: false,
        message: 'Upgrade your subscription to access this template',
        requiredPlan: template.requirements.subscription
      });
    }

    if (!req.user && template.requirements.subscription !== 'free') {
      return res.status(403).json({
        success: false,
        message: 'Please sign in to access this template',
        requiredPlan: template.requirements.subscription
      });
    }

    // Increment usage count
    await template.incrementUsage();

    // Get similar templates
    const similar = await template.getSimilar(5);

    res.json({
      success: true,
      data: {
        template,
        similar
      }
    });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching template'
    });
  }
});

// @route   POST /api/templates/:id/use
// @desc    Use template to create new design
// @access  Private
router.post('/:id/use', [
  authenticateToken,
  require('express-validator').body('projectId')
    .isMongoId()
    .withMessage('Valid project ID is required'),
  require('express-validator').body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Design name must be between 1 and 100 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { projectId, name } = req.body;
    const template = await Template.findById(req.params.id);

    if (!template || !template.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Check if user can access template
    if (!template.canAccess(req.user.subscription.plan)) {
      return res.status(403).json({
        success: false,
        message: 'Upgrade your subscription to use this template',
        requiredPlan: template.requirements.subscription
      });
    }

    // Check if user has access to the project
    const project = await Project.findOne({
      _id: projectId,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Create new design from template
    const design = new Design({
      project: projectId,
      name: name || template.name,
      description: `Created from template: ${template.name}`,
      version: '1.0.0',
      settings: {
        gridVisible: true,
        snapToGrid: true,
        showMeasurements: true,
        zoomLevel: 100,
        activeMode: '2D'
      },
      elements: {
        walls: template.walls,
        windows: template.windows,
        rooms: template.walls.filter(wall => wall.type === 'room')
      },
      furniture: template.furniture,
      layers: [
        { id: 'floor', name: 'Floor Plan', visible: true, active: true, order: 0 },
        { id: 'furniture', name: 'Furniture', visible: true, active: false, order: 1 },
        { id: 'lighting', name: 'Lighting', visible: true, active: false, order: 2 }
      ],
      camera: {
        position: { x: 15, y: 15, z: 15 },
        target: { x: 0, y: 0, z: 0 },
        fov: 60
      },
      environment: {
        lighting: {
          ambientIntensity: 0.2,
          directionalIntensity: 0.6,
          pointIntensity: 0.2
        },
        background: 'city',
        customBackground: null
      },
      status: 'draft',
      tags: template.tags
    });

    await design.save();

    // Populate project data
    await design.populate('project', 'name description owner');

    res.status(201).json({
      success: true,
      message: 'Design created from template successfully',
      data: { design }
    });
  } catch (error) {
    console.error('Use template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while using template'
    });
  }
});

// @route   GET /api/templates/categories
// @desc    Get template categories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await Template.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          subcategories: { $addToSet: '$subcategory' }
        }
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          subcategories: {
            $filter: {
              input: '$subcategories',
              cond: { $ne: ['$$this', null] }
            }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    console.error('Get template categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching template categories'
    });
  }
});

// @route   GET /api/templates/featured
// @desc    Get featured templates
// @access  Public
router.get('/featured', [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const templates = await Template.getFeatured(limit);

    res.json({
      success: true,
      data: { templates }
    });
  } catch (error) {
    console.error('Get featured templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching featured templates'
    });
  }
});

// @route   GET /api/templates/category/:category
// @desc    Get templates by category
// @access  Public
router.get('/category/:category', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const templates = await Template.getByCategory(category, limit, skip);

    // Get total count for this category
    const total = await Template.countDocuments({
      category: category,
      isActive: true
    });

    res.json({
      success: true,
      data: {
        templates,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get templates by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching templates by category'
    });
  }
});

// @route   GET /api/templates/style/:style
// @desc    Get templates by style
// @access  Public
router.get('/style/:style', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { style } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const templates = await Template.getByStyle(style, limit, skip);

    // Get total count for this style
    const total = await Template.countDocuments({
      style: style,
      isActive: true
    });

    res.json({
      success: true,
      data: {
        templates,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get templates by style error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching templates by style'
    });
  }
});

// @route   POST /api/templates/:id/rate
// @desc    Rate template
// @access  Private
router.post('/:id/rate', [
  authenticateToken,
  require('express-validator').body('rating')
    .isFloat({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { rating } = req.body;
    const template = await Template.findById(req.params.id);

    if (!template || !template.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    await template.updateRating(parseFloat(rating));

    res.json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        averageRating: template.ratings.average,
        ratingCount: template.ratings.count
      }
    });
  } catch (error) {
    console.error('Rate template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while rating template'
    });
  }
});

// @route   GET /api/templates/search
// @desc    Search templates
// @access  Public
router.get('/search', [
  query('q')
    .notEmpty()
    .withMessage('Search query is required'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { q: query, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const templates = await Template.search(query, { isActive: true })
      .populate('author', 'firstName lastName email avatar')
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Template.countDocuments({
      $text: { $search: query },
      isActive: true
    });

    res.json({
      success: true,
      data: {
        templates,
        query,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Search templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching templates'
    });
  }
});

module.exports = router;


