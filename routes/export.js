const express = require('express');
const { body, validationResult } = require('express-validator');
const Design = require('../models/Design');
const { authenticateToken, requireSubscription } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/export/gltf
// @desc    Export design as GLTF/GLB
// @access  Private
router.post('/gltf', [
  authenticateToken,
  body('designId')
    .isMongoId()
    .withMessage('Valid design ID is required'),
  body('format')
    .isIn(['gltf', 'glb'])
    .withMessage('Format must be gltf or glb'),
  body('includeFurniture')
    .optional()
    .isBoolean()
    .withMessage('Include furniture must be a boolean'),
  body('includeWalls')
    .optional()
    .isBoolean()
    .withMessage('Include walls must be a boolean')
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

    const { designId, format, includeFurniture = true, includeWalls = true } = req.body;

    const design = await Design.findById(designId)
      .populate('project', 'owner collaborators');

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    // Check if user has access to the design
    const project = design.project;
    const hasAccess = project.owner.toString() === req.user._id.toString() ||
      (project.collaborators && project.collaborators.some(
        collab => collab.user.toString() === req.user._id.toString()
      )) ||
      design.isPublic;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Generate GLTF/GLB data
    const exportData = await generateGLTFExport(design, {
      format,
      includeFurniture,
      includeWalls
    });

    res.json({
      success: true,
      message: 'Design exported successfully',
      data: {
        downloadUrl: exportData.url,
        filename: exportData.filename,
        fileSize: exportData.fileSize,
        format: exportData.format,
        expiresAt: exportData.expiresAt
      }
    });
  } catch (error) {
    console.error('GLTF export error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting design'
    });
  }
});

// @route   POST /api/export/image
// @desc    Export design as image
// @access  Private
router.post('/image', [
  authenticateToken,
  requireSubscription('pro'),
  body('designId')
    .isMongoId()
    .withMessage('Valid design ID is required'),
  body('format')
    .isIn(['png', 'jpg', 'jpeg'])
    .withMessage('Format must be png, jpg, or jpeg'),
  body('quality')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Quality must be between 1 and 100'),
  body('resolution')
    .optional()
    .isIn(['hd', '4k', '8k'])
    .withMessage('Resolution must be hd, 4k, or 8k'),
  body('cameraAngle')
    .optional()
    .isObject()
    .withMessage('Camera angle must be an object')
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

    const { 
      designId, 
      format, 
      quality = 90, 
      resolution = 'hd',
      cameraAngle 
    } = req.body;

    const design = await Design.findById(designId)
      .populate('project', 'owner collaborators');

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    // Check if user has access to the design
    const project = design.project;
    const hasAccess = project.owner.toString() === req.user._id.toString() ||
      (project.collaborators && project.collaborators.some(
        collab => collab.user.toString() === req.user._id.toString()
      )) ||
      design.isPublic;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Generate image
    const exportData = await generateImageExport(design, {
      format,
      quality,
      resolution,
      cameraAngle: cameraAngle || design.camera
    });

    res.json({
      success: true,
      message: 'Design exported as image successfully',
      data: {
        downloadUrl: exportData.url,
        filename: exportData.filename,
        fileSize: exportData.fileSize,
        format: exportData.format,
        resolution: exportData.resolution,
        expiresAt: exportData.expiresAt
      }
    });
  } catch (error) {
    console.error('Image export error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting image'
    });
  }
});

// @route   POST /api/export/pdf
// @desc    Export design as PDF
// @access  Private
router.post('/pdf', [
  authenticateToken,
  requireSubscription('pro'),
  body('designId')
    .isMongoId()
    .withMessage('Valid design ID is required'),
  body('includeFloorPlan')
    .optional()
    .isBoolean()
    .withMessage('Include floor plan must be a boolean'),
  body('include3DView')
    .optional()
    .isBoolean()
    .withMessage('Include 3D view must be a boolean'),
  body('includeFurnitureList')
    .optional()
    .isBoolean()
    .withMessage('Include furniture list must be a boolean'),
  body('includeMeasurements')
    .optional()
    .isBoolean()
    .withMessage('Include measurements must be a boolean')
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

    const { 
      designId, 
      includeFloorPlan = true,
      include3DView = true,
      includeFurnitureList = true,
      includeMeasurements = true
    } = req.body;

    const design = await Design.findById(designId)
      .populate('project', 'owner collaborators');

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    // Check if user has access to the design
    const project = design.project;
    const hasAccess = project.owner.toString() === req.user._id.toString() ||
      (project.collaborators && project.collaborators.some(
        collab => collab.user.toString() === req.user._id.toString()
      )) ||
      design.isPublic;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Generate PDF
    const exportData = await generatePDFExport(design, {
      includeFloorPlan,
      include3DView,
      includeFurnitureList,
      includeMeasurements
    });

    res.json({
      success: true,
      message: 'Design exported as PDF successfully',
      data: {
        downloadUrl: exportData.url,
        filename: exportData.filename,
        fileSize: exportData.fileSize,
        pages: exportData.pages,
        expiresAt: exportData.expiresAt
      }
    });
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting PDF'
    });
  }
});

// @route   GET /api/export/history
// @desc    Get user's export history
// @access  Private
router.get('/history', [
  authenticateToken,
  require('express-validator').query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  require('express-validator').query('limit')
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Mock export history - in production, this would query actual export records
    const exports = [
      {
        id: 'export-1',
        designId: 'design-1',
        designName: 'Living Room Design',
        type: 'gltf',
        format: 'glb',
        fileSize: '2.5MB',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        downloadUrl: 'https://example.com/export1.glb',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'export-2',
        designId: 'design-2',
        designName: 'Bedroom Design',
        type: 'image',
        format: 'png',
        fileSize: '1.2MB',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        downloadUrl: 'https://example.com/export2.png',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    ];

    res.json({
      success: true,
      data: {
        exports: exports.slice(skip, skip + limit),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(exports.length / limit),
          totalItems: exports.length,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(exports.length / limit),
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get export history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching export history'
    });
  }
});

// Helper functions
async function generateGLTFExport(design, options) {
  // Mock GLTF generation - in production, this would use Three.js GLTFExporter
  const filename = `${design.name.replace(/[^a-zA-Z0-9]/g, '_')}.${options.format}`;
  const fileSize = Math.floor(Math.random() * 5000000) + 1000000; // 1-5MB
  
  return {
    url: `https://exports.designspace3d.com/gltf/${filename}`,
    filename,
    fileSize,
    format: options.format,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  };
}

async function generateImageExport(design, options) {
  // Mock image generation - in production, this would render the 3D scene
  const resolutionMap = { hd: '1920x1080', '4k': '3840x2160', '8k': '7680x4320' };
  const filename = `${design.name.replace(/[^a-zA-Z0-9]/g, '_')}.${options.format}`;
  const fileSize = Math.floor(Math.random() * 10000000) + 2000000; // 2-10MB
  
  return {
    url: `https://exports.designspace3d.com/images/${filename}`,
    filename,
    fileSize,
    format: options.format,
    resolution: resolutionMap[options.resolution],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  };
}

async function generatePDFExport(design, options) {
  // Mock PDF generation - in production, this would generate actual PDF
  const filename = `${design.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  const fileSize = Math.floor(Math.random() * 15000000) + 5000000; // 5-15MB
  const pages = (options.includeFloorPlan ? 1 : 0) + 
                (options.include3DView ? 1 : 0) + 
                (options.includeFurnitureList ? 1 : 0) + 
                (options.includeMeasurements ? 1 : 0);
  
  return {
    url: `https://exports.designspace3d.com/pdf/${filename}`,
    filename,
    fileSize,
    pages,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  };
}

module.exports = router;



