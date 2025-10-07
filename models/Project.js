const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['viewer', 'editor', 'admin'],
      default: 'viewer'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  settings: {
    units: {
      type: String,
      enum: ['metric', 'imperial'],
      default: 'metric'
    },
    gridSize: {
      type: Number,
      default: 0.5
    },
    snapToGrid: {
      type: Boolean,
      default: true
    },
    showMeasurements: {
      type: Boolean,
      default: true
    }
  },
  thumbnail: {
    type: String,
    default: null
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  isTemplate: {
    type: Boolean,
    default: false
  },
  templateCategory: {
    type: String,
    enum: ['living', 'bedroom', 'kitchen', 'bathroom', 'office', 'outdoor', 'commercial'],
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'in_progress', 'completed', 'archived'],
    default: 'draft'
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Indexes for better query performance
projectSchema.index({ owner: 1, createdAt: -1 });
projectSchema.index({ 'collaborators.user': 1 });
projectSchema.index({ isPublic: 1, isTemplate: 1 });
projectSchema.index({ tags: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ name: 'text', description: 'text' });

// Update lastModified on save
projectSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastModified = new Date();
    this.version += 1;
  }
  next();
});

// Virtual for project URL
projectSchema.virtual('url').get(function() {
  return `/projects/${this._id}`;
});

// Method to check if user has access
projectSchema.methods.hasAccess = function(userId, requiredRole = 'viewer') {
  // Owner always has access
  if (this.owner.toString() === userId.toString()) {
    return true;
  }
  
  // Check collaborators
  const collaborator = this.collaborators.find(c => c.user.toString() === userId.toString());
  if (!collaborator) return false;
  
  const roleHierarchy = { viewer: 1, editor: 2, admin: 3 };
  return roleHierarchy[collaborator.role] >= roleHierarchy[requiredRole];
};

// Method to add collaborator
projectSchema.methods.addCollaborator = function(userId, role = 'viewer') {
  const existingCollaborator = this.collaborators.find(c => c.user.toString() === userId.toString());
  if (existingCollaborator) {
    existingCollaborator.role = role;
  } else {
    this.collaborators.push({ user: userId, role });
  }
  return this.save();
};

// Method to remove collaborator
projectSchema.methods.removeCollaborator = function(userId) {
  this.collaborators = this.collaborators.filter(c => c.user.toString() !== userId.toString());
  return this.save();
};

module.exports = mongoose.model('Project', projectSchema);



