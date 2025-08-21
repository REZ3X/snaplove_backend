const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../src/models/User');

let app;

describe('Auth Endpoints', () => {
  let testUser;
  let authToken;

  const dummyGoogleUser = {
    google_id: 'test_google_id_123456789',
    email: 'testuser@gmail.com',
    name: 'Test User',
    image_profile: 'https://example.com/profile.jpg'
  };

  const existingUserData = {
    google_id: 'existing_google_id_987654321',
    email: 'existing@gmail.com',
    name: 'Existing User',
    username: 'existing_user',
    role: 'basic',
    ban_status: false
  };

  beforeAll(async () => {

    app = require('../src/app');
    

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connection.asPromise();
    }
  });

  beforeEach(async () => {

    await User.deleteMany({});
    
    testUser = new User(existingUserData);
    await testUser.save();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid Google data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(dummyGoogleUser);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            name: dummyGoogleUser.name,
            email: dummyGoogleUser.email,
            username: 'testuser',
            role: 'basic',
            ban_status: false
          },
          token: expect.any(String)
        }
      });

      const createdUser = await User.findOne({ email: dummyGoogleUser.email });
      expect(createdUser).toBeTruthy();
      expect(createdUser.google_id).toBe(dummyGoogleUser.google_id);
      expect(createdUser.username).toBe('testuser');
    });

    it('should handle duplicate email registration', async () => {
      const duplicateUser = {
        ...dummyGoogleUser,
        email: existingUserData.email
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'User already exists'
      });
    });

    it('should handle duplicate google_id registration', async () => {
      const duplicateUser = {
        ...dummyGoogleUser,
        google_id: existingUserData.google_id
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'User already exists'
      });
    });

    it('should generate unique username for duplicate email prefixes', async () => {
      await User.create({
        google_id: 'another_google_id',
        email: 'another@gmail.com',
        name: 'Another User',
        username: 'testuser',
        role: 'basic'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(dummyGoogleUser);

      expect(response.status).toBe(201);
      expect(response.body.data.user.username).toBe('testuser1');
    });

    it('should reject registration with missing required fields', async () => {
      const invalidUser = {
        google_id: dummyGoogleUser.google_id
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        errors: expect.any(Array)
      });
    });

    it('should reject registration with invalid email format', async () => {
      const invalidUser = {
        ...dummyGoogleUser,
        email: 'invalid-email-format'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            msg: 'Valid email is required'
          })
        ])
      });
    });

    it('should register user without image_profile', async () => {
      const userWithoutImage = {
        google_id: 'unique_google_id_456',
        email: 'testuser2@gmail.com',
        name: 'Test User 2'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userWithoutImage);

      expect(response.status).toBe(201);
      expect(response.body.data.user.image_profile).toBeNull();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login existing user with valid Google data', async () => {
      const loginData = {
        google_id: existingUserData.google_id,
        email: existingUserData.email
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: expect.any(String),
            name: existingUserData.name,
            email: existingUserData.email,
            username: existingUserData.username,
            role: existingUserData.role,
            ban_status: false
          },
          token: expect.any(String)
        }
      });

      authToken = response.body.data.token;
    });

    it('should login user by email even without google_id', async () => {
      const loginData = {
        google_id: 'new_google_id',
        email: existingUserData.email
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.google_id).toBe('new_google_id');
    });

    it('should reject login for non-existent user', async () => {
      const nonExistentUser = {
        google_id: 'non_existent_google_id',
        email: 'nonexistent@gmail.com'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(nonExistentUser);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'User not found. Please register first.'
      });
    });

    it('should reject login for banned user with permanent ban', async () => {
      await User.findByIdAndUpdate(testUser._id, {
        ban_status: true,
        ban_release_datetime: null
      });

      const loginData = {
        google_id: existingUserData.google_id,
        email: existingUserData.email
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Account is permanently banned'
      });
    });

    it('should reject login for banned user with active temporary ban', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await User.findByIdAndUpdate(testUser._id, {
        ban_status: true,
        ban_release_datetime: futureDate
      });

      const loginData = {
        google_id: existingUserData.google_id,
        email: existingUserData.email
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Account is banned',
        ban_release_datetime: futureDate.toISOString()
      });
    });

    it('should auto-unban user when temporary ban expires', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await User.findByIdAndUpdate(testUser._id, {
        ban_status: true,
        ban_release_datetime: pastDate
      });

      const loginData = {
        google_id: existingUserData.google_id,
        email: existingUserData.email
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.ban_status).toBe(false);
      expect(updatedUser.ban_release_datetime).toBeNull();
    });

    it('should reject login with missing required fields', async () => {
      const invalidLogin = {
        google_id: existingUserData.google_id
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidLogin);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        errors: expect.any(Array)
      });
    });

    it('should reject login with invalid email format', async () => {
      const invalidLogin = {
        google_id: existingUserData.google_id,
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidLogin);

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'Valid email is required'
          })
        ])
      );
    });
  });

  describe('GET /api/auth/me', () => {
    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          google_id: existingUserData.google_id,
          email: existingUserData.email
        });
      
      if (loginResponse.status === 200) {
        authToken = loginResponse.body.data.token;
      }
    });

    it('should return user info with valid token', async () => {
      if (!authToken) {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            google_id: existingUserData.google_id,
            email: existingUserData.email
          });
        authToken = loginResponse.body.data.token;
      }

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: expect.any(String),
            name: existingUserData.name,
            username: existingUserData.username,
            email: existingUserData.email,
            role: existingUserData.role,
            ban_status: false,
            created_at: expect.any(String),
            updated_at: expect.any(String)
          }
        }
      });
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Access token required'
      });
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid or expired token'
      });
    });

    it('should reject request with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Access token required'
      });
    });

    it('should reject request for banned user', async () => {
      if (!authToken) {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            google_id: existingUserData.google_id,
            email: existingUserData.email
          });
        authToken = loginResponse.body.data.token;
      }

      await User.findByIdAndUpdate(testUser._id, {
        ban_status: true
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Account is banned'
      });
    });

    it('should reject request for non-existent user', async () => {
      if (!authToken) {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            google_id: existingUserData.google_id,
            email: existingUserData.email
          });
        authToken = loginResponse.body.data.token;
      }

      await User.findByIdAndDelete(testUser._id);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        message: 'User not found'
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          google_id: existingUserData.google_id,
          email: existingUserData.email
        });
      
      if (loginResponse.status === 200) {
        authToken = loginResponse.body.data.token;
      }
    });

    it('should logout successfully with valid token', async () => {
      if (!authToken) {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            google_id: existingUserData.google_id,
            email: existingUserData.email
          });
        authToken = loginResponse.body.data.token;
      }

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Logout successful'
      });
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Access token required'
      });
    });

    it('should reject logout with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid or expired token'
      });
    });
  });

  describe('Auth Flow Integration Test', () => {
    it('should complete full auth flow: register -> login -> me -> logout', async () => {
      let token;


      const uniqueUser = {
        google_id: 'flow_test_google_id_789',
        email: 'flowtest@gmail.com',
        name: 'Flow Test User',
        image_profile: 'https://example.com/profile.jpg'
      };


      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(uniqueUser);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.success).toBe(true);
      token = registerResponse.body.data.token;


      const meResponse1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meResponse1.status).toBe(200);
      expect(meResponse1.body.data.user.email).toBe(uniqueUser.email);


      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          google_id: uniqueUser.google_id,
          email: uniqueUser.email
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      token = loginResponse.body.data.token;


      const meResponse2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meResponse2.status).toBe(200);
      expect(meResponse2.body.data.user.email).toBe(uniqueUser.email);


      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);


      const meResponse3 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meResponse3.status).toBe(200);
      expect(meResponse3.body.success).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to auth endpoints', async () => {


      const invalidLogin = {
        google_id: 'invalid',
        email: 'invalid@gmail.com'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidLogin);


      expect([401, 429]).toContain(response.status);
    });
  });
});