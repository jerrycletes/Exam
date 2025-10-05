const express = require('express');
const router = express.Router();
const blogCtrl = require('../controllers/blogController');
const { authenticate, requireAuth } = require('../middlewares/auth');
const requireOwner = require('../middlewares/owner');

// apply authenticate to all blog routes to optionally set req.user
router.use(authenticate);

// Public route - list published (or drafts owned by user if state=draft)
router.get('/', blogCtrl.list);

// Get single blog (increments read_count)
router.get('/:id', blogCtrl.getOne);

// create blog - must be logged in
router.post('/', requireAuth, blogCtrl.create);

// owner actions
router.get('/me', requireAuth, blogCtrl.myBlogs);

// For actions on specific blog where the user must be owner
router.put('/:id', requireAuth, requireOwner, blogCtrl.update);
router.delete('/:id', requireAuth, requireOwner, blogCtrl.delete);

module.exports = router;
