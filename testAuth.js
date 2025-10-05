const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const connectDB = require('../../src/config/db');
const User = require('../models/User');

const MONGO_TEST_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/blog-api-test';

beforeAll(async () => {
  await connectDB(MONGO_TEST_URI);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe('Auth', () => {
  afterEach(async () => {
    await User.deleteMany();
  });

  test('signup and login flow', async () => {
    const signupRes = await request(app).post('/api/auth/signup').send({
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      password: 'Password123'
    }).expect(201);

    expect(signupRes.body.token).toBeDefined();
    expect(signupRes.body.user.email).toBe('john@example.com');

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'john@example.com',
      password: 'Password123'
    }).expect(200);

    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.user.email).toBe('john@example.com');
  });

  test('duplicate signup rejected', async () => {
    await request(app).post('/api/auth/signup').send({
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      password: 'pass'
    }).expect(201);

    await request(app).post('/api/auth/signup').send({
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      password: 'pass'
    }).expect(409);
  });
});
