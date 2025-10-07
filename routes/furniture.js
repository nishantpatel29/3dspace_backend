const express = require('express');
const { query, validationResult } = require('express-validator');
const Furniture = require('../models/Furniture');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/furniture
// @desc    Get furniture catalog
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
    .isIn(['Seating', 'Tables', 'Storage', 'Lighting', 'Bedroom', 'Decorative', 'Kitchen', 'Bathroom', 'Outdoor'])
    .withMessage('Invalid category'),
  query('subcategory')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Subcategory too long'),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Min price must be a positive number'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Max price must be a positive number'),
  query('brand')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Brand name too long'),
  query('style')
    .optional()
    .isIn(['modern', 'traditional', 'contemporary', 'minimalist', 'industrial', 'scandinavian', 'bohemian', 'rustic', 'mid-century', 'art-deco'])
    .withMessage('Invalid style'),
  query('inStock')
    .optional()
    .isBoolean()
    .withMessage('In stock must be a boolean'),
  query('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean'),
  query('sortBy')
    .optional()
    .isIn(['name', 'price', 'popularity', 'rating', 'createdAt'])
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
      minPrice,
      maxPrice,
      brand,
      style,
      inStock,
      featured,
      tags,
      materials,
      colors,
      sortBy = 'popularity',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { isActive: true };

    if (search) {
      query.$text = { $search: search };
    }

    if (category) {
      query.category = category;
    }

    if (subcategory) {
      query.subcategory = { $regex: subcategory, $options: 'i' };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query['pricing.retail'] = {};
      if (minPrice !== undefined) query['pricing.retail'].$gte = parseFloat(minPrice);
      if (maxPrice !== undefined) query['pricing.retail'].$lte = parseFloat(maxPrice);
    }

    if (brand) {
      query.brand = { $regex: brand, $options: 'i' };
    }

    if (style) {
      query.style = style;
    }

    if (inStock !== undefined) {
      query['availability.inStock'] = inStock === 'true';
    }

    if (featured !== undefined) {
      query.isFeatured = featured === 'true';
    }

    if (tags && Array.isArray(tags)) {
      query.tags = { $in: tags };
    }

    if (materials && Array.isArray(materials)) {
      query.materials = { $in: materials };
    }

    if (colors && Array.isArray(colors)) {
      query['colors.hex'] = { $in: colors };
    }

    // Build sort object
    const sort = {};
    if (search && query.$text) {
      sort.score = { $meta: 'textScore' };
    }
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get furniture
    const furniture = await Furniture.find(query, search ? { score: { $meta: 'textScore' } } : {})
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Furniture.countDocuments(query);

    // Get aggregation data for filters
    const aggregationData = await Furniture.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          categories: { $addToSet: '$category' },
          subcategories: { $addToSet: '$subcategory' },
          brands: { $addToSet: '$brand' },
          styles: { $addToSet: '$style' },
          materials: { $addToSet: '$materials' },
          minPrice: { $min: '$pricing.retail' },
          maxPrice: { $max: '$pricing.retail' }
        }
      }
    ]);

    const filters = aggregationData[0] || {
      categories: [],
      subcategories: [],
      brands: [],
      styles: [],
      materials: [],
      minPrice: 0,
      maxPrice: 0
    };

    // Flatten materials array
    filters.materials = [...new Set(filters.materials.flat())];

    res.json({
      success: true,
      data: {
        furniture,
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
    console.error('Get furniture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching furniture'
    });
  }
});

// @route   GET /api/furniture/:id
// @desc    Get single furniture item
// @access  Public
router.get('/:id', [
  optionalAuth
], async (req, res) => {
  try {
    const furniture = await Furniture.findById(req.params.id);

    if (!furniture || !furniture.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Furniture not found'
      });
    }

    // Increment popularity
    await furniture.incrementPopularity();

    // Get similar furniture
    const similar = await furniture.getSimilar(5);

    res.json({
      success: true,
      data: {
        furniture,
        similar
      }
    });
  } catch (error) {
    console.error('Get furniture item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching furniture item'
    });
  }
});

// @route   GET /api/furniture/categories
// @desc    Get furniture categories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await Furniture.aggregate([
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
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching categories'
    });
  }
});

// @route   GET /api/furniture/featured
// @desc    Get featured furniture
// @access  Public
router.get('/featured', [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const furniture = await Furniture.getFeatured(limit);

    res.json({
      success: true,
      data: { furniture }
    });
  } catch (error) {
    console.error('Get featured furniture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching featured furniture'
    });
  }
});

// @route   GET /api/furniture/category/:category
// @desc    Get furniture by category
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

    const furniture = await Furniture.getByCategory(category, limit, skip);

    // Get total count for this category
    const total = await Furniture.countDocuments({
      category: category,
      isActive: true
    });

    res.json({
      success: true,
      data: {
        furniture,
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
    console.error('Get furniture by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching furniture by category'
    });
  }
});

// @route   GET /api/furniture/search
// @desc    Search furniture
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

    const furniture = await Furniture.search(query, { isActive: true })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Furniture.countDocuments({
      $text: { $search: query },
      isActive: true
    });

    res.json({
      success: true,
      data: {
        furniture,
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
    console.error('Search furniture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching furniture'
    });
  }
});

// @route   POST /api/furniture/:id/rate
// @desc    Rate furniture item
// @access  Private
router.post('/:id/rate', [
  require('../middleware/auth').authenticateToken,
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
    const furniture = await Furniture.findById(req.params.id);

    if (!furniture || !furniture.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Furniture not found'
      });
    }

    await furniture.updateRating(parseFloat(rating));

    res.json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        averageRating: furniture.ratings.average,
        ratingCount: furniture.ratings.count
      }
    });
  } catch (error) {
    console.error('Rate furniture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while rating furniture'
    });
  }
});

// @route   GET /api/furniture/trending
// @desc    Get trending furniture
// @access  Public
router.get('/trending', [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('period')
    .optional()
    .isIn(['day', 'week', 'month'])
    .withMessage('Period must be day, week, or month')
], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const period = req.query.period || 'week';

    // Calculate date based on period
    const now = new Date();
    let startDate;
    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const furniture = await Furniture.find({
      isActive: true,
      updatedAt: { $gte: startDate }
    })
    .sort({ popularity: -1, 'ratings.average': -1 })
    .limit(limit);

    res.json({
      success: true,
      data: { furniture }
    });
  } catch (error) {
    console.error('Get trending furniture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching trending furniture'
    });
  }
});

module.exports = router;



