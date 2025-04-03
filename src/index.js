import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"
import cors from "cors"
import { Server } from "socket.io"
import { createServer } from "http"

import authRoutes from "./routes/auth.route.js"
import messageRoutes from "./routes/message.route.js"
import { connectDB } from "./lib/db.js"

dotenv.config()
const app = express()
const server = createServer(app)

// Socket.io setup
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
  }
})

// Middlewares
app.use(express.json({ limit: "50mb" }))
app.use(cookieParser())
app.use(cors({
  origin: ["http://localhost:5173", "https://hangout-12.netlify.app"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Set-Cookie"],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/messages", messageRoutes)

// Socket.io connection handling
const userSocketMap = new Map()

io.on("connection", (socket) => {
  console.log("New client connected:", {
    socketId: socket.id,
    handshake: socket.handshake,
    headers: socket.handshake.headers
  });

  socket.on("setup", (userData) => {
    console.log("Socket setup received:", { userData });
    if (userData?._id) {
      // Store user socket mapping
      userSocketMap.set(userData._id, socket.id);
      socket.userId = userData._id; // Store userId in socket object
      console.log("User socket mapping updated:", {
        userId: userData._id,
        socketId: socket.id,
        totalConnections: userSocketMap.size
      });
      io.emit("online-users", Array.from(userSocketMap.keys()));
    }
  });

  socket.on("send-message", async (message) => {
    console.log("Received send-message event:", {
      message,
      receiverId: message.receiverId,
      senderId: message.senderId
    });
    
    const receiverSocketId = userSocketMap.get(message.receiverId);
    console.log("Receiver socket lookup:", {
      receiverId: message.receiverId,
      foundSocketId: receiverSocketId
    });
    
    if (receiverSocketId) {
      // Send to specific user
      io.to(receiverSocketId).emit("message-received", message);
      console.log("Message forwarded to receiver");
    } else {
      console.log("Receiver not found in socket map");
    }
  });

  socket.on("typing", ({ receiverId, isTyping }) => {
    const receiverSocketId = userSocketMap.get(receiverId)
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing-status", {
        userId: socket.userId,
        isTyping
      })
    }
  })

  socket.on("disconnect", () => {
    console.log("Client disconnected:", {
      socketId: socket.id,
      userId: socket.userId
    });
    if (socket.userId) {
      userSocketMap.delete(socket.userId);
      io.emit("online-users", Array.from(userSocketMap.keys()));
      console.log("User removed from socket map");
    }
  })
})

const PORT = process.env.PORT || 5001

server.listen(PORT, () => {
  connectDB()
  console.log(`Server running on port ${PORT}`)
})

