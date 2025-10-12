# 🚀 Snaplove Backend API

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-green.svg)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-black.svg)](https://socket.io/)
[![Discord.js](https://img.shields.io/badge/Discord.js-14.x-5865F2.svg)](https://discord.js.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive RESTful API backend for **Snaplove** - an innovative frame-based photo sharing platform featuring live photo capture, collaborative photo creation, and social networking. Users can create custom frames, capture regular and live photos (3-second videos), collaborate on photos with friends, and build communities with real-time interactions. Includes email verification system, Discord bot administration, and intelligent content discovery algorithms.

## 🌟 Features

### Core Features

- **🖼️ Frame Management**: Create, edit, and manage photo frames with approval system
- **📸 Photo Capture**: Take photos using frames with role-based TTL
- **🎬 Live Photo**: 3-second video capture with frame overlay (role-based save permissions)
- **🤝 Photo Collaboration**: Multi-user collaborative photo creation with stickers and invitations
- **👥 Social System**: Follow/unfollow users with mutual connections and relationship tracking
- **🔔 Real-time Notifications**: Live updates via WebSocket for all social interactions
- **📧 Email Verification**: Brevo SMTP integration with 24-hour verification tokens

### Discovery & Analytics

- **🏆 Leaderboard System**: Time-based rankings (7-day, 30-day, all-time) for users and frames
- **📈 Trending Analysis**: Velocity-based algorithm with recency weighting and engagement scoring
- **🔍 Smart Discovery**: Hybrid algorithm combining trending (40%), engagement (30%), momentum (20%), and randomization (10%)
- **🔎 Advanced Search**: Multi-type search with relevance scoring, filtering, and flexible sorting
- **🎯 Frame Leaderboards**: Individual frame usage rankings showing top users per frame
- **📊 User Statistics**: Comprehensive analytics including social metrics and growth tracking

### Social & Community

- **👤 Profile Management**: Custom profile image uploads with Google OAuth fallback
- **🎂 Birthday System**: One-time birthday setting with automatic celebrations and 24-hour badges
- **📢 Broadcasting System**: Admin broadcast messages with targeting and delivery tracking
- **📋 Report System**: Content moderation workflow for inappropriate frames and users
- **� Ticket System**: Support ticket management with priority levels and status tracking

### Administration

- **🤖 Discord Integration**: Full admin panel access via Discord bot with 15+ slash commands
- **⚙️ Admin Tools**: User management, frame approval, content moderation, and analytics
- **🔐 Security**: JWT authentication, API key protection, rate limiting, and role-based access control
- **🧹 Automated Cleanup**: Scheduled TTL-based deletion for photos, frames, and video files

## 🏗️ Tech Stack

### Core Technologies

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Database**: MongoDB 6.x with Mongoose ODM
- **Real-time**: Socket.IO 4.x for WebSocket connections
- **Authentication**: JWT tokens + Google OAuth 2.0

### Integrations

- **Email Service**: Brevo (Sendinblue) SMTP for verification emails
- **Discord Integration**: Discord.js v14 with slash commands
- **File Storage**: Local file system with multer for uploads
- **Image Processing**: Sharp for optimization and resizing

### Security & Performance

- **Security**: Helmet, CORS, Rate Limiting, API Keys, Input Validation
- **Monitoring**: Custom health checks and performance metrics
- **Scheduled Jobs**: Node-cron for automated cleanup and birthday checks
- **Testing**: Jest with coverage reporting
- **Deployment**: PM2 compatible with ecosystem config

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- MongoDB 6.x
- Google OAuth credentials
- Discord Bot Token (optional, for admin integration)

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

   # Discord Integration (optional)
   DISCORD_BOT_TOKEN=your_discord_bot_token
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/id/token
   DISCORD_GUILD_ID=your_discord_server_id
   DISCORD_CHANNEL_ID=your_admin_channel_id
   DISCORD_ADMIN_IDS=your_discord_user_id,another_admin_id

   # Email Service (Brevo SMTP)
   BREVO_SMTP_HOST=smtp-relay.brevo.com
   BREVO_SMTP_PORT=587
   BREVO_SMTP_USER=your_brevo_user
   BREVO_SMTP_PASS=your_brevo_password
   BREVO_FROM_EMAIL=noreply@snaplove.pics
   BREVO_FROM_NAME=Snaplove

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

## 🤖 Discord Admin Bot Integration

### Features

- **Slash Commands**: Modern Discord slash command interface
- **Full Admin Access**: Complete admin panel functionality via Discord
- **Real-time Updates**: Instant notifications and status updates
- **Secure Authentication**: Discord user ID-based authorization
- **Rich Embeds**: Beautiful formatted responses with detailed information

### Available Commands

| Command           | Description                 | Usage                                              |
| ----------------- | --------------------------- | -------------------------------------------------- |
| `/help`           | Show all available commands | `/help`                                            |
| `/test`           | Test bot functionality      | `/test`                                            |
| `/stats`          | Get system statistics       | `/stats`                                           |
| `/health`         | Check server health         | `/health`                                          |
| `/frames`         | List frames by status       | `/frames status:pending limit:10`                  |
| `/approve`        | Approve a frame             | `/approve frame_id:123`                            |
| `/reject`         | Reject a frame              | `/reject frame_id:123 reason:"Inappropriate"`      |
| `/users`          | List users by role          | `/users role:basic limit:15`                       |
| `/user`           | Get user details            | `/user username:john_doe`                          |
| `/ban`            | Ban a user                  | `/ban username:spammer duration:7d reason:"Spam"`  |
| `/unban`          | Unban a user                | `/unban username:john_doe`                         |
| `/role`           | Change user role            | `/role username:john_doe new_role:verified_basic`  |
| `/broadcast`      | Send broadcast message      | `/broadcast message:"Server maintenance tonight!"` |
| `/reports`        | List content reports        | `/reports status:pending limit:10`                 |
| `/report`         | Get report details          | `/report report_id:abc123`                         |
| `/resolve-report` | Resolve a report            | `/resolve-report report_id:abc123 action:done`     |
| `/tickets`        | List support tickets        | `/tickets status:pending priority:high`            |
| `/ticket`         | Get ticket details          | `/ticket ticket_id:def456`                         |
| `/resolve-ticket` | Update ticket status        | `/resolve-ticket ticket_id:def456 status:resolved` |

### Setup Discord Bot

1. **Create Discord Application**

   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create new application → Add Bot
   - Copy bot token to `DISCORD_BOT_TOKEN`

2. **Configure Bot Permissions**

   - Enable "Message Content Intent"
   - Bot permissions: Send Messages, Use Slash Commands, Embed Links

3. **Invite Bot to Server**

   - Use OAuth2 URL generator with `bot` and `applications.commands` scopes
   - Add to your Discord server

4. **Configure Environment**

   ```env
   DISCORD_BOT_TOKEN=your_bot_token_here
   DISCORD_GUILD_ID=your_server_id_here
   DISCORD_CHANNEL_ID=your_admin_channel_id_here
   DISCORD_ADMIN_IDS=your_discord_user_id,another_admin_id
   ```

5. **Test the Integration**
   - Bot will auto-register slash commands on startup
   - Use `/test` command to verify functionality
   - Use `/help` to see all available commands

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

- `POST /api/user/{username}/photo/capture` - Capture photo/live photo with frame
  - Supports dual upload: `images` (required) and `video_files` (optional for live photos)
  - Role-based save permissions: Basic users get download-only response
- `GET /api/user/{username}/photo/private` - Get user's photos with live photo support
- `GET /api/user/{username}/photo/private/{id}` - Get specific photo details
- `PUT /api/user/{username}/photo/private/{id}/edit` - Edit photo metadata
- `DELETE /api/user/{username}/photo/private/{id}/delete` - Delete photo and associated videos

#### 🤝 Photo Collaboration

- `POST /api/user/{username}/photo/photoCollab` - Send collaboration invitation
- `GET /api/user/{username}/photo/photoCollab` - Get collaboration invitations
- `PUT /api/user/{username}/photo/photoCollab/{id}/respond` - Accept/decline invitation
- `POST /api/user/{username}/photo/photoCollab/{id}/sticker` - Add stickers to collaboration
- `PUT /api/user/{username}/photo/photoCollab/{id}/complete` - Finalize collaboration
- `DELETE /api/user/{username}/photo/photoCollab/{id}` - Cancel collaboration

#### 👥 Social Features

- `GET /api/user/{username}/following` - Get following list with pagination
- `POST /api/user/{username}/following` - Follow user (triggers real-time notification)
- `DELETE /api/user/{username}/following/{id}` - Unfollow user
- `GET /api/user/{username}/follower` - Get followers list with pagination
- `DELETE /api/user/{username}/follower/{id}` - Remove follower
- `GET /api/user/{username}/following/check/{target}` - Check mutual follow status

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

#### 👤 User Management & Analytics

- `GET /api/user/{username}` - Get public user profile with social stats
- `GET /api/user/{username}/stats` - Comprehensive user statistics (frames, photos, social metrics)
- `GET /api/user/{username}/liked/private` - Get liked frames list
- `PUT /api/user/{username}/private/edit` - Edit profile with custom image upload (multipart/form-data)
- `PUT /api/user/{username}/birthday` - Set birthday (one-time only)

#### 📋 Reports & Tickets

- `GET /api/user/{username}/report/private` - Get user's submitted reports
- `POST /api/user/{username}/report/private` - Submit content report (frame/user)
- `GET /api/user/{username}/report/private/{id}` - Get specific report details
- `GET /api/user/{username}/ticket/private` - Get support tickets with filtering
- `POST /api/user/{username}/ticket/private` - Create support ticket with image upload
- `GET /api/user/{username}/ticket/private/{id}` - Get ticket details and responses

#### ⚙️ Admin (Official/Developer only)

- `GET /api/admin/framePublicApproval` - Frame approval queue with filtering
- `PUT /api/admin/framePublicApproval/{id}` - Approve/reject frame with reason
- `GET /api/admin/users` - User management with role filtering
- `GET /api/admin/users/{username}` - Get detailed user information
- `PUT /api/admin/users/{username}/update` - Update user role and ban status
- `DELETE /api/admin/users/{username}/delete` - Delete user account
- `GET /api/admin/reports` - Content reports with status filtering
- `GET /api/admin/reports/{id}` - Get report details
- `PUT /api/admin/reports/{id}` - Resolve content report
- `GET /api/admin/ticket` - Support tickets with priority filtering
- `GET /api/admin/ticket/{id}` - Get ticket details
- `PUT /api/admin/ticket/{id}` - Update ticket status and add response
- `POST /api/admin/broadcast` - Send broadcast messages to targeted users
- `GET /api/admin/discord/status` - Check Discord bot status
- `GET /api/admin/serverHealth` - Comprehensive server health and statistics

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

- **`frame_like`**: Someone liked your frame (includes sender info)
- **`frame_use`**: Someone used your frame to take a photo
- **`user_follow`**: Someone started following you (real-time)
- **`frame_upload`**: Someone you follow uploaded a new frame
- **`frame_approved`**: Your frame was approved by admin
- **`frame_rejected`**: Your frame was rejected by admin (includes reason)
- **`photo_collab_invite`**: Someone invited you to collaborate on a photo
- **`photo_collab_accepted`**: Your collaboration invitation was accepted
- **`photo_collab_completed`**: Collaboration finalized and ready
- **`birthday_celebration`**: Birthday notification for users you follow
- **`broadcast`**: Admin broadcast messages
- **`system`**: System-wide announcements

## 🗂️ Project Structure

```
src/
├── api/                           # API route handlers (REST endpoints)
│   ├── admin/                     # Admin-only endpoints (Official/Developer)
│   │   ├── broadcast/             # Broadcasting system with targeting
│   │   ├── discord/               # Discord bot status and management
│   │   ├── framePublicApproval/   # Frame approval workflow
│   │   ├── reports/               # Content report moderation
│   │   ├── serverHealth/          # System health monitoring
│   │   ├── ticket/                # Support ticket management
│   │   └── users/                 # User administration and banning
│   ├── auth/                      # Authentication & authorization
│   │   ├── login/                 # JWT token generation
│   │   ├── register/              # User registration with Google OAuth
│   │   ├── verify-email/          # Email verification (24h tokens)
│   │   ├── resend-verification/   # Resend verification email
│   │   ├── me/                    # Current user info with permissions
│   │   └── logout/                # Session termination
│   ├── frame/                     # Frame management system
│   │   └── public/                # Public frame operations
│   │       ├── discover/          # Hybrid discovery algorithm
│   │       ├── trending/          # Velocity-based trending
│   │       └── [id]/              # Frame details, like, leaderboard
│   ├── leaderboard/               # User ranking system
│   │   └── public/                # Time-based leaderboards
│   ├── search/                    # Advanced search engine
│   └── user/                      # User-specific operations
│       └── [username]/            # User profile and private routes
│           ├── birthday/          # One-time birthday setting
│           ├── follower/          # Follower management
│           ├── following/         # Following management
│           ├── frame/             # User frames (public/private)
│           ├── liked/             # Liked frames list
│           ├── notification/      # Real-time notifications
│           ├── photo/             # Photo management
│           │   ├── capture/       # Photo/live photo capture
│           │   ├── photoCollab/   # Collaboration invitations
│           │   └── private/       # Private photo operations
│           ├── private/edit/      # Profile editing
│           ├── report/            # User-submitted reports
│           ├── stats/             # User analytics
│           └── ticket/            # Support tickets
├── jobs/                          # Scheduled tasks
│   └── cleanupScheduler.js        # Automated TTL-based cleanup
├── lib/                           # Core libraries
│   └── mongodb.js                 # MongoDB connection with Mongoose
├── middleware/                    # Request middleware
│   ├── apiKeyAuth.js              # Production API key validation
│   ├── docsAuth.js                # Documentation basic auth
│   └── middleware.js              # JWT authentication & role checks
├── models/                        # MongoDB schemas (Mongoose)
│   ├── User.js                    # User with profile, birthday, role
│   ├── Frame.js                   # Frame with engagement metrics
│   ├── Photo.js                   # Photo with live photo support
│   ├── PhotoCollab.js             # Collaboration with stickers
│   ├── Follow.js                  # Social relationships
│   ├── Notification.js            # Real-time notification system
│   ├── Report.js                  # Content moderation reports
│   ├── Ticket.js                  # Support ticket system
│   └── Broadcast.js               # Admin broadcast messages
├── services/                      # Business logic services
│   ├── birthdayService.js         # Daily birthday checker
│   ├── discordBotService.js       # Discord bot with 15+ commands
│   ├── discordCommandService.js   # Slash command handlers
│   ├── mailService.js             # Brevo SMTP email service
│   ├── photoCleanupService.js     # TTL-based photo/video cleanup
│   └── socketService.js           # WebSocket event emitter
├── utils/                         # Utility functions
│   ├── LocalImageHandler.js       # Image/video upload & deletion
│   ├── DiscordHookHandler.js      # Discord webhook integration
│   ├── profileImageHelper.js      # Profile image processing
│   └── RolePolicy.js              # Role limits & TTL calculation
└── view/                          # HTML documentation
    ├── docs.html                  # Full API documentation
    └── index.html                 # Landing page
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

| Role                 | Frame Limit | Photo TTL | Live Photo Save  | Live Photo TTL | Auto-Approval | Admin Access |
| -------------------- | ----------- | --------- | ---------------- | -------------- | ------------- | ------------ |
| **Basic**            | 3 public    | 3 days    | ❌ Download-only | N/A            | ❌            | ❌           |
| **Verified**         | 20 public   | 7 days    | ✅ Yes           | 3 days         | ❌            | ❌           |
| **Verified Premium** | Unlimited   | Unlimited | ✅ Yes           | 7 days         | ❌            | ❌           |
| **Official**         | Unlimited   | Unlimited | ✅ Yes           | Unlimited      | ✅            | ✅           |
| **Developer**        | Unlimited   | Unlimited | ✅ Yes           | Unlimited      | ✅            | ✅           |

**Note**: All users can CREATE live photos, but only Verified+ users can SAVE them to the server. Basic users must download immediately.

### Feature Access Matrix

| Feature                 | Basic    | Verified | Premium   | Official  | Developer |
| ----------------------- | -------- | -------- | --------- | --------- | --------- |
| Public Frames           | 3        | 20       | Unlimited | Unlimited | Unlimited |
| Private Frames          | ✅       | ✅       | ✅        | ✅        | ✅        |
| Photo Capture           | ✅       | ✅       | ✅        | ✅        | ✅        |
| Regular Photo TTL       | 3 days   | 7 days   | Unlimited | Unlimited | Unlimited |
| Live Photo Create       | ✅       | ✅       | ✅        | ✅        | ✅        |
| Live Photo Save         | ❌       | ✅       | ✅        | ✅        | ✅        |
| Live Photo TTL          | N/A      | 3 days   | 7 days    | Unlimited | Unlimited |
| Photo Collaboration     | ✅       | ✅       | ✅        | ✅        | ✅        |
| Follow/Unfollow         | ✅       | ✅       | ✅        | ✅        | ✅        |
| Like Frames             | ✅       | ✅       | ✅        | ✅        | ✅        |
| Search & Discovery      | ✅       | ✅       | ✅        | ✅        | ✅        |
| Custom Profile Image    | ✅       | ✅       | ✅        | ✅        | ✅        |
| Birthday Setting        | ✅       | ✅       | ✅        | ✅        | ✅        |
| Email Verification      | Required | Required | Required  | Required  | Required  |
| Real-time Notifications | ✅       | ✅       | ✅        | ✅        | ✅        |
| Submit Reports/Tickets  | ✅       | ✅       | ✅        | ✅        | ✅        |
| Frame Auto-Approval     | ❌       | ❌       | ❌        | ✅        | ✅        |
| Admin Panel Access      | ❌       | ❌       | ❌        | ✅        | ✅        |
| Discord Bot Commands    | ❌       | ❌       | ❌        | ✅        | ✅        |
| Broadcasting            | ❌       | ❌       | ❌        | ✅        | ✅        |
| User Management         | ❌       | ❌       | ❌        | ✅        | ✅        |

## 📊 Social & Analytics Features

### 📸 Live Photo System

- **3-Second Video Capture**: Record video during frame countdown with MP4/WebM/GIF support (50MB limit)
- **Role-Based Save Permissions**:
  - **Basic users**: Can create but download-only (no server storage)
  - **Verified users**: Can save with 3-day TTL
  - **Premium users**: Can save with 7-day TTL
  - **Official users**: Can save with unlimited TTL
- **Dual File Upload**: Simultaneous image and video file handling in single request
- **Automated Cleanup**: TTL-based video file deletion with scheduled cleanup service
- **Download-Only Mode**: Special response format for basic users with immediate download URLs

### 🤝 Photo Collaboration System

- **Multi-User Collaboration**: Invite users to create collaborative photos together
- **Invitation Workflow**: Send, accept, decline, or cancel collaboration invitations
- **Sticker System**: Add emojis, text, or images to collaborative photos
- **Frame Matching**: Ensure both users use the same frame for consistency
- **Merged Output**: Automatically merge and deliver final collaborative images
- **Real-time Updates**: WebSocket notifications for all collaboration events
- **Expiry Management**: 7-day invitation expiration with automatic cleanup

### 👥 Social Interaction System

- **Follow/Unfollow System**: Build connections with pagination support
- **Mutual Follow Detection**: Check bidirectional follow status
- **Follower Management**: Remove followers from your profile
- **Real-time Notifications**: Instant WebSocket updates for follows and frame uploads
- **Social Analytics**: Track follower/following counts and growth

### 📊 Analytics & Leaderboards

- **User Statistics**: Comprehensive metrics (frames created, photos captured, likes received, follows)
- **Time-based Leaderboards**: 7-day, 30-day, and all-time rankings
- **Multiple Ranking Types**: Likes received, times used, or combined scoring
- **Frame Leaderboards**: Top users per frame with usage statistics
- **Growth Tracking**: Monitor performance trends over time

### 🔍 Advanced Search & Discovery

- **Multi-type Search**: Unified search for frames and users with relevance scoring
- **Smart Filtering**: Filter by layout type (2x1/3x1/4x1), tags, official status, user roles
- **Flexible Sorting**: Sort by relevance, newest, most liked, most used, or alphabetical
- **Pagination Support**: Efficient cursor-based pagination with configurable limits
- **Intelligent Discovery**: Hybrid algorithm with weighted scoring
  - **Trending Score (40%)**: Recent engagement velocity with time decay
  - **Engagement Score (30%)**: Total likes and usage count
  - **Momentum Score (20%)**: Recent activity growth rate
  - **Random Factor (10%)**: Serendipity boost for content exploration

### 🎂 Birthday & Celebration System

- **One-time Birthday Setting**: Users can set birthday once (prevents manipulation)
- **Automated Daily Check**: Background service checks birthdays at midnight
- **24-Hour Birthday Badge**: Special visual indicator for birthday users
- **Real-time Celebrations**: WebSocket notifications to followers
- **Birthday Analytics**: Track and celebrate user milestones in stats

### 📢 Broadcasting & Communication

- **Admin Broadcasting**: Send targeted messages to specific user groups or all users
- **Delivery Tracking**: Monitor message reach and read status
- **User Targeting**: Filter by role (basic, verified, premium, official)
- **Real-time Delivery**: Instant WebSocket push notifications
- **Broadcast History**: Track all sent broadcasts with analytics

### 🖼️ Profile & Image Management

- **Custom Profile Images**: Upload profile pictures with automatic resizing (5MB limit)
- **Google OAuth Integration**: Seamless fallback to Google profile images
- **Flexible Switching**: Toggle between custom and Google OAuth images
- **Image Optimization**: Automatic processing and storage management
- **Display Preferences**: User-controlled image source selection

## 🎬 Live Photo Feature

### Overview

Live Photos are 3-second videos captured during the frame countdown that merge with frame overlays to create animated memories. The feature uses a role-based permission system to balance feature access with storage costs.

### How It Works

1. **Frontend**: Records 3-second video during countdown
2. **Processing**: Merges video with frame overlay
3. **Upload**: Sends both images and video files to backend
4. **Storage**: Role-based save or download-only response
5. **Delivery**: CDN-served URLs for playback
6. **Cleanup**: Automated TTL-based deletion

### Supported Formats

- **Video**: MP4, WebM, GIF (50MB per file, 5 files max)
- **Images**: JPEG, PNG, GIF, WebP, SVG, AVIF (5MB per file, 5 files max)

### Permission Model

| User Role | Can Create | Can Save | TTL       | Download Required |
| --------- | ---------- | -------- | --------- | ----------------- |
| Basic     | ✅ Yes     | ❌ No    | N/A       | ✅ Immediately    |
| Verified  | ✅ Yes     | ✅ Yes   | 3 days    | ⚪ Optional       |
| Premium   | ✅ Yes     | ✅ Yes   | 7 days    | ⚪ Optional       |
| Official  | ✅ Yes     | ✅ Yes   | Unlimited | ⚪ Optional       |

### API Usage

```javascript
// Check user's live photo permissions
const response = await fetch("/api/auth/me", {
  headers: { Authorization: `Bearer ${token}` },
});
const { permissions, limits } = response.data.user;

// Create live photo (all users)
const formData = new FormData();
formData.append("frame_id", frameId);
formData.append("title", "My Live Photo");
formData.append("livePhoto", "true");
images.forEach((img) => formData.append("images", img));
videos.forEach((vid) => formData.append("video_files", vid));

const result = await fetch(`/api/user/${username}/photo/capture`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});

// Response for basic users (download-only)
{
  "success": true,
  "message": "Live photo created successfully. Download immediately (not saved to server)",
  "data": {
    "photo": {
      "download_only": true,
      "images": ["https://cdn.com/image1.jpg"],
      "video_files": ["https://cdn.com/video1.mp4"],
      "createdAt": "2025-10-12T10:30:00.000Z"
    }
  },
  "notice": "Basic users must download live photos immediately. Upgrade to Verified to save for 3 days."
}

// Response for verified+ users (saved)
{
  "success": true,
  "message": "Photo captured successfully",
  "data": {
    "photo": {
      "id": "photo_id_here",
      "livePhoto": true,
      "images": ["https://cdn.com/image1.jpg"],
      "video_files": ["https://cdn.com/video1.mp4"],
      "expires_at": "2025-10-15T10:30:00.000Z"
    }
  }
}
```

### Technical Implementation

- **Model**: `Photo.js` with `livePhoto` boolean and `video_files` array
- **Upload Handler**: Dual field multer configuration (`images` + `video_files`)
- **Permission Check**: `RolePolicy.canSaveLivePhoto()` function
- **TTL Calculation**: `RolePolicy.calculateLivePhotoExpiry()` function
- **Cleanup Service**: `photoCleanupService.js` with video file deletion
- **File Storage**: Local filesystem at `images/photos/` directory

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

- **API Performance**: Response times, error rates, request throughput
- **Database**: Query performance, connection pool status, index efficiency
- **User Engagement**: Likes, frame uses, photo uploads, follows, collaborations
- **Real-time Events**: WebSocket connections, notification delivery rates
- **Social Patterns**: Follow relationships, mutual connections, engagement trends
- **Content Metrics**: Frame approval rates, report resolution times, ticket status
- **Storage**: File upload sizes, video file count, cleanup efficiency

### Key Statistics Endpoints

```javascript
// Server Health & Stats
GET /api/admin/serverHealth
{
  "uptime": "5d 12h 30m",
  "memory": { "used": "245MB", "total": "512MB" },
  "database": { "status": "connected", "latency": "15ms" },
  "counts": {
    "users": 1250,
    "frames": 3420,
    "photos": 8930,
    "livePhotos": 2340,
    "collaborations": 567
  },
  "websocket": { "connected": 89 }
}

// User Statistics
GET /api/user/{username}/stats
{
  "public_frames": {
    "total": 15,
    "total_likes_received": 234,
    "total_uses_received": 567
  },
  "photos": { "total": 42, "live_photos": 12 },
  "social": {
    "followers": 89,
    "following": 123,
    "mutual_follows": 34
  }
}
```

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
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_discord_server_id
DISCORD_CHANNEL_ID=your_admin_channel_id
DISCORD_ADMIN_IDS=admin_user_id1,admin_user_id2
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your/webhook
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
