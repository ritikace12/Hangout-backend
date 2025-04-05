import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
  try {
    let token;
    
    // Check for token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    // If no token in header, check for cookie
    if (!token) {
      token = req.cookies.jwt;
    }
    
    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.userId).select("-password");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      console.error("Token verification error:", error);
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
