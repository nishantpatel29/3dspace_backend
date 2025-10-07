const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Template name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['living', 'bedroom', 'kitchen', 'bathroom', 'office', 'outdoor', 'commercial', 'studio', 'dining']
  },
  subcategory: {
    type: String,
    trim: true,
    maxlength: [50, 'Subcategory cannot exceed 50 characters']
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  estimatedTime: {
    type: Number, // in minutes
    default: 30
  },
  roomSize: {
    width: {
      type: Number,
      required: true,
      min: [0, 'Width must be positive']
    },
    height: {
      type: Number,
      required: true,
      min: [0, 'Height must be positive']
    },
    depth: {
      type: Number,
      required: true,
      min: [0, 'Depth must be positive']
    },
    unit: {
      type: String,
      enum: ['cm', 'm', 'in', 'ft'],
      default: 'm'
    }
  },
  design: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Design',
    required: true
  },
  thumbnail: {
    type: String,
    required: [true, 'Thumbnail is required']
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      trim: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  style: {
    type: String,
    enum: ['modern', 'traditional', 'contemporary', 'minimalist', 'industrial', 'scandinavian', 'bohemian', 'rustic', 'mid-century', 'art-deco'],
    required: true
  },
  colorScheme: {
    primary: {
      type: String,
      match: [/^#[0-9A-F]{6}$/i, 'Invalid hex color code']
    },
    secondary: {
      type: String,
      match: [/^#[0-9A-F]{6}$/i, 'Invalid hex color code']
    },
    accent: {
      type: String,
      match: [/^#[0-9A-F]{6}$/i, 'Invalid hex color code']
    }
  },
  furniture: [{
    furnitureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Furniture',
      required: true
    },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      z: { type: Number, required: true }
    },
    rotation: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 }
    },
    scale: {
      x: { type: Number, default: 1 },
      y: { type: Number, default: 1 },
      z: { type: Number, default: 1 }
    },
    color: {
      type: String,
      default: '#8B4513'
    }
  }],
  walls: [{
    id: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['wall', 'room'],
      required: true
    },
    color: {
      type: String,
      default: '#666666'
    },
    points: [{
      x: { type: Number, required: true },
      y: { type: Number, required: true }
    }],
    completed: {
      type: Boolean,
      default: true
    },
    thickness: {
      type: Number,
      default: 0.2
    },
    height: {
      type: Number,
      default: 3
    }
  }],
  windows: [{
    id: {
      type: String,
      required: true
    },
    wallId: {
      type: String,
      required: true
    },
    segmentIndex: {
      type: Number,
      required: true
    },
    t: {
      type: Number,
      required: true
    },
    width: {
      type: Number,
      default: 1.2
    },
    height: {
      type: Number,
      default: 1.2
    },
    sill: {
      type: Number,
      default: 0.9
    },
    color: {
      type: String,
      default: '#22d3ee'
    }
  }],
  metadata: {
    totalArea: {
      type: Number,
      required: true,
      min: [0, 'Total area must be positive']
    },
    totalCost: {
      type: Number,
      default: 0,
      min: [0, 'Total cost cannot be negative']
    },
    furnitureCount: {
      type: Number,
      default: 0,
      min: [0, 'Furniture count cannot be negative']
    },
    wallCount: {
      type: Number,
      default: 0,
      min: [0, 'Wall count cannot be negative']
    },
    windowCount: {
      type: Number,
      default: 0,
      min: [0, 'Window count cannot be negative']
    }
  },
  requirements: {
    subscription: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free'
    },
    features: [{
      type: String,
      enum: ['ai-tools', 'premium-templates', 'advanced-3d', 'team-collaboration', 'export-hd']
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  popularity: {
    type: Number,
    default: 0,
    min: [0, 'Popularity cannot be negative']
  },
  usageCount: {
    type: Number,
    default: 0,
    min: [0, 'Usage count cannot be negative']
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5']
    },
    count: {
      type: Number,
      default: 0,
      min: [0, 'Rating count cannot be negative']
    }
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  seo: {
    title: {
      type: String,
      trim: true,
      maxlength: [60, 'SEO title cannot exceed 60 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [160, 'SEO description cannot exceed 160 characters']
    },
    keywords: [{
      type: String,
      trim: true
    }]
  }
}, {
  timestamps: true
});

// Indexes for better query performance
templateSchema.index({ name: 'text', description: 'text' });
templateSchema.index({ category: 1, subcategory: 1 });
templateSchema.index({ style: 1 });
templateSchema.index({ difficulty: 1 });
templateSchema.index({ 'requirements.subscription': 1 });
templateSchema.index({ isActive: 1, isFeatured: 1, isPremium: 1 });
templateSchema.index({ popularity: -1 });
templateSchema.index({ usageCount: -1 });
templateSchema.index({ 'ratings.average': -1 });
templateSchema.index({ tags: 1 });
templateSchema.index({ createdAt: -1 });

// Virtual for primary image
templateSchema.virtual('primaryImage').get(function() {
  const primary = this.images.find(img => img.isPrimary);
  return primary ? primary.url : (this.images.length > 0 ? this.images[0].url : this.thumbnail);
});

// Virtual for formatted room size
templateSchema.virtual('formattedRoomSize').get(function() {
  const { width, height, depth, unit } = this.roomSize;
  return `${width} × ${height} × ${depth} ${unit}`;
});

// Virtual for estimated time formatted
templateSchema.virtual('formattedEstimatedTime').get(function() {
  const hours = Math.floor(this.estimatedTime / 60);
  const minutes = this.estimatedTime % 60;
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
});

// Method to increment usage count
templateSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.popularity += 1;
  return this.save();
};

// Method to update rating
templateSchema.methods.updateRating = function(newRating) {
  const totalRating = this.ratings.average * this.ratings.count + newRating;
  this.ratings.count += 1;
  this.ratings.average = totalRating / this.ratings.count;
  return this.save();
};

// Method to check if user can access template
templateSchema.methods.canAccess = function(userSubscription) {
  const subscriptionHierarchy = { free: 1, pro: 2, enterprise: 3 };
  return subscriptionHierarchy[userSubscription] >= subscriptionHierarchy[this.requirements.subscription];
};

// Method to get similar templates
templateSchema.methods.getSimilar = function(limit = 5) {
  return this.constructor.find({
    _id: { $ne: this._id },
    category: this.category,
    isActive: true
  })
  .sort({ popularity: -1 })
  .limit(limit);
};

// Static method to search templates
templateSchema.statics.search = function(query, filters = {}) {
  const searchQuery = {
    isActive: true,
    ...filters
  };

  if (query) {
    searchQuery.$text = { $search: query };
  }

  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, popularity: -1 });
};

// Static method to get templates by category
templateSchema.statics.getByCategory = function(category, limit = 20, skip = 0) {
  return this.find({
    category: category,
    isActive: true
  })
  .sort({ popularity: -1, createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

// Static method to get featured templates
templateSchema.statics.getFeatured = function(limit = 10) {
  return this.find({
    isActive: true,
    isFeatured: true
  })
  .sort({ popularity: -1, createdAt: -1 })
  .limit(limit);
};

// Static method to get templates by style
templateSchema.statics.getByStyle = function(style, limit = 20, skip = 0) {
  return this.find({
    style: style,
    isActive: true
  })
  .sort({ popularity: -1, createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

// Pre-save middleware to calculate metadata
templateSchema.pre('save', function(next) {
  // Calculate total cost
  this.metadata.totalCost = this.furniture.reduce((total, item) => {
    const furniture = item.furnitureId;
    return total + (furniture?.price || 0);
  }, 0);
  
  // Calculate furniture count
  this.metadata.furnitureCount = this.furniture.length;
  
  // Calculate wall count
  this.metadata.wallCount = this.walls.length;
  
  // Calculate window count
  this.metadata.windowCount = this.windows.length;
  
  next();
});

module.exports = mongoose.model('Template', templateSchema);



