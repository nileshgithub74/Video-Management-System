# Video Management System (VMS)

A full-stack video management application built with React, Node.js, Express, and MongoDB.

## Features

- 🎥 Video upload and processing
- 👥 User authentication and role management
- 🔒 Content safety analysis
- 📊 Dashboard with analytics
- 🎬 Video library with search and filters
- 📱 Responsive design
- ⚡ Real-time processing updates

## Tech Stack

### Frontend
- React 18
- Tailwind CSS
- React Router
- Axios
- Socket.io Client
- Lucide React Icons

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- Socket.io
- JWT Authentication
- Multer (file uploads)
- Helmet (security)

## Quick Start

### Prerequisites
- Node.js 16+ and npm 8+
- MongoDB database

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd video-management-system
```

2. Install dependencies
```bash
npm run install-all
```

3. Set up environment variables
```bash
cp server/.env.example server/.env
# Edit server/.env with your configuration
```

4. Build and start
```bash
npm run build
npm start
```

### Development

Start both client and server in development mode:

```bash
# Terminal 1 - Client (http://localhost:5173)
npm run dev-client

# Terminal 2 - Server (http://localhost:5000)
npm run dev-server
```

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   └── ...
├── server/                 # Node.js backend
│   ├── controllers/        # Route controllers
│   ├── models/            # MongoDB models
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── utils/             # Utility functions
│   └── uploads/           # File uploads
└── package.json           # Root package.json
```

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/videos` - Get videos
- `POST /api/videos/upload` - Upload video
- `GET /api/users` - Get users (admin only)

## Deployment

The application is configured for deployment on platforms like Render, Heroku, or Railway.

See deployment configuration in:
- `package.json` - Build and start scripts
- `render.yaml` - Render deployment config
- `Dockerfile` - Docker deployment

## License

MIT License