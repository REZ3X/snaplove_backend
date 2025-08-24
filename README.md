# 🚀 Snaplove Backend API

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive RESTful API backend for **Snaplove** - a frame-based photo sharing platform where users can create custom frames, capture photos using those frames, and share them with the community.

## 🌟 Features

- **🖼️ Frame Management**: Create, edit, and manage photo frames with approval system
- **📸 Photo Capture**: Take photos using frames with role-based TTL
- **👥 User System**: Role-based permissions and content moderation
- **🏆 Leaderboard**: Rankings based on likes and frame usage
- **⚙️ Admin Tools**: Comprehensive administration and reporting
- **🔐 Security**: JWT authentication, API key protection, rate limiting
- **📊 Analytics**: Real-time stats and performance metrics

## 🏗️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT + Google OAuth
- **File Storage**: Local file system with image processing
- **Security**: Helmet, CORS, Rate Limiting, API Keys
- **Testing**: Jest
- **Deployment**: PM2 compatible

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- MongoDB 6.x
- Google OAuth credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/REZ3X/snaplove_backend.git
   cd snaplove_backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file:
   ```env
   # Database
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/snaplove
   
   # Authentication
   JWT_SECRET=your_jwt_secret_here
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   
   # Environment
   NODE_ENV=development
   PORT=3000
   
   # Frontend URLs (production)
   PRODUCTION_FRONTEND_URLS=https://yourfrontend.com
   
   # API Keys (production only)
   API_KEYS=your_production_api_key_1,your_production_api_key_2
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Visit the API documentation**
   ```
   http://localhost:3000/
   ```

## 📖 API Documentation

### Base URLs
- **Development**: `http://localhost:3000`
- **Production**: `https://api.yourproject.com`

### Authentication
All authenticated endpoints require a JWT token in the Authorization header:
```javascript
headers: {
  'Authorization': 'Bearer your_jwt_token_here'
}
```

### Production API Access
Production requests require an API key:
```javascript
headers: {
  'x-api-key': 'your_api_key_here'
}
```

### Core Endpoints

#### 🔐 Authentication
- `POST /api/auth/register` - Register with Google OAuth
- `POST /api/auth/login` - Login with credentials
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

#### 🖼️ Frames
- `GET /api/frame/public` - Get public frames
- `POST /api/frame/public` - Create new frame
- `GET /api/frame/public/{id}` - Get specific frame
- `POST /api/frame/public/{id}/like` - Like/unlike frame

#### 📸 Photos
- `POST /api/user/{username}/photo/capture` - Capture photo with frame
- `GET /api/user/{username}/photo/private` - Get user's photos
- `PUT /api/user/{username}/photo/private/{id}/edit` - Edit photo

#### 🏆 Leaderboard
- `GET /api/leaderboard/public` - Get user rankings

#### ⚙️ Admin (Admin only)
- `GET /api/admin/framePublicApproval` - Frame approval queue
- `GET /api/admin/users` - User management
- `GET /api/admin/serverHealth` - Server statistics

For complete API documentation, visit `/` when the server is running.

## 🗂️ Project Structure

```
src/
├── api/                    # API route handlers
│   ├── admin/             # Admin-only endpoints
│   ├── auth/              # Authentication
│   ├── frame/             # Frame management
│   ├── user/              # User operations
│   └── leaderboard/       # Rankings
├── lib/                   # Core libraries
├── middleware/            # Custom middleware
├── models/                # MongoDB schemas
├── utils/                 # Utility functions
└── view/                  # API documentation
```

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev          # Start with nodemon
npm start           # Production start

# Testing
npm test            # Run tests
npm run test:watch  # Watch mode

# Linting
npm run lint        # ESLint check
npm run lint:fix    # Auto-fix issues
```

### Adding New Endpoints

1. Create route file in appropriate `/api` directory
2. Add route import to `src/app.js`
3. Update API documentation in `src/view/index.html`
4. Add tests in `/tests` directory

### Environment Configurations

- **Development**: Full debugging, relaxed rate limits
- **Production**: Strict security, API key required, optimized logging
- **Test**: Mock database, unlimited rate limits

## 🛡️ Security Features

- **JWT Authentication**: Secure user sessions
- **API Key Protection**: Production endpoint protection
- **Rate Limiting**: Prevent abuse and DDoS
- **CORS Configuration**: Cross-origin request control
- **Input Validation**: Request data sanitization
- **File Upload Security**: Safe image handling
- **Role-Based Access**: Granular permissions

## 👥 User Roles & Permissions

| Role | Frame Limit | Photo TTL | Auto-Approval | Admin Access |
|------|-------------|-----------|---------------|-------------|
| **Basic** | 3 public | 3 days | ❌ | ❌ |
| **Verified** | 20 public | 7 days | ❌ | ❌ |
| **Verified Premium** | Unlimited | Unlimited | ❌ | ❌ |
| **Official** | Unlimited | Unlimited | ✅ | ✅ |
| **Developer** | Unlimited | Unlimited | ✅ | ✅ |

## 📊 Monitoring & Health

### Health Check
```bash
GET /health
```

Provides comprehensive system status:
- Database connectivity
- Response times
- Memory usage
- Active users/frames statistics

### Metrics Tracked
- API response times
- Database query performance
- User engagement (likes, uses, uploads)
- Error rates and types

## 🚀 Deployment

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start src/app.js --name "snaplove-backend"

# Monitor
pm2 monit

# Auto-restart on file changes
pm2 start src/app.js --watch --name "snaplove-backend"
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables (Production)

Ensure these are set in production:
- `NODE_ENV=production`
- `MONGODB_URI` - Production database
- `API_KEYS` - Comma-separated API keys
- `PRODUCTION_FRONTEND_URLS` - Allowed frontend domains

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push to branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open Pull Request**

### Contribution Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Ensure all tests pass
- Use semantic commit messages

### Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/snaplove_backend.git

# Add upstream remote
git remote add upstream https://github.com/REZ3X/snaplove_backend.git

# Install development dependencies
npm install

# Run tests
npm test
```

## 📄 API Response Format

### Success Response
```javascript
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```javascript
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "field_name",
      "message": "Validation error"
    }
  ]
}
```

## 🔗 Related Projects

- **Frontend**: [Snaplove Frontend Repository](https://github.com/REZ3X/snaplove_frontend)
- **Mobile App**: Coming soon
- **Admin Dashboard**: Coming soon

## 📞 Support

- **Documentation**: Visit `/` when server is running
- **Issues**: [GitHub Issues](https://github.com/REZ3X/snaplove_backend/issues)
- **Discussions**: [GitHub Discussions](https://github.com/REZ3X/snaplove_backend/discussions)

## 📈 Roadmap

- [ ] WebSocket support for real-time notifications
- [ ] Redis caching layer
- [ ] Image CDN integration
- [ ] Advanced analytics dashboard
- [ ] Mobile push notifications
- [ ] Third-party integrations (Instagram, TikTok)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⭐ Show Your Support

If this project helped you, please give it a ⭐ on GitHub!

---

<div align="center">
  <p>Built with ❤️ by the Snaplove Team</p>
  <p>
    <a href="https://github.com/REZ3X">REZ3X</a> •
    <a href="https://github.com/REZ3X/snaplove_backend/issues">Report Bug</a> •
    <a href="https://github.com/REZ3X/snaplove_backend/issues">Request Feature</a>
  </p>
</div>