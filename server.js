// server.js - Socket.IO Server for Real-time Features
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO server
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.SOCKET_IO_CORS_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
  });

  // Store active users and their socket connections
  const activeUsers = new Map();
  const projectRooms = new Map();

  // Middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const userId = socket.handshake.auth.userId;
    const userRole = socket.handshake.auth.userRole;

    if (!userId) {
      return next(new Error('Authentication error'));
    }

    socket.userId = userId;
    socket.userRole = userRole;
    next();
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const userRole = socket.userRole;

    if (process.env.ENABLE_SOCKET_LOGGING === 'true') {
      console.log(`User connected: ${userId} (${userRole})`);
    }

    // Store user connection
    activeUsers.set(userId, {
      socketId: socket.id,
      userRole,
      lastSeen: new Date(),
      isOnline: true
    });

    // Join user to their personal room
    socket.join(`user_${userId}`);

    // Emit user online status to relevant users
    socket.broadcast.emit('user_status_change', {
      userId,
      status: 'online',
      lastSeen: new Date()
    });

    // Join project rooms
    socket.on('join_project', (projectId) => {
      socket.join(`project_${projectId}`);
      
      if (!projectRooms.has(projectId)) {
        projectRooms.set(projectId, new Set());
      }
      projectRooms.get(projectId).add(userId);

      // Notify others in the project
      socket.to(`project_${projectId}`).emit('user_joined_project', {
        userId,
        userRole,
        projectId
      });

      if (process.env.ENABLE_SOCKET_LOGGING === 'true') {
        console.log(`User ${userId} joined project ${projectId}`);
      }
    });

    // Leave project rooms
    socket.on('leave_project', (projectId) => {
      socket.leave(`project_${projectId}`);
      
      if (projectRooms.has(projectId)) {
        projectRooms.get(projectId).delete(userId);
      }

      socket.to(`project_${projectId}`).emit('user_left_project', {
        userId,
        projectId
      });
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      socket.to(`project_${data.projectId}`).emit('user_typing', {
        userId,
        projectId: data.projectId,
        isTyping: true
      });
    });

    socket.on('stop_typing', (data) => {
      socket.to(`project_${data.projectId}`).emit('user_typing', {
        userId,
        projectId: data.projectId,
        isTyping: false
      });
    });

    // Handle real-time messages
    socket.on('send_message', (data) => {
      const messageData = {
        ...data,
        senderId: userId,
        timestamp: new Date().toISOString(),
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      // Send to project room
      if (data.projectId) {
        io.to(`project_${data.projectId}`).emit('new_message', messageData);
      }

      // Send to specific recipient if direct message
      if (data.recipientId) {
        io.to(`user_${data.recipientId}`).emit('new_message', messageData);
      }

      if (process.env.ENABLE_SOCKET_LOGGING === 'true') {
        console.log(`Message sent from ${userId} to project ${data.projectId}`);
      }
    });

    // Handle real-time notifications
    socket.on('send_notification', (data) => {
      const notificationData = {
        ...data,
        timestamp: new Date().toISOString(),
        notificationId: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      // Send to specific user
      if (data.recipientId) {
        io.to(`user_${data.recipientId}`).emit('new_notification', notificationData);
      }

      // Send to project members
      if (data.projectId) {
        socket.to(`project_${data.projectId}`).emit('new_notification', notificationData);
      }
    });

    // Handle project updates
    socket.on('project_update', (data) => {
      const updateData = {
        ...data,
        timestamp: new Date().toISOString(),
        userId
      };

      socket.to(`project_${data.projectId}`).emit('project_updated', updateData);
    });

    // Handle task updates
    socket.on('task_update', (data) => {
      const updateData = {
        ...data,
        timestamp: new Date().toISOString(),
        userId
      };

      socket.to(`project_${data.projectId}`).emit('task_updated', updateData);
    });

    // Handle file uploads
    socket.on('file_uploaded', (data) => {
      const fileData = {
        ...data,
        timestamp: new Date().toISOString(),
        uploadedBy: userId
      };

      socket.to(`project_${data.projectId}`).emit('new_file', fileData);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      // Update user status
      if (activeUsers.has(userId)) {
        activeUsers.set(userId, {
          ...activeUsers.get(userId),
          isOnline: false,
          lastSeen: new Date()
        });
      }

      // Clean up project rooms
      projectRooms.forEach((users, projectId) => {
        if (users.has(userId)) {
          users.delete(userId);
          socket.to(`project_${projectId}`).emit('user_left_project', {
            userId,
            projectId
          });
        }
      });

      // Notify others about offline status
      socket.broadcast.emit('user_status_change', {
        userId,
        status: 'offline',
        lastSeen: new Date()
      });

      if (process.env.ENABLE_SOCKET_LOGGING === 'true') {
        console.log(`User disconnected: ${userId}`);
      }
    });

    // Handle heartbeat for connection health
    socket.on('ping', () => {
      socket.emit('pong');
      
      if (activeUsers.has(userId)) {
        activeUsers.set(userId, {
          ...activeUsers.get(userId),
          lastSeen: new Date()
        });
      }
    });
  });

  // API endpoint to get active users (for admin dashboard)
  httpServer.on('request', (req, res) => {
    if (req.url === '/api/socket/active-users' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        activeUsers: Array.from(activeUsers.entries()).map(([userId, data]) => ({
          userId,
          ...data,
          socketId: undefined // Don't expose socket IDs
        })),
        totalConnections: io.engine.clientsCount
      }));
      return;
    }
  });

  // Cleanup inactive users every 5 minutes
  setInterval(() => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    activeUsers.forEach((userData, userId) => {
      if (!userData.isOnline && userData.lastSeen < fiveMinutesAgo) {
        activeUsers.delete(userId);
      }
    });
  }, 5 * 60 * 1000);

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`🚀 Server ready on http://${hostname}:${port}`);
      console.log(`📡 Socket.IO server initialized`);
    });
});