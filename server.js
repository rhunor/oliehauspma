// server.js (Custom server for Socket.IO)
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const server = createServer();
  const io = new Server(server, {
    cors: {
      origin: dev ? "http://localhost:3000" : process.env.NEXT_PUBLIC_APP_URL,
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Store user connections
  const userConnections = new Map();
  const projectRooms = new Map();

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle user authentication
    socket.on('authenticate', (data) => {
      const { userId, userRole } = data;
      socket.userId = userId;
      socket.userRole = userRole;
      userConnections.set(userId, socket.id);
      
      // Emit user online status to all connected users
      socket.broadcast.emit('user_online', { userId });
      
      console.log(`User ${userId} authenticated with role ${userRole}`);
    });

    // Join project room
    socket.on('join_project', (projectId) => {
      socket.join(`project:${projectId}`);
      
      if (!projectRooms.has(projectId)) {
        projectRooms.set(projectId, new Set());
      }
      projectRooms.get(projectId).add(socket.userId);
      
      // Notify others in the project that user joined
      socket.to(`project:${projectId}`).emit('user_joined_project', {
        userId: socket.userId,
        projectId
      });
      
      console.log(`User ${socket.userId} joined project ${projectId}`);
    });

    // Leave project room
    socket.on('leave_project', (projectId) => {
      socket.leave(`project:${projectId}`);
      
      if (projectRooms.has(projectId)) {
        projectRooms.get(projectId).delete(socket.userId);
      }
      
      socket.to(`project:${projectId}`).emit('user_left_project', {
        userId: socket.userId,
        projectId
      });
      
      console.log(`User ${socket.userId} left project ${projectId}`);
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { projectId, content, messageType = 'text', recipient = null } = data;
        
        // Save message to database (you'll implement this API endpoint)
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            senderId: socket.userId,
            recipient,
            content,
            messageType
          })
        });
        
        if (response.ok) {
          const savedMessage = await response.json();
          
          // Emit to project room or specific user
          if (recipient) {
            // Private message
            const recipientSocketId = userConnections.get(recipient);
            if (recipientSocketId) {
              io.to(recipientSocketId).emit('message_received', savedMessage.data);
            }
            // Also send to sender
            socket.emit('message_sent', savedMessage.data);
          } else {
            // Project group message
            io.to(`project:${projectId}`).emit('message_received', savedMessage.data);
          }
        }
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (projectId) => {
      socket.to(`project:${projectId}`).emit('user_typing_start', {
        userId: socket.userId,
        projectId
      });
    });

    socket.on('typing_stop', (projectId) => {
      socket.to(`project:${projectId}`).emit('user_typing_stop', {
        userId: socket.userId,
        projectId
      });
    });

    // Handle notifications
    socket.on('send_notification', async (data) => {
      try {
        const { recipientId, type, title, message, data: notificationData } = data;
        
        // Save notification to database
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientId,
            senderId: socket.userId,
            type,
            title,
            message,
            data: notificationData
          })
        });
        
        if (response.ok) {
          const savedNotification = await response.json();
          
          // Send real-time notification to recipient
          const recipientSocketId = userConnections.get(recipientId);
          if (recipientSocketId) {
            io.to(recipientSocketId).emit('notification_received', savedNotification.data);
          }
        }
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    });

    // Handle marking notifications as read
    socket.on('mark_notification_read', async (notificationId) => {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/${notificationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: true })
        });
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    });

    // Handle task updates
    socket.on('task_updated', (data) => {
      const { projectId, taskData } = data;
      socket.to(`project:${projectId}`).emit('task_updated', taskData);
    });

    // Handle project updates
    socket.on('project_updated', (data) => {
      const { projectId, projectData } = data;
      socket.to(`project:${projectId}`).emit('project_updated', projectData);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      if (socket.userId) {
        userConnections.delete(socket.userId);
        
        // Remove user from all project rooms
        for (const [projectId, users] of projectRooms.entries()) {
          if (users.has(socket.userId)) {
            users.delete(socket.userId);
            socket.to(`project:${projectId}`).emit('user_left_project', {
              userId: socket.userId,
              projectId
            });
          }
        }
        
        // Emit user offline status
        socket.broadcast.emit('user_offline', { userId: socket.userId });
      }
      
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  server.on('request', (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
