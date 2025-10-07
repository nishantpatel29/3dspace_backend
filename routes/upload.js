const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { authenticateToken, requireSubscription } = require('../middleware/auth');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'designspace3d',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'gltf', 'glb', 'obj', 'fbx'],
    transformation: [
      { width: 1920, height: 1080, crop: 'limit', quality: 'auto' }
    ]
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files per request
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = /jpeg|jpg|png|gif|webp|gltf|glb|obj|fbx/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and 3D models are allowed.'));
    }
  }
});

// @route   POST /api/upload/image
// @desc    Upload image files
// @access  Private
router.post('/image', [
  authenticateToken,
  upload.single('image')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: req.file.path,
        publicId: req.file.filename,
        secureUrl: req.file.path,
        width: req.file.width,
        height: req.file.height,
        format: req.file.format,
        size: req.file.size,
        uploadedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading image'
    });
  }
});

// @route   POST /api/upload/images
// @desc    Upload multiple image files
// @access  Private
router.post('/images', [
  authenticateToken,
  upload.array('images', 10)
], async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image files provided'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      url: file.path,
      publicId: file.filename,
      secureUrl: file.path,
      width: file.width,
      height: file.height,
      format: file.format,
      size: file.size,
      uploadedAt: new Date()
    }));

    res.json({
      success: true,
      message: `${uploadedFiles.length} images uploaded successfully`,
      data: {
        files: uploadedFiles,
        count: uploadedFiles.length
      }
    });
  } catch (error) {
    console.error('Images upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading images'
    });
  }
});

// @route   POST /api/upload/model3d
// @desc    Upload 3D model files
// @access  Private (Pro+)
router.post('/model3d', [
  authenticateToken,
  requireSubscription('pro'),
  upload.single('model')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No 3D model file provided'
      });
    }

    // Validate 3D model file
    const allowedFormats = ['gltf', 'glb', 'obj', 'fbx'];
    if (!allowedFormats.includes(req.file.format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 3D model format. Supported formats: GLTF, GLB, OBJ, FBX'
      });
    }

    res.json({
      success: true,
      message: '3D model uploaded successfully',
      data: {
        url: req.file.path,
        publicId: req.file.filename,
        secureUrl: req.file.path,
        format: req.file.format,
        size: req.file.size,
        uploadedAt: new Date()
      }
    });
  } catch (error) {
    console.error('3D model upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading 3D model'
    });
  }
});

// @route   POST /api/upload/avatar
// @desc    Upload user avatar
// @access  Private
router.post('/avatar', [
  authenticateToken,
  upload.single('avatar')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No avatar file provided'
      });
    }

    // Update user avatar in database
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user._id, {
      avatar: req.file.path
    });

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        url: req.file.path,
        publicId: req.file.filename,
        secureUrl: req.file.path,
        width: req.file.width,
        height: req.file.height,
        format: req.file.format,
        size: req.file.size,
        uploadedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading avatar'
    });
  }
});

// @route   POST /api/upload/design-thumbnail
// @desc    Upload design thumbnail
// @access  Private
router.post('/design-thumbnail', [
  authenticateToken,
  upload.single('thumbnail')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No thumbnail file provided'
      });
    }

    res.json({
      success: true,
      message: 'Design thumbnail uploaded successfully',
      data: {
        url: req.file.path,
        publicId: req.file.filename,
        secureUrl: req.file.path,
        width: req.file.width,
        height: req.file.height,
        format: req.file.format,
        size: req.file.size,
        uploadedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Design thumbnail upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading design thumbnail'
    });
  }
});

// @route   DELETE /api/upload/:publicId
// @desc    Delete uploaded file
// @access  Private
router.delete('/:publicId', [
  authenticateToken
], async (req, res) => {
  try {
    const { publicId } = req.params;

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === 'ok') {
      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting file'
    });
  }
});

// @route   GET /api/upload/transform
// @desc    Get transformed image URL
// @access  Public
router.get('/transform', async (req, res) => {
  try {
    const { publicId, width, height, crop, quality, format } = req.query;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }

    // Generate transformation URL
    const transformation = {
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
      crop: crop || 'limit',
      quality: quality || 'auto',
      format: format || 'auto'
    };

    const transformedUrl = cloudinary.url(publicId, transformation);

    res.json({
      success: true,
      data: {
        url: transformedUrl,
        publicId,
        transformation
      }
    });
  } catch (error) {
    console.error('Image transformation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while transforming image'
    });
  }
});

// @route   POST /api/upload/bulk-delete
// @desc    Delete multiple files
// @access  Private
router.post('/bulk-delete', [
  authenticateToken,
  require('express-validator').body('publicIds')
    .isArray()
    .withMessage('Public IDs must be an array')
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

    const { publicIds } = req.body;

    if (!publicIds || publicIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No public IDs provided'
      });
    }

    // Delete multiple files from Cloudinary
    const result = await cloudinary.api.delete_resources(publicIds);

    const deletedCount = Object.values(result.deleted).filter(status => status === 'deleted').length;

    res.json({
      success: true,
      message: `${deletedCount} files deleted successfully`,
      data: {
        deleted: result.deleted,
        deletedCount,
        totalRequested: publicIds.length
      }
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting files'
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 50MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 10 files per request.'
      });
    }
  }

  if (error.message === 'Invalid file type. Only images and 3D models are allowed.') {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error('Upload error:', error);
  res.status(500).json({
    success: false,
    message: 'Server error during file upload'
  });
});

module.exports = router;



