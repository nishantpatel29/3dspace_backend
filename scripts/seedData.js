const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Furniture = require('../models/Furniture');
const Template = require('../models/Template');

// Sample furniture data
const sampleFurniture = [
  {
    name: 'Modern Sofa',
    description: 'Comfortable 3-seater sofa with clean lines and modern design',
    category: 'Seating',
    subcategory: 'Sofas',
    type: 'Modern Sofa',
    brand: 'DesignSpace',
    price: 1299,
    dimensions: { width: 250, height: 85, depth: 90, unit: 'cm' },
    weight: { value: 45, unit: 'kg' },
    materials: ['Fabric', 'Wood', 'Foam'],
    colors: [
      { name: 'Charcoal', hex: '#36454F', isDefault: true },
      { name: 'Navy', hex: '#1E3A8A', isDefault: false },
      { name: 'Cream', hex: '#F5F5DC', isDefault: false }
    ],
    features: ['Removable covers', 'Storage compartment', 'Easy assembly'],
    tags: ['modern', 'comfortable', 'living room'],
    availability: { inStock: true, quantity: 15 },
    pricing: { retail: 1299, wholesale: 999 },
    isActive: true,
    isFeatured: true
  },
  {
    name: 'Coffee Table',
    description: 'Sleek coffee table with glass top and wooden legs',
    category: 'Tables',
    subcategory: 'Coffee Tables',
    type: 'Coffee Table',
    brand: 'DesignSpace',
    price: 599,
    dimensions: { width: 120, height: 45, depth: 60, unit: 'cm' },
    weight: { value: 25, unit: 'kg' },
    materials: ['Glass', 'Oak Wood'],
    colors: [
      { name: 'Natural Oak', hex: '#D2B48C', isDefault: true },
      { name: 'Dark Walnut', hex: '#8B4513', isDefault: false }
    ],
    features: ['Tempered glass top', 'Sturdy construction', 'Easy to clean'],
    tags: ['modern', 'coffee table', 'living room'],
    availability: { inStock: true, quantity: 8 },
    pricing: { retail: 599, wholesale: 449 },
    isActive: true,
    isFeatured: false
  },
  {
    name: 'Floor Lamp',
    description: 'Adjustable floor lamp with LED lighting',
    category: 'Lighting',
    subcategory: 'Floor Lamps',
    type: 'Floor Lamp',
    brand: 'DesignSpace',
    price: 299,
    dimensions: { width: 30, height: 160, depth: 30, unit: 'cm' },
    weight: { value: 8, unit: 'kg' },
    materials: ['Metal', 'LED'],
    colors: [
      { name: 'Black', hex: '#000000', isDefault: true },
      { name: 'White', hex: '#FFFFFF', isDefault: false },
      { name: 'Brass', hex: '#B87333', isDefault: false }
    ],
    features: ['Adjustable height', 'LED bulbs included', 'Touch control'],
    tags: ['lighting', 'modern', 'adjustable'],
    availability: { inStock: true, quantity: 20 },
    pricing: { retail: 299, wholesale: 199 },
    isActive: true,
    isFeatured: true
  },
  {
    name: 'Bookshelf',
    description: '5-tier bookshelf with adjustable shelves',
    category: 'Storage',
    subcategory: 'Bookshelves',
    type: 'Bookshelf',
    brand: 'DesignSpace',
    price: 799,
    dimensions: { width: 80, height: 180, depth: 30, unit: 'cm' },
    weight: { value: 35, unit: 'kg' },
    materials: ['Pine Wood', 'Metal'],
    colors: [
      { name: 'White', hex: '#FFFFFF', isDefault: true },
      { name: 'Oak', hex: '#D2B48C', isDefault: false },
      { name: 'Black', hex: '#000000', isDefault: false }
    ],
    features: ['Adjustable shelves', 'Easy assembly', 'Sturdy construction'],
    tags: ['storage', 'bookshelf', 'office'],
    availability: { inStock: true, quantity: 12 },
    pricing: { retail: 799, wholesale: 599 },
    isActive: true,
    isFeatured: false
  },
  {
    name: 'Dining Chair',
    description: 'Comfortable dining chair with upholstered seat',
    category: 'Seating',
    subcategory: 'Dining Chairs',
    type: 'Dining Chair',
    brand: 'DesignSpace',
    price: 199,
    dimensions: { width: 45, height: 95, depth: 50, unit: 'cm' },
    weight: { value: 12, unit: 'kg' },
    materials: ['Wood', 'Fabric', 'Foam'],
    colors: [
      { name: 'Beige', hex: '#F5F5DC', isDefault: true },
      { name: 'Navy', hex: '#1E3A8A', isDefault: false },
      { name: 'Gray', hex: '#808080', isDefault: false }
    ],
    features: ['Upholstered seat', 'Sturdy legs', 'Stackable'],
    tags: ['dining', 'chair', 'comfortable'],
    availability: { inStock: true, quantity: 25 },
    pricing: { retail: 199, wholesale: 149 },
    isActive: true,
    isFeatured: false
  },
  {
    name: 'Bed Frame',
    description: 'Platform bed frame with headboard and storage',
    category: 'Bedroom',
    subcategory: 'Bed Frames',
    type: 'Bed Frame',
    brand: 'DesignSpace',
    price: 899,
    dimensions: { width: 200, height: 30, depth: 300, unit: 'cm' },
    weight: { value: 60, unit: 'kg' },
    materials: ['Wood', 'Metal'],
    colors: [
      { name: 'Natural Oak', hex: '#D2B48C', isDefault: true },
      { name: 'Dark Walnut', hex: '#8B4513', isDefault: false },
      { name: 'White', hex: '#FFFFFF', isDefault: false }
    ],
    features: ['Storage drawers', 'Headboard included', 'Easy assembly'],
    tags: ['bedroom', 'bed frame', 'storage'],
    availability: { inStock: true, quantity: 6 },
    pricing: { retail: 899, wholesale: 699 },
    isActive: true,
    isFeatured: true
  }
];

// Sample template data
const sampleTemplates = [
  {
    name: 'Modern Living Room',
    description: 'Contemporary living room with clean lines and modern furniture',
    category: 'living',
    subcategory: 'modern',
    difficulty: 'beginner',
    estimatedTime: 30,
    roomSize: { width: 5, height: 3, depth: 4, unit: 'm' },
    style: 'modern',
    colorScheme: {
      primary: '#3B82F6',
      secondary: '#10B981',
      accent: '#F59E0B'
    },
    walls: [
      {
        id: 'wall-1',
        type: 'wall',
        color: '#F3F4F6',
        points: [{ x: -2.5, y: -2 }, { x: 2.5, y: -2 }],
        completed: true,
        thickness: 0.2,
        height: 3
      },
      {
        id: 'wall-2',
        type: 'wall',
        color: '#F3F4F6',
        points: [{ x: 2.5, y: -2 }, { x: 2.5, y: 2 }],
        completed: true,
        thickness: 0.2,
        height: 3
      },
      {
        id: 'wall-3',
        type: 'wall',
        color: '#F3F4F6',
        points: [{ x: 2.5, y: 2 }, { x: -2.5, y: 2 }],
        completed: true,
        thickness: 0.2,
        height: 3
      },
      {
        id: 'wall-4',
        type: 'wall',
        color: '#F3F4F6',
        points: [{ x: -2.5, y: 2 }, { x: -2.5, y: -2 }],
        completed: true,
        thickness: 0.2,
        height: 3
      }
    ],
    windows: [
      {
        id: 'window-1',
        wallId: 'wall-1',
        segmentIndex: 0,
        t: 0.5,
        width: 1.5,
        height: 1.2,
        sill: 0.9,
        color: '#22d3ee'
      }
    ],
    furniture: [
      {
        furnitureId: null, // Will be set after furniture is created
        position: { x: 0, y: 0, z: 1.5 },
        rotation: { x: 0, y: Math.PI, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '#36454F'
      }
    ],
    metadata: {
      totalArea: 20,
      totalCost: 1898,
      furnitureCount: 1,
      wallCount: 4,
      windowCount: 1
    },
    requirements: {
      subscription: 'free',
      features: []
    },
    isActive: true,
    isFeatured: true,
    isPremium: false
  },
  {
    name: 'Cozy Bedroom',
    description: 'Warm and inviting bedroom with comfortable furniture',
    category: 'bedroom',
    subcategory: 'master',
    difficulty: 'beginner',
    estimatedTime: 25,
    roomSize: { width: 4, height: 3, depth: 3, unit: 'm' },
    style: 'traditional',
    colorScheme: {
      primary: '#8B5CF6',
      secondary: '#06B6D4',
      accent: '#F97316'
    },
    walls: [
      {
        id: 'wall-1',
        type: 'wall',
        color: '#F8FAFC',
        points: [{ x: -2, y: -1.5 }, { x: 2, y: -1.5 }],
        completed: true,
        thickness: 0.2,
        height: 3
      },
      {
        id: 'wall-2',
        type: 'wall',
        color: '#F8FAFC',
        points: [{ x: 2, y: -1.5 }, { x: 2, y: 1.5 }],
        completed: true,
        thickness: 0.2,
        height: 3
      },
      {
        id: 'wall-3',
        type: 'wall',
        color: '#F8FAFC',
        points: [{ x: 2, y: 1.5 }, { x: -2, y: 1.5 }],
        completed: true,
        thickness: 0.2,
        height: 3
      },
      {
        id: 'wall-4',
        type: 'wall',
        color: '#F8FAFC',
        points: [{ x: -2, y: 1.5 }, { x: -2, y: -1.5 }],
        completed: true,
        thickness: 0.2,
        height: 3
      }
    ],
    windows: [
      {
        id: 'window-1',
        wallId: 'wall-1',
        segmentIndex: 0,
        t: 0.5,
        width: 1.2,
        height: 1.2,
        sill: 0.9,
        color: '#22d3ee'
      }
    ],
    furniture: [
      {
        furnitureId: null, // Will be set after furniture is created
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '#D2B48C'
      }
    ],
    metadata: {
      totalArea: 12,
      totalCost: 899,
      furnitureCount: 1,
      wallCount: 4,
      windowCount: 1
    },
    requirements: {
      subscription: 'free',
      features: []
    },
    isActive: true,
    isFeatured: true,
    isPremium: false
  }
];

// Sample user data
const sampleUsers = [
  {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: 'password123',
    subscription: {
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    isEmailVerified: true
  },
  {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    password: 'password123',
    subscription: {
      plan: 'free',
      status: 'active'
    },
    isEmailVerified: true
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/designspace3d', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Furniture.deleteMany({});
    await Template.deleteMany({});

    console.log('Cleared existing data');

    // Create sample users
    const users = [];
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      users.push(user);
      console.log(`Created user: ${user.email}`);
    }

    // Create sample furniture
    const furniture = [];
    for (const furnitureData of sampleFurniture) {
      const furnitureItem = new Furniture(furnitureData);
      await furnitureItem.save();
      furniture.push(furnitureItem);
      console.log(`Created furniture: ${furnitureItem.name}`);
    }

    // Create sample templates
    for (const templateData of sampleTemplates) {
      // Update furniture references
      if (templateData.furniture && templateData.furniture.length > 0) {
        templateData.furniture[0].furnitureId = furniture[0]._id; // Use first furniture item
      }

      const template = new Template(templateData);
      await template.save();
      console.log(`Created template: ${template.name}`);
    }

    console.log('Database seeded successfully!');
    console.log(`Created ${users.length} users`);
    console.log(`Created ${furniture.length} furniture items`);
    console.log(`Created ${sampleTemplates.length} templates`);

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the seeder
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };



