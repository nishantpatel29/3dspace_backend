const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  z: { type: Number, required: true }
}, { _id: false });

const rotationSchema = new mongoose.Schema({
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  z: { type: Number, default: 0 }
}, { _id: false });

const scaleSchema = new mongoose.Schema({
  x: { type: Number, default: 1 },
  y: { type: Number, default: 1 },
  z: { type: Number, default: 1 }
}, { _id: false });

const furnitureItemSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Seating', 'Tables', 'Storage', 'Lighting', 'Bedroom', 'Decorative']
  },
  type: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: '#8B4513'
  },
  position: {
    type: positionSchema,
    required: true
  },
  rotation: {
    type: rotationSchema,
    default: { x: 0, y: 0, z: 0 }
  },
  scale: {
    type: scaleSchema,
    default: { x: 1, y: 1, z: 1 }
  },
  customProperties: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  }
}, { _id: false });

const wallPointSchema = new mongoose.Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true }
}, { _id: false });

const wallSchema = new mongoose.Schema({
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
  points: [wallPointSchema],
  completed: {
    type: Boolean,
    default: false
  },
  thickness: {
    type: Number,
    default: 0.2
  },
  height: {
    type: Number,
    default: 3
  }
}, { _id: false });

const windowSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'window'
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
}, { _id: false });

const layerSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  visible: {
    type: Boolean,
    default: true
  },
  active: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
}, { _id: false });

const designSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Design name is required'],
    trim: true,
    maxlength: [100, 'Design name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  version: {
    type: String,
    default: '1.0.0'
  },
  settings: {
    gridVisible: {
      type: Boolean,
      default: true
    },
    snapToGrid: {
      type: Boolean,
      default: true
    },
    showMeasurements: {
      type: Boolean,
      default: true
    },
    zoomLevel: {
      type: Number,
      default: 100
    },
    activeMode: {
      type: String,
      enum: ['2D', '3D'],
      default: '2D'
    }
  },
  elements: {
    walls: [wallSchema],
    windows: [windowSchema],
    rooms: [wallSchema]
  },
  furniture: [furnitureItemSchema],
  layers: [layerSchema],
  camera: {
    position: positionSchema,
    target: positionSchema,
    fov: {
      type: Number,
      default: 60
    }
  },
  environment: {
    lighting: {
      ambientIntensity: {
        type: Number,
        default: 0.2
      },
      directionalIntensity: {
        type: Number,
        default: 0.6
      },
      pointIntensity: {
        type: Number,
        default: 0.2
      }
    },
    background: {
      type: String,
      enum: ['city', 'studio', 'outdoor', 'custom'],
      default: 'city'
    },
    customBackground: {
      type: String,
      default: null
    }
  },
  metadata: {
    totalArea: {
      type: Number,
      default: 0
    },
    totalCost: {
      type: Number,
      default: 0
    },
    furnitureCount: {
      type: Number,
      default: 0
    },
    lastRendered: {
      type: Date,
      default: null
    }
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
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  thumbnail: {
    type: String,
    default: null
  },
  renderImages: [{
    type: String,
    default: []
  }],
  status: {
    type: String,
    enum: ['draft', 'in_progress', 'completed', 'archived'],
    default: 'draft'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
designSchema.index({ project: 1, createdAt: -1 });
designSchema.index({ isTemplate: 1, templateCategory: 1 });
designSchema.index({ isPublic: 1 });
designSchema.index({ tags: 1 });
designSchema.index({ status: 1 });
designSchema.index({ name: 'text', description: 'text' });

// Calculate metadata before saving
designSchema.pre('save', function(next) {
  // Calculate total cost
  this.metadata.totalCost = this.furniture.reduce((total, item) => total + (item.price || 0), 0);
  
  // Calculate furniture count
  this.metadata.furnitureCount = this.furniture.length;
  
  // Calculate total area (simplified calculation)
  let totalArea = 0;
  this.elements.rooms.forEach(room => {
    if (room.points.length >= 3) {
      // Simple polygon area calculation
      let area = 0;
      for (let i = 0; i < room.points.length; i++) {
        const j = (i + 1) % room.points.length;
        area += room.points[i].x * room.points[j].y;
        area -= room.points[j].x * room.points[i].y;
      }
      totalArea += Math.abs(area) / 2;
    }
  });
  this.metadata.totalArea = totalArea;
  
  next();
});

// Method to add furniture
designSchema.methods.addFurniture = function(furnitureData) {
  const furniture = {
    id: furnitureData.id || `furniture-${Date.now()}`,
    name: furnitureData.name,
    category: furnitureData.category,
    type: furnitureData.type,
    price: furnitureData.price || 0,
    color: furnitureData.color || '#8B4513',
    position: furnitureData.position || { x: 0, y: 0, z: 0 },
    rotation: furnitureData.rotation || { x: 0, y: 0, z: 0 },
    scale: furnitureData.scale || { x: 1, y: 1, z: 1 },
    customProperties: furnitureData.customProperties || new Map()
  };
  
  this.furniture.push(furniture);
  return this.save();
};

// Method to update furniture
designSchema.methods.updateFurniture = function(furnitureId, updateData) {
  const furniture = this.furniture.id(furnitureId);
  if (furniture) {
    Object.assign(furniture, updateData);
    return this.save();
  }
  throw new Error('Furniture not found');
};

// Method to remove furniture
designSchema.methods.removeFurniture = function(furnitureId) {
  this.furniture = this.furniture.filter(f => f.id !== furnitureId);
  return this.save();
};

// Method to add wall
designSchema.methods.addWall = function(wallData) {
  const wall = {
    id: wallData.id || `wall-${Date.now()}`,
    type: wallData.type || 'wall',
    color: wallData.color || '#666666',
    points: wallData.points || [],
    completed: wallData.completed || false,
    thickness: wallData.thickness || 0.2,
    height: wallData.height || 3
  };
  
  this.elements.walls.push(wall);
  return this.save();
};

// Method to export design data
designSchema.methods.exportData = function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    version: this.version,
    settings: this.settings,
    elements: this.elements,
    furniture: this.furniture,
    layers: this.layers,
    camera: this.camera,
    environment: this.environment,
    metadata: this.metadata,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('Design', designSchema);


