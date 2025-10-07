 const express = require('express');
 const router = express.Router();
 const { body, validationResult } = require('express-validator');
 const { authenticateToken } = require('../middleware/auth');
 const DesignFile = require('../models/DesignFile');

 // List files for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('req.user', req.user);
    const userId = (req.user && (req.user._id || req.user.id))?.toString();
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const files = await DesignFile.find({ user: userId }).sort({ updatedAt: -1 });
    res.json({ success: true, data: files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

 // Get single file
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req.user && (req.user._id || req.user.id))?.toString();
    const file = await DesignFile.findById(req.params.id);
    if (!file || file.user.toString() !== userId) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    res.json({ success: true, data: file });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

 // Create new file
 router.post(
   '/',
   authenticateToken,
   [
     body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required and must be under 100 chars'),
     body('description').optional().isLength({ max: 300 }).withMessage('Description must be under 300 chars'),
     body('sceneData').notEmpty().withMessage('sceneData is required'),
   ],
  async (req, res) => {
     const errors = validationResult(req);
     if (!errors.isEmpty()) {
       return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
     }
     try {
      const userId = (req.user && (req.user._id || req.user.id))?.toString();
       const file = new DesignFile({
        user: userId,
         name: req.body.name,
         description: req.body.description,
         sceneData: req.body.sceneData,
       });
       await file.save();
       res.status(201).json({ success: true, data: file, message: 'Saved successfully' });
     } catch (err) {
       console.error(err);
       res.status(500).json({ success: false, message: 'Server error' });
     }
   }
 );

 // Update existing file
 router.put(
   '/:id',
   authenticateToken,
   [
     body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be under 100 chars'),
     body('description').optional().isLength({ max: 300 }).withMessage('Description must be under 300 chars'),
     body('sceneData').optional(),
   ],
  async (req, res) => {
     const errors = validationResult(req);
     if (!errors.isEmpty()) {
       return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
     }
     try {
      const userId = (req.user && (req.user._id || req.user.id))?.toString();
       const file = await DesignFile.findById(req.params.id);
      if (!file || file.user.toString() !== userId) {
         return res.status(404).json({ success: false, message: 'File not found' });
       }
       if (req.body.name !== undefined) file.name = req.body.name;
       if (req.body.description !== undefined) file.description = req.body.description;
       if (req.body.sceneData !== undefined) file.sceneData = req.body.sceneData;
       await file.save();
       res.json({ success: true, data: file, message: 'Updated successfully' });
     } catch (err) {
       console.error(err);
       res.status(500).json({ success: false, message: 'Server error' });
     }
   }
 );

// Delete a file
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = (req.user && (req.user._id || req.user.id))?.toString();
    const file = await DesignFile.findById(req.params.id);
    if (!file || file.user.toString() !== userId) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    await DesignFile.deleteOne({ _id: file._id });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

 module.exports = router;


