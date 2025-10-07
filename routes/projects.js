const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Project = require('../models/Project');
const Design = require('../models/Design');
const { authenticateToken, requireOwnershipOrCollaboration } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/projects
// @desc    Get user's projects
// @access  Private
router.get('/', [
  authenticateToken,
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
    .withMessage('Invalid status'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term too long')
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
    const { status, search, tags, sortBy = 'lastModified', sortOrder = 'desc' } = req.query;

    // Build query
    const query = {
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$and = [
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { tags: { $in: [new RegExp(search, 'i')] } }
          ]
        }
      ];
    }

    if (tags && Array.isArray(tags)) {
      query.tags = { $in: tags };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get projects
    const projects = await Project.find(query)
      .populate('owner', 'firstName lastName email avatar')
      .populate('collaborators.user', 'firstName lastName email avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Project.countDocuments(query);

    // Get project statistics
    const stats = await Project.aggregate([
      { $match: { owner: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        projects,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        },
        stats: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching projects'
    });
  }
});

// @route   GET /api/projects/:id
// @desc    Get single project
// @access  Private
router.get('/:id', [
  authenticateToken,
  requireOwnershipOrCollaboration(Project, 'id')
], async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'firstName lastName email avatar')
      .populate('collaborators.user', 'firstName lastName email avatar');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get project designs
    const designs = await Design.find({ project: project._id })
      .select('name description version thumbnail status createdAt updatedAt')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: {
        project,
        designs
      }
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching project'
    });
  }
});

// @route   POST /api/projects
// @desc    Create new project
// @access  Private
router.post('/', [
  authenticateToken,
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Project name is required and must be less than 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('settings.units')
    .optional()
    .isIn(['metric', 'imperial'])
    .withMessage('Units must be either metric or imperial')
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

    const { name, description, tags, settings } = req.body;

    const project = new Project({
      name,
      description,
      owner: req.user._id,
      tags: tags || [],
      settings: {
        units: settings?.units || 'metric',
        gridSize: settings?.gridSize || 0.5,
        snapToGrid: settings?.snapToGrid !== false,
        showMeasurements: settings?.showMeasurements !== false
      }
    });

    await project.save();

    // Populate owner data
    await project.populate('owner', 'firstName lastName email avatar');

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: { project }
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating project'
    });
  }
});

// @route   PUT /api/projects/:id
// @desc    Update project
// @access  Private
router.put('/:id', [
  authenticateToken,
  requireOwnershipOrCollaboration(Project, 'id'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Project name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('status')
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

    const { name, description, tags, status, settings, isPublic } = req.body;
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;
    if (status !== undefined) updateData.status = status;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (settings) {
      updateData.settings = { ...req.resource.settings, ...settings };
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('owner', 'firstName lastName email avatar')
     .populate('collaborators.user', 'firstName lastName email avatar');

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: { project }
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating project'
    });
  }
});

// @route   DELETE /api/projects/:id
// @desc    Delete project
// @access  Private
router.delete('/:id', [
  authenticateToken,
  requireOwnershipOrCollaboration(Project, 'id')
], async (req, res) => {
  try {
    // Check if user is owner (only owners can delete)
    if (req.resource.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only project owners can delete projects'
      });
    }

    // Delete associated designs
    await Design.deleteMany({ project: req.params.id });

    // Delete project
    await Project.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting project'
    });
  }
});

// @route   POST /api/projects/:id/collaborators
// @desc    Add collaborator to project
// @access  Private
router.post('/:id/collaborators', [
  authenticateToken,
  requireOwnershipOrCollaboration(Project, 'id'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('role')
    .isIn(['viewer', 'editor', 'admin'])
    .withMessage('Role must be viewer, editor, or admin')
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

    const { email, role } = req.body;

    // Find user by email
    const User = require('../models/User');
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is already a collaborator
    const existingCollaborator = req.resource.collaborators.find(
      collab => collab.user.toString() === user._id.toString()
    );

    if (existingCollaborator) {
      return res.status(400).json({
        success: false,
        message: 'User is already a collaborator'
      });
    }

    // Add collaborator
    await req.resource.addCollaborator(user._id, role);

    // Refresh project data
    await req.resource.populate('collaborators.user', 'firstName lastName email avatar');

    res.json({
      success: true,
      message: 'Collaborator added successfully',
      data: { project: req.resource }
    });
  } catch (error) {
    console.error('Add collaborator error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding collaborator'
    });
  }
});

// @route   PUT /api/projects/:id/collaborators/:userId
// @desc    Update collaborator role
// @access  Private
router.put('/:id/collaborators/:userId', [
  authenticateToken,
  requireOwnershipOrCollaboration(Project, 'id'),
  body('role')
    .isIn(['viewer', 'editor', 'admin'])
    .withMessage('Role must be viewer, editor, or admin')
], async (req, res) => {
  try {
    const { role } = req.body;
    const { userId } = req.params;

    // Find collaborator
    const collaborator = req.resource.collaborators.find(
      collab => collab.user.toString() === userId
    );

    if (!collaborator) {
      return res.status(404).json({
        success: false,
        message: 'Collaborator not found'
      });
    }

    // Update role
    collaborator.role = role;
    await req.resource.save();

    // Refresh project data
    await req.resource.populate('collaborators.user', 'firstName lastName email avatar');

    res.json({
      success: true,
      message: 'Collaborator role updated successfully',
      data: { project: req.resource }
    });
  } catch (error) {
    console.error('Update collaborator error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating collaborator'
    });
  }
});

// @route   DELETE /api/projects/:id/collaborators/:userId
// @desc    Remove collaborator from project
// @access  Private
router.delete('/:id/collaborators/:userId', [
  authenticateToken,
  requireOwnershipOrCollaboration(Project, 'id')
], async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is trying to remove themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove yourself from the project'
      });
    }

    // Remove collaborator
    await req.resource.removeCollaborator(userId);

    // Refresh project data
    await req.resource.populate('collaborators.user', 'firstName lastName email avatar');

    res.json({
      success: true,
      message: 'Collaborator removed successfully',
      data: { project: req.resource }
    });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing collaborator'
    });
  }
});

// @route   POST /api/projects/:id/duplicate
// @desc    Duplicate project
// @access  Private
router.post('/:id/duplicate', [
  authenticateToken,
  requireOwnershipOrCollaboration(Project, 'id')
], async (req, res) => {
  try {
    const { name } = req.body;

    // Create new project
    const newProject = new Project({
      name: name || `${req.resource.name} (Copy)`,
      description: req.resource.description,
      owner: req.user._id,
      tags: req.resource.tags,
      settings: req.resource.settings,
      status: 'draft'
    });

    await newProject.save();

    // Duplicate designs
    const designs = await Design.find({ project: req.resource._id });
    for (const design of designs) {
      const newDesign = new Design({
        project: newProject._id,
        name: design.name,
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
    }

    // Populate owner data
    await newProject.populate('owner', 'firstName lastName email avatar');

    res.status(201).json({
      success: true,
      message: 'Project duplicated successfully',
      data: { project: newProject }
    });
  } catch (error) {
    console.error('Duplicate project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while duplicating project'
    });
  }
});

// @route   GET /api/projects/public
// @desc    Get public projects
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

    // Get projects
    const projects = await Project.find(query)
      .populate('owner', 'firstName lastName email avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Project.countDocuments(query);

    res.json({
      success: true,
      data: {
        projects,
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
    console.error('Get public projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching public projects'
    });
  }
});

module.exports = router;



