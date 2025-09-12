# 🚀 Snaplove Backend API

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-green.svg)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-black.svg)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive RESTful API backend for **Snaplove** - a frame-based photo sharing platform where users can create custom frames, capture photos using those frames, and build social connections with real-time interactions.

## 🌟 Features

- **🖼️ Frame Management**: Create, edit, and manage photo frames with approval system
- **📸 Photo Capture**: Take photos using frames with role-based TTL
- **👥 Social System**: Follow/unfollow users with mutual connections
- **🔔 Real-time Notifications**: Live updates via WebSocket connections
- **🏆 Leaderboard & Trending**: Rankings based on likes, usage, and trending analysis
- **🔍 Advanced Search**: Comprehensive search for frames and users with relevance scoring and filtering
- **📈 Trending Analysis**: Real-time trending frames with velocity scoring and time periods
- **🔍 Smart Discovery**: Intelligent frame discovery with hybrid algorithms combining trending, recency, and engagement signals
- **🎯 Frame Leaderboards**: Individual frame usage rankings and user statistics
- **👤 Profile Management**: Custom profile image uploads with Google OAuth fallback
- **⚙️ Admin Tools**: Comprehensive administration and reporting
- **🔐 Security**: JWT authentication, API key protection, rate limiting
- **📊 Analytics**: Real-time stats and performance metrics

## 🏗️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.IO for WebSocket connections
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
   PORT=4000

   # Frontend URLs (production)
   PRODUCTION_FRONTEND_URLS=https://yourfrontend.com

   # API Keys (production only)
   API_KEYS=your_production_api_key_1,your_production_api_key_2

   # Documentation Authentication
   DOCS_USERNAME=admin
   DOCS_PASSWORD=admin
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
- **Production**: `https://snaploveapi.slaviors.xyz`

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

#### 🖼️ Frame Management

- `GET /api/frame/public` - Get public frames with filters
- `POST /api/frame/public` - Create new frame
- `GET /api/frame/public/{id}` - Get specific frame
- `POST /api/frame/public/{id}/like` - Like/unlike frame (with notifications)
- `GET /api/user/{username}/frame` - Get user's frames
- `PUT /api/user/{username}/frame/private/{id}/edit` - Edit frame

#### 📸 Photo Management

- `POST /api/user/{username}/photo/capture` - Capture photo with frame
- `GET /api/user/{username}/photo/private` - Get user's photos
- `PUT /api/user/{username}/photo/private/{id}/edit` - Edit photo
- `DELETE /api/user/{username}/photo/private/{id}/delete` - Delete photo

#### 👥 Social Features

- `GET /api/user/{username}/following` - Get following list
- `POST /api/user/{username}/following` - Follow user (with notifications)
- `DELETE /api/user/{username}/following/{id}` - Unfollow user
- `GET /api/user/{username}/follower` - Get followers list
- `DELETE /api/user/{username}/follower/{id}` - Remove follower
- `GET /api/user/{username}/following/check/{target}` - Check follow status

#### 🔔 Real-time Notifications

- `GET /api/user/{username}/notification/private` - Get notifications
- `PUT /api/user/{username}/notification/private/{id}/read` - Mark as read
- `PUT /api/user/{username}/notification/private/mark-all-read` - Mark all read
- `GET /api/user/{username}/notification/private/unread-count` - Get unread count

#### 🏆 Leaderboard

- `GET /api/leaderboard/public` - Get user rankings by time period

#### � Advanced Search

- `GET /api/search` - Search frames and users with advanced filtering
  - **Query Parameters**:
    - `q` - Search query (required)
    - `type` - Search type: `frames`, `users`, or `all`
    - `layout_type` - Frame layout filter: `2x1`, `3x1`, `4x1`
    - `tag` - Frame tag filter
    - `official_only` - Show only official frames
    - `role` - User role filter
    - `sort_frames` - Sort frames by: `relevance`, `newest`, `most_liked`, `most_used`
    - `sort_users` - Sort users by: `relevance`, `newest`, `name_asc`

#### 📈 Trending Analysis

- `GET /api/frame/public/trending` - Get trending frames with velocity scoring
  - **Query Parameters**:
    - `type` - Trending type: `uses`, `likes`, or `both`
    - `period` - Time period: `1d`, `3d`, `7d`, `1m`, or `all`
    - `layout_type` - Frame layout filter
    - `official_only` - Show only official frames

#### 🔍 Discovery

- `GET /api/frame/public/discover` - Intelligent frame discovery with multiple algorithms
  - **Query Parameters**:
    - `algorithm` - Discovery type: `hybrid`, `trending`, `recent`, or `random`
    - `limit` - Results per page (1-50)
    - `page` - Page number
    - `layout_type` - Frame layout filter
    - `official_only` - Show only official frames

#### 🎯 Frame Leaderboards

- `GET /api/frame/public/{id}/leaderboard` - Get users who used specific frame most
  - **Query Parameters**:
    - `period` - Time period: `7d`, `1m`, or `all`
    - `limit` - Results per page (1-50)
    - `page` - Page number

#### � User Analytics

- `GET /api/user/{username}` - Get user profile
- `GET /api/user/{username}/stats` - Get user statistics (including social stats)
- `GET /api/user/{username}/liked/private` - Get liked frames
- `PUT /api/user/{username}/private/edit` - Edit profile with custom image upload

#### 📋 Reports & Tickets

- `GET /api/user/{username}/report/private` - Get user reports
- `POST /api/user/{username}/report/private` - Submit content report
- `GET /api/user/{username}/ticket/private` - Get support tickets
- `POST /api/user/{username}/ticket/private` - Create support ticket

#### ⚙️ Admin (Admin only)

- `GET /api/admin/framePublicApproval` - Frame approval queue
- `PUT /api/admin/framePublicApproval/{id}` - Approve/reject frame
- `GET /api/admin/users` - User management
- `PUT /api/admin/users/{username}/update` - Update user
- `GET /api/admin/reports` - Content reports
- `GET /api/admin/ticket` - Support tickets
- `GET /api/admin/serverHealth` - Server statistics

For complete API documentation, visit `/` when the server is running.

## 🔔 Real-time Features

### WebSocket Connection

```javascript
import io from "socket.io-client";

const socket = io("ws://localhost:3000", {
  auth: {
    token: localStorage.getItem("authToken"),
  },
});

// Listen for real-time notifications
socket.on("new_notification", (notification) => {
  console.log("New notification:", notification);
});

socket.on("unread_count", (data) => {
  console.log("Unread count:", data.count);
});
```

### Notification Types

- **`frame_like`**: Someone liked your frame
- **`frame_use`**: Someone used your frame to take a photo
- **`user_follow`**: Someone started following you
- **`frame_upload`**: Someone you follow uploaded a new frame
- **`frame_approved`**: Your frame was approved by admin
- **`frame_rejected`**: Your frame was rejected by admin
- **`system`**: System notifications

## 🗂️ Project Structure

```
src/
├── api/                    # API route handlers
│   ├── admin/             # Admin-only endpoints
│   ├── auth/              # Authentication
│   ├── frame/             # Frame management & trending
│   ├── search/            # Advanced search functionality
│   ├── user/              # User operations & social features
│   └── leaderboard/       # Rankings & competitions
├── lib/                   # Core libraries
│   └── mongodb.js         # Database connection
├── middleware/            # Custom middleware
│   ├── apiKeyAuth.js      # API key protection
│   ├── docsAuth.js        # Documentation authentication
│   └── middleware.js      # Authentication & permissions
├── models/                # MongoDB schemas
│   ├── User.js            # User model with profile images
│   ├── Frame.js           # Frame model with trending metrics
│   ├── Photo.js           # Photo model with TTL
│   ├── Follow.js          # Social relationships
│   ├── Notification.js    # Real-time notifications
│   ├── Report.js          # Content reports
│   └── Ticket.js          # Support tickets
├── services/              # Business logic
│   └── socketService.js   # Real-time notifications
├── utils/                 # Utility functions
│   ├── LocalImageHandler.js    # Image processing
│   ├── profileImageHelper.js   # Profile image management
│   └── RolePolicy.js           # Permission policies
└── view/                  # API documentation
    ├── docs.html          # Protected documentation
    └── index.html         # Interactive docs
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
npm run test:auth   # Auth-specific tests

# Linting
npm run lint        # ESLint check
npm run lint:fix    # Auto-fix issues
```

### Adding New Endpoints

1. Create route file in appropriate `/api` directory
2. Add route import to [`src/app.js`](src/app.js)
3. Update API documentation in [`src/view/index.html`](src/view/index.html)
4. Add tests in `/tests` directory
5. Update this README if needed

### Environment Configurations

- **Development**: Full debugging, relaxed rate limits, no API key required
- **Production**: Strict security, API key required, optimized logging
- **Test**: Mock database, unlimited rate limits, isolated environment

## 🛡️ Security Features

- **JWT Authentication**: Secure user sessions with role-based access
- **API Key Protection**: Production endpoint protection (skips `/`, `/health`)
- **Rate Limiting**: Prevent abuse and DDoS attacks
- **CORS Configuration**: Cross-origin request control with environment-aware settings
- **Input Validation**: Request data sanitization with express-validator
- **File Upload Security**: Safe image handling with size and type restrictions
- **Role-Based Access**: Granular permissions for different user types
- **WebSocket Security**: JWT authentication for real-time connections

## 👥 User Roles & Permissions

| Role                 | Frame Limit | Photo TTL | Auto-Approval | Admin Access | Social Features |
| -------------------- | ----------- | --------- | ------------- | ------------ | --------------- |
| **Basic**            | 3 public    | 3 days    | ❌            | ❌           | ✅ Full         |
| **Verified**         | 20 public   | 7 days    | ❌            | ❌           | ✅ Full         |
| **Verified Premium** | Unlimited   | Unlimited | ❌            | ❌           | ✅ Full         |
| **Official**         | Unlimited   | Unlimited | ✅            | ✅           | ✅ Full         |
| **Developer**        | Unlimited   | Unlimited | ✅            | ✅           | ✅ Full         |

## 📊 Social & Analytics Features

### Social Interactions

- **Follow/Unfollow System**: Build connections with other users
- **Mutual Follow Detection**: Identify mutual connections
- **Follower Management**: Remove followers from your profile
- **Real-time Social Notifications**: Get notified of new followers and frame uploads

### Analytics & Leaderboards

- **User Statistics**: Comprehensive stats including social metrics
- **Time-based Leaderboards**: 7-day, 30-day, and all-time rankings
- **Multiple Ranking Types**: Likes, uses, or combined scoring
- **Growth Metrics**: Track performance over time
- **Top Performers**: Showcase best-performing frames

### Advanced Search & Discovery

- **Multi-type Search**: Search frames and users simultaneously with relevance scoring
- **Smart Filtering**: Filter by layout type, tags, official status, user roles
- **Flexible Sorting**: Sort by relevance, popularity, date, or usage statistics
- **Pagination Support**: Efficient pagination with configurable limits

### Trending & Analytics

- **Velocity-based Trending**: Smart trending algorithm considering recency and engagement
- **Time Period Analysis**: Compare performance across different time windows
- **Frame-specific Leaderboards**: See top users for any individual frame
- **Engagement Metrics**: Track likes, uses, and combined performance scores

### Profile & Image Management

- **Custom Profile Images**: Upload and manage custom profile pictures
- **Google OAuth Integration**: Seamless fallback to Google profile images
- **Image Processing**: Automatic resizing and optimization
- **Flexible Display**: Dynamic switching between custom and OAuth images

## 📊 Monitoring & Health

### Health Check

```bash
GET /health
```

Provides comprehensive system status:

- Database connectivity and response times
- Memory usage and system performance
- Active users, frames, and photos statistics
- WebSocket connection count
- API response times

### Metrics Tracked

- API response times and error rates
- Database query performance
- User engagement (likes, uses, uploads, follows)
- Real-time notification delivery
- Social interaction patterns

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

# View logs
pm2 logs snaplove-backend
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

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/snaplove
JWT_SECRET=your_super_secure_jwt_secret
API_KEYS=key1,key2,key3
PRODUCTION_FRONTEND_URLS=https://yourfrontend.com,https://www.yourfrontend.com
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_secret
PORT=3000
```

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

- Follow existing code style and patterns
- Add tests for new features
- Update documentation (README, API docs)
- Ensure all tests pass
- Use semantic commit messages
- Consider real-time implications for social features

### Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/snaplove_backend.git

# Add upstream remote
git remote add upstream https://github.com/REZ3X/snaplove_backend.git

# Install development dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run tests
npm test

# Start development server
npm run dev
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

### Real-time Events

```javascript
// WebSocket event structure
{
  "type": "new_notification",
  "data": {
    "id": "notification_id",
    "type": "frame_like",
    "title": "Frame Liked!",
    "message": "Someone liked your frame",
    "sender": { /* user info */ },
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

## 🔗 Related Projects

- **Frontend**: [Snaplove Frontend Repository](https://github.com/REZ3X/snaplove_frontend)
- **Mobile App**: Coming soon
- **Admin Dashboard**: Coming soon
- **Analytics Dashboard**: Coming soon

## 📞 Support

- **Documentation**: Visit `/` when server is running for interactive docs
- **Issues**: [GitHub Issues](https://github.com/REZ3X/snaplove_backend/issues)
- **Discussions**: [GitHub Discussions](https://github.com/REZ3X/snaplove_backend/discussions)
- **API Support**: Include detailed error logs and request examples

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⭐ Show Your Support

If this project helped you, please give it a ⭐ on GitHub and consider:

- Starring the repository
- Following [@REZ3X](https://github.com/REZ3X) for updates
- Sharing with other developers
- Contributing to the codebase

---

<div align="center">
  <p>Built with ❤️ by the Snaplove Team</p>
  <p>
    <a href="https://github.com/REZ3X">REZ3X</a> •
    <a href="https://github.com/REZ3X/snaplove_backend/issues">Report Bug</a> •
    <a href="https://github.com/REZ3X/snaplove_backend/issues">Request Feature</a> •
    <a href="https://github.com/REZ3X/snaplove_backend/discussions">Discussions</a>
  </p>
</div>
