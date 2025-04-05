import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"
import cors from "cors"
import { Server } from "socket.io"
import { createServer } from "http"
import fileUpload from 'express-fileupload'
import Message from "./models/message.model.js"

import authRoutes from "./routes/auth.route.js"
import messageRoutes from "./routes/message.route.js"
import { connectDB } from "./lib/db.js"

dotenv.config()
const app = express()
const server = createServer(app)

// Socket.io setup with optimized configuration
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://hangout-12.netlify.app"],
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  path: '/socket.io/',
  allowEIO3: true,
  allowUpgrades: true,
  cookie: {
    name: "io",
    httpOnly: true,
    sameSite: "none",
    secure: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  connectTimeout: 45000,
  maxHttpBufferSize: 1e8
})

// Middlewares
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))
app.use(cookieParser())
app.use(cors({
  origin: ["http://localhost:5173", "https://hangout-12.netlify.app"],
  credentials: true
}))
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max file size
}))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/messages", messageRoutes)

// Socket.io connection handling with improved error handling and logging
const userSocketMap = new Map()
const messageQueue = new Map() // Store offline messages

io.on("connection", (socket) => {
  console.log("New client connected:", {
    socketId: socket.id,
    handshake: socket.handshake,
    headers: socket.handshake.headers
  });

  socket.on("setup", async (userData) => {
    try {
      console.log("Socket setup received:", { userData });
      if (userData?._id) {
        // Store both userId and socketId for better tracking
        userSocketMap.set(userData._id, {
          socketId: socket.id,
          lastSeen: new Date()
        });
        socket.userId = userData._id;
        
        // Check for queued messages
        const queuedMessages = messageQueue.get(userData._id) || [];
        if (queuedMessages.length > 0) {
          // Send all queued messages
          queuedMessages.forEach(msg => {
            socket.emit("message-received", msg);
          });
          messageQueue.delete(userData._id);
        }

        // Broadcast updated online users list
        const onlineUsers = Array.from(userSocketMap.keys());
        io.emit("online-users", onlineUsers);
        
        console.log("User socket mapping updated:", {
          userId: userData._id,
          socketId: socket.id,
          totalConnections: userSocketMap.size,
          onlineUsers
        });
      }
    } catch (error) {
      console.error("Error in socket setup:", error);
      socket.emit("error", { message: "Failed to setup socket connection" });
    }
  });

  socket.on("send-message", async (message) => {
    try {
      console.log("Received send-message event:", {
        message,
        receiverId: message.receiverId,
        senderId: message.senderId
      });
      
      const receiverSocket = userSocketMap.get(message.receiverId);
      console.log("Receiver socket lookup:", {
        receiverId: message.receiverId,
        foundSocket: receiverSocket
      });
      
      // Always emit to sender to show message immediately
      socket.emit("message-sent", message);
      
      if (receiverSocket) {
        io.to(receiverSocket.socketId).emit("message-received", message);
        console.log("Message forwarded to receiver");
        
        // Update message status to delivered
        await Message.findByIdAndUpdate(message._id, {
          status: "delivered",
          deliveredAt: new Date()
        });
        
        // Notify sender about delivery
        socket.emit("message-status", {
          messageId: message._id,
          status: "delivered"
        });
      } else {
        console.log("Receiver not found in socket map");
        // Queue message for offline user
        const queuedMessages = messageQueue.get(message.receiverId) || [];
        queuedMessages.push(message);
        messageQueue.set(message.receiverId, queuedMessages);
        
        // Update message status to queued
        await Message.findByIdAndUpdate(message._id, {
          status: "queued"
        });

        // Notify sender about offline status
        socket.emit("message-status", {
          messageId: message._id,
          status: "queued",
          receiverId: message.receiverId
        });
      }
    } catch (error) {
      console.error("Error in send-message handler:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  socket.on("message-read", async ({ messageId, receiverId }) => {
    try {
      // Update message status to read
      await Message.findByIdAndUpdate(messageId, {
        status: "read"
      });

      // Notify sender that message was read
      const senderSocketId = userSocketMap.get(receiverId);
      if (senderSocketId) {
        io.to(senderSocketId.socketId).emit("message-status", {
          messageId,
          status: "read"
        });
      }
    } catch (error) {
      console.error("Error in message-read handler:", error);
    }
  });

  socket.on("typing", ({ receiverId, isTyping }) => {
    try {
      const receiverSocketId = userSocketMap.get(receiverId)
      if (receiverSocketId) {
        io.to(receiverSocketId.socketId).emit("typing-status", {
          userId: socket.userId,
          isTyping
        })
      }
    } catch (error) {
      console.error("Error in typing handler:", error);
    }
  })

  socket.on("disconnect", () => {
    try {
      console.log("Client disconnected:", {
        socketId: socket.id,
        userId: socket.userId
      });
      if (socket.userId) {
        userSocketMap.delete(socket.userId);
        // Broadcast updated online users list
        const onlineUsers = Array.from(userSocketMap.keys());
        io.emit("online-users", onlineUsers);
        console.log("User removed from socket map, online users:", onlineUsers);
      }
    } catch (error) {
      console.error("Error in disconnect handler:", error);
    }
  })

  // Keep track of user's last seen
  setInterval(() => {
    if (socket.userId) {
      const userSocket = userSocketMap.get(socket.userId);
      if (userSocket) {
        userSocket.lastSeen = new Date();
        userSocketMap.set(socket.userId, userSocket);
      }
    }
  }, 30000); // Update every 30 seconds

  socket.on("error", (error) => {
    console.error("Socket error:", error);
    socket.emit("error", { message: "An error occurred" });
  });
})

const PORT = process.env.PORT || 5001

server.listen(PORT, () => {
  connectDB()
  console.log(`Server running on port ${PORT}`)
})

