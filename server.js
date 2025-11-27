const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Validate required environment variables
const requiredEnvVars = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'MONGODB_URI'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\n⚠️  Please add these to your .env file');
  process.exit(1);
}

console.log('✅ All required environment variables are set');

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration - MUST be before body parser
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://designspace3d.netlify.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || process.env.FRONTEND_URL === origin) {
      callback(null, true);
    } else {
      // In development, allow localhost with any port
      if (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));

// Body parsing middleware - MUST be before loggers that read body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware - AFTER body parser
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); // Colored, concise output
}

// Custom detailed request logger
app.use((req, res, next) => {
  console.log('\n' + '='.repeat(50));
  console.log(`🔵 ${req.method} ${req.url}`);
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  console.log(`📍 IP: ${req.ip}`);
  try {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    }
  } catch (_) {}
  try {
    if (req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0) {
      console.log('🔍 Query:', req.query);
    }
  } catch (_) {}
  console.log('='.repeat(50));
  next();
});

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log(`📊 Database: ${mongoose.connection.name}`);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/furniture', require('./routes/furniture'));
app.use('/api/ai-tools', require('./routes/ai-tools'));
app.use('/api/design-files', require('./routes/design-files'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('\n❌ ERROR OCCURRED:');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  
  const errorResponse = {
    success: false,
    message: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Something went wrong!',
  };
  
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  res.status(err.status || 500).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
  console.log(`⚠️  404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM signal received: closing HTTP server');
  mongoose.connection.close(false, () => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT signal received: closing HTTP server');
  mongoose.connection.close(false, () => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log('\n' + '🚀'.repeat(25));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`📡 Ready to accept requests...`);
  console.log('🚀'.repeat(25) + '\n');
});

module.exports = app;