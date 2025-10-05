const Blog = require('../models/Blog');
const User = require('../models/User');
const calculateReadingTime = require('../utils/readingTime');

/**
 * Public listing endpoint: returns published blogs (unless logged in and request filter allows)
 * Supports:
 *  - pagination: page, limit (default limit=20)
 *  - filter by state (draft/published) [if state provided and user is owner or authenticated?]
 *  - search by author (name or id), title, tags
 *  - ordering: order_by (read_count, reading_time, createdAt), order (asc/desc)
 */
exports.list = async (req, res) => {
  try {
    const { page = 1, limit = 20, state, search, author, title, tags, order_by = 'createdAt', order = 'desc' } = req.query;
    const q = {};

    // default only published for public callers
    if (!state) {
      q.state = 'published';
    } else {
      // if state provided, only allow 'draft' results for owner of the blogs or authenticated? We'll allow an authenticated user to query drafts but only if they are the owner:
      if (state === 'draft') {
        // only owner drafts -> we'll filter by author = current user id, if not logged in respond empty
        if (!req.user) return res.json({ items: [], page: +page, limit: +limit, total: 0 });
        q.state = 'draft';
        q.author = req.user._id;
      } else {
        q.state = 'published';
      }
    }

    // search by title
    if (title) q.title = { $regex: title, $options: 'i' };

    // search by tags (comma separated)
    if (tags) {
      const tagsArr = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagsArr.length) q.tags = { $in: tagsArr };
    }

    // search by author: could be name or id or email
    if (author) {
      // try to find user(s) by name or email
      const regex = new RegExp(author, 'i');
      const users = await User.find({
        $or: [
          { first_name: regex },
          { last_name: regex },
          { email: regex },
          { _id: author } // if id passed
        ]
      }).select('_id');
      const ids = users.map(u => u._id);
      if (ids.length) q.author = { $in: ids };
      else q.author = null; // no results
    }

    // generic search: title, tags, body
    if (search) {
      const rx = new RegExp(search, 'i');
      q.$or = [
        { title: rx },
        { description: rx },
        { body: rx },
        { tags: { $in: [search] } }
      ];
    }

    // build sort
    const allowedSort = {
      read_count: 'read_count',
      reading_time: 'reading_time',
      timestamp: 'createdAt',
      createdAt: 'createdAt'
    };
    const sortField = allowedSort[order_by] || 'createdAt';
    const sortOrder = order === 'asc' ? 1 : -1;

    // count total
    const total = await Blog.countDocuments(q);
    const items = await Blog.find(q)
      .populate('author', 'first_name last_name email')
      .sort({ [sortField]: sortOrder })
      .skip((+page - 1) * +limit)
      .limit(+limit)
      .lean();

    res.json({
      items,
      page: +page,
      limit: +limit,
      total
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, description, tags = [], body } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'Title and body required' });
    const reading_time = calculateReadingTime(body);
    const blog = new Blog({
      title,
      description,
      author: req.user._id,
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t=>t.trim()) : []),
      body,
      reading_time,
      state: 'draft' // default
    });
    await blog.save();
    res.status(201).json(blog);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Blog title must be unique' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const id = req.params.id;
    const blog = await Blog.findById(id).populate('author', 'first_name last_name email');
    if (!blog) return res.status(404).json({ message: 'Blog not found' });

    // Only allow viewing draft if requester is the author
    if (blog.state === 'draft') {
      if (!req.user || String(blog.author._id) !== String(req.user._id)) {
        return res.status(404).json({ message: 'Blog not found' });
      }
    }

    // increment read_count when a single blog is requested (both logged in and not)
    blog.read_count = (blog.read_count || 0) + 1;
    await blog.save();

    res.json(blog);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    // owner middleware already loaded blog into req.blog
    const blog = req.blog;
    const { title, description, tags, body, state } = req.body;

    if (title) blog.title = title;
    if (description) blog.description = description;
    if (typeof tags !== 'undefined') blog.tags = Array.isArray(tags) ? tags : tags.split(',').map(t=>t.trim());
    if (body) {
      blog.body = body;
      blog.reading_time = calculateReadingTime(body);
    }
    // let owner toggle state to published or draft
    if (state && ['published', 'draft'].includes(state)) blog.state = state;

    await blog.save();
    res.json(blog);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Blog title must be unique' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await req.blog.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.myBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, state } = req.query;
    const q = { author: req.user._id };
    if (state) q.state = state;
    const total = await Blog.countDocuments(q);
    const items = await Blog.find(q).sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit).lean();
    res.json({ items, page: +page, limit: +limit, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
