# 🎥 Video Management System (VMS)

> **Enterprise-grade video management platform with AI-powered content safety analysis**

## 🌟 Overview

VMS is a full-stack video management platform that combines secure video streaming with AI-powered content moderation. Built with modern technologies, it provides role-based access control, real-time processing updates, and automated content safety analysis using Google's Gemini AI.

## ✨ Key Features

- 🤖 **AI-Powered Content Safety** - Automated analysis using Google Gemini Vision
- 🔐 **Role-Based Access Control** - Admin/Editor/Viewer permissions
- ⚡ **Real-Time Processing** - Live progress updates via WebSocket
- 📺 **Advanced Video Streaming** - HTTP range requests for instant seeking
- 🛡️ **Enterprise Security** - JWT authentication with comprehensive validation
- 📊 **Analytics Dashboard** - User activity and content metrics

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Node.js API    │    │  MongoDB Atlas  │
│     (Vite)      │◄──►│   (Express)     │◄──►│   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────►│  Socket.IO      │◄─────────────┘
                        │  (Real-time)    │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │  Google Gemini  │
                        │  (AI Analysis)  │
                        └─────────────────┘
```


## 📁 Project Structure

```
video-management-system/
├── client/                     # React Frontend
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   │   ├── Layout.jsx      # Main layout
│   │   │   └── ProtectedRoute.jsx # Route protection
│   │   ├── contexts/           # React contexts
│   │   │   ├── AuthContext.jsx # Authentication
│   │   │   └── SocketContext.jsx # WebSocket
│   │   ├── pages/              # Page components
│   │   │   ├── Dashboard.jsx   # Main dashboard
│   │   │   ├── Login.jsx       # Authentication
│   │   │   ├── VideoLibrary.jsx # Video management
│   │   │   ├── VideoPlayer.jsx # Video streaming
│   │   │   ├── VideoUpload.jsx # File upload
│   │   │   └── UserManagement.jsx # Admin panel
│   │   ├── App.jsx             # Root component
│   │   └── main.jsx            # Entry point
│   ├── package.json
│   └── vite.config.js
├── server/                     # Node.js Backend
│   ├── config/
│   │   └── database.js         # MongoDB connection
│   ├── controllers/            # Route handlers
│   │   ├── authController.js   # Authentication logic
│   │   ├── videoController.js  # Video operations
│   │   └── userController.js   # User management
│   ├── middleware/             # Custom middleware
│   │   ├── auth.js             # JWT verification
│   │   └── upload.js           # File upload handling
│   ├── models/                 # Database schemas
│   │   ├── User.js             # User model
│   │   └── Video.js            # Video model
│   ├── routes/                 # API routes
│   ├── services/               # Business logic
│   │   └── videoProcessor.js   # AI processing
│   ├── utils/                  # Utility functions
│   ├── uploads/                # File storage
│   ├── server.js               # Main server file
│   └── package.json
└── README.md
```

## 🔧 Technology Stack

### Frontend (Client)
- **React 18** - Modern UI framework with hooks
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first styling
- **Socket.IO Client** - Real-time communication
- **Axios** - HTTP client for API calls
- **React Hot Toast** - Notification system
- **Lucide React** - Icon library

### Backend (Server)
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **Socket.IO** - Real-time bidirectional communication
- **JWT** - JSON Web Tokens for authentication
- **bcryptjs** - Password hashing
- **Multer** - File upload middleware
- **FFmpeg** - Video processing
- **Google Generative AI** - Content analysis

### Security & Infrastructure
- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Express Rate Limit** - API rate limiting
- **dotenv** - Environment variable management

## 🎯 Core Features

### 🔐 Authentication & Authorization

**Three-Tier Role System:**
- **Admin** - Full system access, user management, content moderation
- **Editor** - Upload videos, manage own content
- **Viewer** - View public, safe content only



### 🤖 AI-Powered Content Analysis

**Processing Pipeline:**
1. **Metadata Extraction** - Duration, resolution, codec, bitrate
2. **Frame Extraction** - Key frames for analysis
3. **AI Safety Check** - Google Gemini Vision analysis
4. **Result Processing** - Safety scoring and flagging


### ⚡ Real-Time Updates

**WebSocket Integration:**
- **Processing Status Updates** - Real-time job progress
- **Safety Analysis Results** - Immediate feedback
- **User Activity Monitoring** - Live dashboard updates
- **Error Notifications** - Instant problem alerts


### 📺 Advanced Video Streaming


**HTTP Range Requests:**
- **Seek Functionality** - Instant jumping to any point
- **Buffer Management** - Efficient memory usage
- **Progressive Loading** - Smooth playback experience
- **Bandwidth Optimization** - Adaptive streaming

## 🛠️ API Endpoints

### Authentication
```
POST /api/auth/register     # User registration
POST /api/auth/login        # User login
GET  /api/auth/me          # Get current user
POST /api/auth/refresh     # Refresh JWT token
```

### Video Management
```
POST /api/videos/upload     # Upload video (Editor/Admin)
GET  /api/videos           # List videos with filters
GET  /api/videos/:id       # Get video details
GET  /api/videos/:id/stream # Stream video content
PUT  /api/videos/:id       # Update video metadata
DELETE /api/videos/:id     # Delete video
PUT  /api/videos/:id/reject # Reject video (Admin)
```

### User Management (Admin Only)
```
GET  /api/users            # List all users
PUT  /api/users/:id/role   # Update user role
PUT  /api/users/:id/deactivate # Deactivate user
```


## 📈 Performance Features

- **Database Indexing** - Optimized queries for fast data retrieval
- **File Streaming** - Efficient video delivery with range requests
- **Real-time Updates** - WebSocket connections for live progress
- **Caching** - In-memory caching for frequently accessed data
- **Rate Limiting** - API protection against abuse
- **Compression** - Gzip compression for faster responses

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt with salt rounds
- **CORS Protection** - Whitelist-based origin validation
- **Rate Limiting** - Request throttling per IP
- **Input Validation** - Comprehensive data validation
- **File Type Validation** - Secure file upload restrictions
- **Role-Based Access** - Granular permission system

## 🐛 Troubleshooting

### Common Issues

**Server won't start:**
- Check MongoDB connection
- Verify environment variables
- Ensure port is not in use

**Client build fails:**
- Clear node_modules and reinstall
- Check for TypeScript errors
- Verify API URL configuration

**Video upload fails:**
- Check file size limits
- Verify upload directory permissions
- Ensure FFmpeg is installed

**AI analysis not working:**
- Verify Gemini API key
- Check API quota limits
- Ensure internet connectivity

## 📞 Support & Contributing

### Getting Help
- Check the troubleshooting section
- Review error logs in console
- Verify environment configuration
- Test API endpoints individually

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request
