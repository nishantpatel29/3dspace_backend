const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/subscriptions/plans
// @desc    Get available subscription plans
// @access  Public
router.get('/plans', async (req, res) => {
  try {
    const plans = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'USD',
        interval: 'month',
        features: [
          '2D Floor Plans',
          'Basic 3D Visualization',
          '5 Projects',
          'Standard Templates',
          'Basic Furniture Library',
          'Community Support'
        ],
        limits: {
          projects: 5,
          designs: 10,
          aiTools: 0,
          storage: '100MB',
          collaborators: 1
        }
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 19,
        currency: 'USD',
        interval: 'month',
        features: [
          'Everything in Free',
          'Advanced 3D Visualization',
          'Unlimited Projects',
          'All Templates',
          'Premium Furniture Library',
          'AI Design Tools',
          '4K HD Renders',
          'Priority Support',
          'Export Options'
        ],
        limits: {
          projects: -1, // unlimited
          designs: -1,
          aiTools: 100,
          storage: '10GB',
          collaborators: 5
        },
        popular: true
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 49,
        currency: 'USD',
        interval: 'month',
        features: [
          'Everything in Pro',
          'Team Collaboration',
          'Advanced Analytics',
          'Custom Branding',
          'API Access',
          '8K HD Renders',
          '24/7 Priority Support',
          'Custom Integrations'
        ],
        limits: {
          projects: -1,
          designs: -1,
          aiTools: -1,
          storage: '100GB',
          collaborators: -1
        }
      }
    ];

    res.json({
      success: true,
      data: { plans }
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching plans'
    });
  }
});

// @route   GET /api/subscriptions/current
// @desc    Get current user subscription
// @access  Private
router.get('/current', [
  authenticateToken
], async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      data: {
        subscription: user.subscription,
        usage: await getUserUsage(req.user._id)
      }
    });
  } catch (error) {
    console.error('Get current subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription'
    });
  }
});

// @route   POST /api/subscriptions/upgrade
// @desc    Upgrade user subscription
// @access  Private
router.post('/upgrade', [
  authenticateToken,
  body('planId')
    .isIn(['pro', 'enterprise'])
    .withMessage('Invalid plan ID'),
  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required')
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

    const { planId, paymentMethodId } = req.body;
    const user = await User.findById(req.user._id);

    // Check if user is already on this plan or higher
    const planHierarchy = { free: 1, pro: 2, enterprise: 3 };
    if (planHierarchy[user.subscription.plan] >= planHierarchy[planId]) {
      return res.status(400).json({
        success: false,
        message: 'You are already on this plan or higher'
      });
    }

    // In production, this would integrate with Stripe
    const subscription = await createStripeSubscription({
      customerId: user.subscription.stripeCustomerId || await createStripeCustomer(user),
      planId,
      paymentMethodId
    });

    // Update user subscription
    user.subscription = {
      plan: planId,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      stripeCustomerId: user.subscription.stripeCustomerId,
      stripeSubscriptionId: subscription.id
    };

    await user.save();

    res.json({
      success: true,
      message: 'Subscription upgraded successfully',
      data: {
        subscription: user.subscription
      }
    });
  } catch (error) {
    console.error('Upgrade subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while upgrading subscription'
    });
  }
});

// @route   POST /api/subscriptions/cancel
// @desc    Cancel user subscription
// @access  Private
router.post('/cancel', [
  authenticateToken
], async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.subscription.plan === 'free') {
      return res.status(400).json({
        success: false,
        message: 'No active subscription to cancel'
      });
    }

    // In production, this would cancel the Stripe subscription
    if (user.subscription.stripeSubscriptionId) {
      await cancelStripeSubscription(user.subscription.stripeSubscriptionId);
    }

    // Update user subscription
    user.subscription = {
      plan: 'free',
      status: 'cancelled',
      currentPeriodEnd: user.subscription.currentPeriodEnd,
      stripeCustomerId: user.subscription.stripeCustomerId,
      stripeSubscriptionId: null
    };

    await user.save();

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: {
        subscription: user.subscription
      }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling subscription'
    });
  }
});

// @route   GET /api/subscriptions/usage
// @desc    Get user usage statistics
// @access  Private
router.get('/usage', [
  authenticateToken
], async (req, res) => {
  try {
    const usage = await getUserUsage(req.user._id);
    
    res.json({
      success: true,
      data: { usage }
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching usage'
    });
  }
});

// @route   POST /api/subscriptions/webhook
// @desc    Handle Stripe webhooks
// @access  Public
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // In production, verify the webhook signature
    // const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

    // For now, just acknowledge the webhook
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      message: 'Webhook error'
    });
  }
});

// Helper functions
async function getUserUsage(userId) {
  const Project = require('../models/Project');
  const Design = require('../models/Design');

  const [projectCount, designCount] = await Promise.all([
    Project.countDocuments({ owner: userId }),
    Design.countDocuments({ project: { $in: await Project.find({ owner: userId }).select('_id') } })
  ]);

  return {
    projects: {
      used: projectCount,
      limit: -1 // Will be set based on subscription
    },
    designs: {
      used: designCount,
      limit: -1
    },
    storage: {
      used: '2.5GB', // Mock data
      limit: '10GB'
    },
    aiTools: {
      used: 15, // Mock data
      limit: 100
    }
  };
}

async function createStripeCustomer(user) {
  // Mock Stripe customer creation
  return `cus_${Date.now()}`;
}

async function createStripeSubscription({ customerId, planId, paymentMethodId }) {
  // Mock Stripe subscription creation
  return {
    id: `sub_${Date.now()}`,
    status: 'active',
    current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
  };
}

async function cancelStripeSubscription(subscriptionId) {
  // Mock Stripe subscription cancellation
  console.log(`Cancelling subscription: ${subscriptionId}`);
}

module.exports = router;



