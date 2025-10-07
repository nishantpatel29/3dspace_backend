const mongoose = require('mongoose');

const furnitureSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Furniture name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Seating', 'Tables', 'Storage', 'Lighting', 'Bedroom', 'Decorative', 'Kitchen', 'Bathroom', 'Outdoor']
  },
  subcategory: {
    type: String,
    trim: true,
    maxlength: [50, 'Subcategory cannot exceed 50 characters']
  },
  type: {
    type: String,
    required: [true, 'Type is required'],
    trim: true
  },
  brand: {
    type: String,
    trim: true,
    maxlength: [50, 'Brand cannot exceed 50 characters']
  },
  model: {
    type: String,
    trim: true,
    maxlength: [50, 'Model cannot exceed 50 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
  },
  dimensions: {
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
      default: 'cm'
    }
  },
  weight: {
    value: {
      type: Number,
      min: [0, 'Weight must be positive']
    },
    unit: {
      type: String,
      enum: ['kg', 'lb'],
      default: 'kg'
    }
  },
  materials: [{
    type: String,
    trim: true,
    maxlength: [50, 'Material name cannot exceed 50 characters']
  }],
  colors: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    hex: {
      type: String,
      required: true,
      match: [/^#[0-9A-F]{6}$/i, 'Invalid hex color code']
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
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
  model3D: {
    url: {
      type: String,
      default: null
    },
    format: {
      type: String,
      enum: ['gltf', 'glb', 'obj', 'fbx'],
      default: 'gltf'
    },
    fileSize: {
      type: Number,
      default: null
    }
  },
  specifications: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  features: [{
    type: String,
    trim: true,
    maxlength: [100, 'Feature cannot exceed 100 characters']
  }],
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  availability: {
    inStock: {
      type: Boolean,
      default: true
    },
    quantity: {
      type: Number,
      default: null
    },
    leadTime: {
      type: Number,
      default: null // in days
    }
  },
  pricing: {
    retail: {
      type: Number,
      required: true
    },
    wholesale: {
      type: Number,
      default: null
    },
    sale: {
      type: Number,
      default: null
    },
    saleStart: {
      type: Date,
      default: null
    },
    saleEnd: {
      type: Date,
      default: null
    }
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
furnitureSchema.index({ name: 'text', description: 'text', brand: 'text' });
furnitureSchema.index({ category: 1, subcategory: 1 });
furnitureSchema.index({ price: 1 });
furnitureSchema.index({ 'ratings.average': -1 });
furnitureSchema.index({ popularity: -1 });
furnitureSchema.index({ isActive: 1, isFeatured: 1 });
furnitureSchema.index({ tags: 1 });
furnitureSchema.index({ 'availability.inStock': 1 });
furnitureSchema.index({ createdAt: -1 });

// Virtual for current price
furnitureSchema.virtual('currentPrice').get(function() {
  const now = new Date();
  if (this.pricing.sale && this.pricing.saleStart <= now && this.pricing.saleEnd >= now) {
    return this.pricing.sale;
  }
  return this.pricing.retail;
});

// Virtual for discount percentage
furnitureSchema.virtual('discountPercentage').get(function() {
  const now = new Date();
  if (this.pricing.sale && this.pricing.saleStart <= now && this.pricing.saleEnd >= now) {
    return Math.round(((this.pricing.retail - this.pricing.sale) / this.pricing.retail) * 100);
  }
  return 0;
});

// Virtual for primary image
furnitureSchema.virtual('primaryImage').get(function() {
  const primary = this.images.find(img => img.isPrimary);
  return primary ? primary.url : (this.images.length > 0 ? this.images[0].url : null);
});

// Virtual for default color
furnitureSchema.virtual('defaultColor').get(function() {
  const defaultColor = this.colors.find(color => color.isDefault);
  return defaultColor ? defaultColor.hex : (this.colors.length > 0 ? this.colors[0].hex : '#8B4513');
});

// Method to update rating
furnitureSchema.methods.updateRating = function(newRating) {
  const totalRating = this.ratings.average * this.ratings.count + newRating;
  this.ratings.count += 1;
  this.ratings.average = totalRating / this.ratings.count;
  return this.save();
};

// Method to increment popularity
furnitureSchema.methods.incrementPopularity = function() {
  this.popularity += 1;
  return this.save();
};

// Method to check availability
furnitureSchema.methods.isAvailable = function() {
  return this.isActive && this.availability.inStock && 
         (this.availability.quantity === null || this.availability.quantity > 0);
};

// Method to get formatted dimensions
furnitureSchema.methods.getFormattedDimensions = function() {
  const { width, height, depth, unit } = this.dimensions;
  return `${width} × ${height} × ${depth} ${unit}`;
};

// Method to search furniture
furnitureSchema.statics.search = function(query, filters = {}) {
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

// Method to get similar furniture
furnitureSchema.methods.getSimilar = function(limit = 5) {
  return this.constructor.find({
    _id: { $ne: this._id },
    category: this.category,
    isActive: true
  })
  .sort({ popularity: -1 })
  .limit(limit);
};

// Method to get furniture by category
furnitureSchema.statics.getByCategory = function(category, limit = 20, skip = 0) {
  return this.find({
    category: category,
    isActive: true
  })
  .sort({ popularity: -1, createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

// Method to get featured furniture
furnitureSchema.statics.getFeatured = function(limit = 10) {
  return this.find({
    isActive: true,
    isFeatured: true
  })
  .sort({ popularity: -1, createdAt: -1 })
  .limit(limit);
};

module.exports = mongoose.model('Furniture', furnitureSchema);



