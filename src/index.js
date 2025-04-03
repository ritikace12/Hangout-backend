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
    origin: "http://localhost:5173",
    credentials: true,
  },
  pingTimeout: 60000,
})

// Middlewares
app.use(express.json({ limit: "50mb" }))
app.use(cookieParser())
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/messages", messageRoutes)

// Socket.io connection handling
const userSocketMap = new Map()

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id)

  socket.on("setup", (userData) => {
    if (userData?._id) {
      // Store user socket mapping
      userSocketMap.set(userData._id, socket.id)
      socket.userId = userData._id // Store userId in socket object
      io.emit("online-users", Array.from(userSocketMap.keys()))
    }
  })

  socket.on("send-message", async (message) => {
    const receiverSocketId = userSocketMap.get(message.receiverId)
    
    if (receiverSocketId) {
      // Send to specific user
      io.to(receiverSocketId).emit("message-received", message)
    }
  })

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
    if (socket.userId) {
      userSocketMap.delete(socket.userId)
      io.emit("online-users", Array.from(userSocketMap.keys()))
    }
  })
})

const PORT = process.env.PORT || 5001

server.listen(PORT, () => {
  connectDB()
  console.log(`Server running on port ${PORT}`)
})

