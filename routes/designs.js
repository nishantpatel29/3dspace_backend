const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Design = require('../models/Design');
const Project = require('../models/Project');
const { authenticateToken, requireOwnershipOrCollaboration } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/designs
// @desc    Get user's designs
// @access  Private
router.get('/', [
  authenticateToken,
  query('projectId')
    .optional()
    .isMongoId()
    .withMessage('Invalid project ID'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['draft', 'in_progress', 'completed', 'archived'])
    .withMessage('Invalid status')
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
    const { projectId, status, search, sortBy = 'updatedAt', sortOrder = 'desc' } = req.query;

    // Build query
    const query = {};

    if (projectId) {
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

      query.project = projectId;
    } else {
      // Get all projects user has access to
      const userProjects = await Project.find({
        $or: [
          { owner: req.user._id },
          { 'collaborators.user': req.user._id }
        ]
      }).select('_id');

      query.project = { $in: userProjects.map(p => p._id) };
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get designs
    const designs = await Design.find(query)
      .populate('project', 'name description owner')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Design.countDocuments(query);

    res.json({
      success: true,
      data: {
        designs,
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
    console.error('Get designs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching designs'
    });
  }
});

// @route   GET /api/designs/:id
// @desc    Get single design
// @access  Private
router.get('/:id', [
  authenticateToken
], async (req, res) => {
  try {
    const design = await Design.findById(req.params.id)
      .populate('project', 'name description owner collaborators');

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    // Check if user has access to the project
    const project = design.project;
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Associated project not found'
      });
    }

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

    res.json({
      success: true,
      data: { design }
    });
  } catch (error) {
    console.error('Get design error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching design'
    });
  }
});

// @route   POST /api/designs
// @desc    Create new design
// @access  Private
router.post('/', [
  authenticateToken,
  body('projectId')
    .isMongoId()
    .withMessage('Valid project ID is required'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Design name is required and must be less than 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
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

    const { projectId, name, description, designData } = req.body;

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

    // Create design
    const design = new Design({
      project: projectId,
      name,
      description,
      ...(designData && {
        settings: designData.settings,
        elements: designData.elements,
        furniture: designData.furniture,
        layers: designData.layers,
        camera: designData.camera,
        environment: designData.environment
      })
    });

    await design.save();

    // Populate project data
    await design.populate('project', 'name description owner');

    res.status(201).json({
      success: true,
      message: 'Design created successfully',
      data: { design }
    });
  } catch (error) {
    console.error('Create design error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating design'
    });
  }
});

// @route   PUT /api/designs/:id
// @desc    Update design
// @access  Private
router.put('/:id', [
  authenticateToken
], async (req, res) => {
  try {
    const design = await Design.findById(req.params.id)
      .populate('project', 'owner collaborators');

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    // Check if user has access to the project
    const project = design.project;
    const hasAccess = project.owner.toString() === req.user._id.toString() ||
      (project.collaborators && project.collaborators.some(
        collab => collab.user.toString() === req.user._id.toString() && 
        ['editor', 'admin'].includes(collab.role)
      ));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const {
      name,
      description,
      settings,
      elements,
      furniture,
      layers,
      camera,
      environment,
      status,
      tags
    } = req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (settings !== undefined) updateData.settings = { ...design.settings, ...settings };
    if (elements !== undefined) updateData.elements = elements;
    if (furniture !== undefined) updateData.furniture = furniture;
    if (layers !== undefined) updateData.layers = layers;
    if (camera !== undefined) updateData.camera = camera;
    if (environment !== undefined) updateData.environment = { ...design.environment, ...environment };
    if (status !== undefined) updateData.status = status;
    if (tags !== undefined) updateData.tags = tags;

    const updatedDesign = await Design.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('project', 'name description owner');

    res.json({
      success: true,
      message: 'Design updated successfully',
      data: { design: updatedDesign }
    });
  } catch (error) {
    console.error('Update design error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating design'
    });
  }
});

// @route   DELETE /api/designs/:id
// @desc    Delete design
// @access  Private
router.delete('/:id', [
  authenticateToken
], async (req, res) => {
  try {
    const design = await Design.findById(req.params.id)
      .populate('project', 'owner collaborators');

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    // Check if user has access to the project
    const project = design.project;
    const hasAccess = project.owner.toString() === req.user._id.toString() ||
      (project.collaborators && project.collaborators.some(
        collab => collab.user.toString() === req.user._id.toString() && 
        ['editor', 'admin'].includes(collab.role)
      ));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await Design.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Design deleted successfully'
    });
  } catch (error) {
    console.error('Delete design error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting design'
    });
  }
});

// @route   POST /api/designs/:id/furniture
// @desc    Add furniture to design
// @access  Private
router.post('/:id/furniture', [
  authenticateToken,
  body('furnitureId')
    .notEmpty()
    .withMessage('Furniture ID is required'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Furniture name is required'),
  body('category')
    .isIn(['Seating', 'Tables', 'Storage', 'Lighting', 'Bedroom', 'Decorative'])
    .withMessage('Invalid furniture category'),
  body('position')
    .isObject()
    .withMessage('Position is required'),
  body('position.x')
    .isNumeric()
    .withMessage('Position X must be a number'),
  body('position.y')
    .isNumeric()
    .withMessage('Position Y must be a number'),
  body('position.z')
    .isNumeric()
    .withMessage('Position Z must be a number')
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

    const design = await Design.findById(req.params.id)
      .populate('project', 'owner collaborators');

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    // Check if user has access to the project
    const project = design.project;
    const hasAccess = project.owner.toString() === req.user._id.toString() ||
      (project.collaborators && project.collaborators.some(
        collab => collab.user.toString() === req.user._id.toString() && 
        ['editor', 'admin'].includes(collab.role)
      ));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const furnitureData = req.body;
    await design.addFurniture(furnitureData);

    res.json({
      success: true,
      message: 'Furniture added successfully',
      data: { design }
    });
  } catch (error) {
    console.error('Add furniture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding furniture'
    });
  }
});

// @route   PUT /api/designs/:id/furniture/:furnitureId
// @desc    Update furniture in design
// @access  Private
router.put('/:id/furniture/:furnitureId', [
  authenticateToken
], async (req, res) => {
  try {
    const design = await Design.findById(req.params.id)
      .populate('project', 'owner collaborators');

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    // Check if user has access to the project
    const project = design.project;
    const hasAccess = project.owner.toString() === req.user._id.toString() ||
      (project.collaborators && project.collaborators.some(
        collab => collab.user.toString() === req.user._id.toString() && 
        ['editor', 'admin'].includes(collab.role)
      ));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { furnitureId } = req.params;
    const updateData = req.body;

    await design.updateFurniture(furnitureId, updateData);

    res.json({
      success: true,
      message: 'Furniture updated successfully',
      data: { design }
    });
  } catch (error) {
    if (error.message === 'Furniture not found') {
      return res.status(404).json({
        success: false,
        message: 'Furniture not found'
      });
    }

    console.error('Update furniture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating furniture'
    });
  }
});

// @route   DELETE /api/designs/:id/furniture/:furnitureId
// @desc    Remove furniture from design
// @access  Private
router.delete('/:id/furniture/:furnitureId', [
  authenticateToken
], async (req, res) => {
  try {
    const design = await Design.findById(req.params.id)
      .populate('project', 'owner collaborators');

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    // Check if user has access to the project
    const project = design.project;
    const hasAccess = project.owner.toString() === req.user._id.toString() ||
      (project.collaborators && project.collaborators.some(
        collab => collab.user.toString() === req.user._id.toString() && 
        ['editor', 'admin'].includes(collab.role)
      ));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { furnitureId } = req.params;
    await design.removeFurniture(furnitureId);

    res.json({
      success: true,
      message: 'Furniture removed successfully',
      data: { design }
    });
  } catch (error) {
    console.error('Remove furniture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing furniture'
    });
  }
});

// @route   POST /api/designs/:id/duplicate
// @desc    Duplicate design
// @access  Private
router.post('/:id/duplicate', [
  authenticateToken,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Design name must be between 1 and 100 characters')
], async (req, res) => {
  try {
    const design = await Design.findById(req.params.id)
      .populate('project', 'owner collaborators');

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    // Check if user has access to the project
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

    const { name } = req.body;

    // Create new design
    const newDesign = new Design({
      project: design.project,
      name: name || `${design.name} (Copy)`,
      description: design.description,
      version: '1.0.0',
      settings: design.settings,
      elements: design.elements,
      furniture: design.furniture,
      layers: design.layers,
      camera: design.camera,
      environment: design.environment,
      status: 'draft'
    });

    await newDesign.save();

    // Populate project data
    await newDesign.populate('project', 'name description owner');

    res.status(201).json({
      success: true,
      message: 'Design duplicated successfully',
      data: { design: newDesign }
    });
  } catch (error) {
    console.error('Duplicate design error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while duplicating design'
    });
  }
});

// @route   GET /api/designs/public
// @desc    Get public designs
// @access  Public
router.get('/public', [
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
    .isIn(['living', 'bedroom', 'kitchen', 'bathroom', 'office', 'outdoor', 'commercial'])
    .withMessage('Invalid category')
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
    const { category, search, sortBy = 'updatedAt', sortOrder = 'desc' } = req.query;

    // Build query
    const query = { isPublic: true };

    if (category) {
      query.templateCategory = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get designs
    const designs = await Design.find(query)
      .populate('project', 'name description owner')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Design.countDocuments(query);

    res.json({
      success: true,
      data: {
        designs,
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
    console.error('Get public designs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching public designs'
    });
  }
});

module.exports = router;


