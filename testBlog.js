const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const connectDB = require('../../src/config/db');
const User = require('../models/User');
const Blog = require('../models/Blog');

const MONGO_TEST_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/blog-api-test';

let token, userId;

beforeAll(async () => {
  await connectDB(MONGO_TEST_URI);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

beforeEach(async () => {
  await User.deleteMany();
  await Blog.deleteMany();
  const signupRes = await request(app).post('/api/auth/signup').send({
    first_name: 'Author',
    last_name: 'One',
    email: 'author1@example.com',
    password: 'Password1'
  });
  token = signupRes.body.token;
  userId = signupRes.body.user.id;
});

afterEach(async () => {
  await User.deleteMany();
  await Blog.deleteMany();
});

test('create blog (draft) then publish and retrieve', async () => {
  // create
  const createRes = await request(app)
    .post('/api/blogs')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'My First Blog', body: 'This is content ' + 'word '.repeat(300), tags: ['tech','node'] })
    .expect(201);

  expect(createRes.body.state).toBe('draft');

  // get single as owner (should increment read_count)
  const get1 = await request(app).get(`/api/blogs/${createRes.body._id}`).set('Authorization', `Bearer ${token}`).expect(200);
  expect(get1.body.read_count).toBe(1);
  expect(get1.body.author.email).toBe('author1@example.com');

  // publish
  const updateRes = await request(app)
    .put(`/api/blogs/${createRes.body._id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ state: 'published' })
    .expect(200);
  expect(updateRes.body.state).toBe('published');

  // get as unauthenticated - list should include published blog
  const listRes = await request(app).get('/api/blogs').expect(200);
  expect(listRes.body.total).toBe(1);
  expect(listRes.body.items[0].title).toBe('My First Blog');

  // single get increments read_count again
  const get2 = await request(app).get(`/api/blogs/${createRes.body._id}`).expect(200);
  expect(get2.body.read_count).toBe(2);
});

test('owner can edit and delete blog', async () => {
  const createRes = await request(app).post('/api/blogs').set('Authorization', `Bearer ${token}`).send({
    title: 'To Edit',
    body: 'Some content'
  }).expect(201);

  // update body
  const updateRes = await request(app).put(`/api/blogs/${createRes.body._id}`).set('Authorization', `Bearer ${token}`).send({
    body: 'Updated content with more words to increase reading time'
  }).expect(200);

  expect(updateRes.body.body.includes('Updated')).toBeTruthy();

  // delete
  const delRes = await request(app).delete(`/api/blogs/${createRes.body._id}`).set('Authorization', `Bearer ${token}`).expect(200);
  expect(delRes.body.message).toBe('Deleted');

  // ensure gone
  await request(app).get(`/api/blogs/${createRes.body._id}`).expect(404);
});

test('pagination, filter, search, order', async () => {
  // create multiple blogs and publish
  const titles = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
  for (let t of titles) {
    const r = await request(app).post('/api/blogs').set('Authorization', `Bearer ${token}`).send({
      title: t,
      body: 'body ' + t + ' ' + 'word '.repeat(50),
      tags: ['tag1', t.toLowerCase()]
    });
    // publish
    await request(app).put(`/api/blogs/${r.body._id}`).set('Authorization', `Bearer ${token}`).send({ state: 'published' });
    // increment read_count different amounts
    for (let i = 0; i < (Math.random() * 5) | 0; i++) {
      await request(app).get(`/api/blogs/${r.body._id}`);
    }
  }

  // pagination default limit 20 - all returned
  const listRes = await request(app).get('/api/blogs').expect(200);
  expect(listRes.body.items.length).toBeGreaterThanOrEqual(5);

  // search by title
  const searchRes = await request(app).get('/api/blogs').query({ search: 'Alpha' }).expect(200);
  expect(searchRes.body.items.some(b=>b.title === 'Alpha')).toBeTruthy();

  // filter tags
  const tagRes = await request(app).get('/api/blogs').query({ tags: 'gamma' }).expect(200);
  expect(tagRes.body.items.every(b => b.tags.includes('gamma'))).toBeTruthy();

  // order by read_count desc
  const orderRes = await request(app).get('/api/blogs').query({ order_by: 'read_count', order: 'desc' }).expect(200);
  expect(orderRes.body.items).toBeInstanceOf(Array);
});
