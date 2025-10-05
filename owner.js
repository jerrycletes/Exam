const Blog = require('../models/Blog');

async function requireOwner(req, res, next) {
  const blogId = req.params.id;
  const blog = await Blog.findById(blogId);
  if (!blog) return res.status(404).json({ message: 'Blog not found' });
  if (String(blog.author) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Forbidden: not the owner' });
  }
  req.blog = blog;
  next();
}

module.exports = requireOwner;
