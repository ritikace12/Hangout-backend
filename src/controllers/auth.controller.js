import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";
import cloudinary from "../lib/cloudinary.js";

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: "email required" });
    }
    if (!fullName) {
      return res.status(400).json({ message: "Full Name required" });
    }
    if (!password) {
      return res.status(400).json({ message: "Password required" });
    }

    if (password.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters long" });
    }

    const user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await User.create({
      fullName,
      email,
      password: hashedPassword
    });

    if (newUser) {
      // Generate token and set cookie
      const token = generateToken(res, newUser._id);
      
      // Return user data and token
      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
        token
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.error("Error in signup controller:", error);
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate token and set cookie
    const token = generateToken(res, user._id);

    // Send user data without password and include token
    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      createdAt: user.createdAt,
      token
    });
  } catch (error) {
    console.error("Error in login controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = (req, res) => {
  try {
    // Clear the JWT cookie
    res.cookie("jwt", "", {
      maxAge: 0,
      httpOnly: true,
      sameSite: "none",
      secure: true,
      path: "/"
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in logout controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic, fullName } = req.body;
    const userId = req.user._id;

    let uploadedResponse;
    if (profilePic) {
      try {
        // Upload to cloudinary
        uploadedResponse = await cloudinary.uploader.upload(profilePic, {
          folder: "profile_pics",
          width: 500,
          height: 500,
          crop: "fill",
        });
      } catch (error) {
        console.error("Cloudinary upload error:", error);
        return res.status(500).json({ message: "Error uploading image" });
      }
    }

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        profilePic: uploadedResponse?.secure_url || req.user.profilePic,
        fullName: fullName || req.user.fullName
      },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error in updateProfile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = async (req, res) => {
  try {
    // If we get here, the user is authenticated
    res.status(200).json(req.user);
  } catch (error) {
    console.error("Error in checkAuth controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

