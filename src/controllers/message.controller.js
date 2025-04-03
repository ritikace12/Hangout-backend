import User from "../models/user.model.js";
import Message from "../models/message.model.js"; 

import cloudinary from "cloudinary";


export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId }
    }).select("-password");

    console.log("Filtered users:", filteredUsers); // Debug log
    
    res.status(200).json({ filteredUsers });
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate('senderId', 'fullName profilePic')
      .populate('receiverId', 'fullName profilePic');

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!receiverId) {
      return res.status(400).json({ message: "Receiver ID is required" });
    }

    let imageUrl;
    if (image) {
      const uploadedResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadedResponse.secure_url;
    }

    const newMessage = new Message({
      text,
      image: imageUrl,
      senderId,
      receiverId,
    });

    await newMessage.save();

    const populatedMessage = await Message.findById(newMessage._id)
      .populate('senderId', 'fullName profilePic')
      .populate('receiverId', 'fullName profilePic');

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};   

export const getLastMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get all users except current user
    const users = await User.find({ _id: { $ne: userId } });
    
    // Get last message for each user
    const lastMessages = {};
    
    for (const user of users) {
      const message = await Message.findOne({
        $or: [
          { senderId: userId, receiverId: user._id },
          { senderId: user._id, receiverId: userId }
        ]
      })
      .sort({ createdAt: -1 })
      .populate('senderId', 'fullName profilePic')
      .populate('receiverId', 'fullName profilePic');
      
      if (message) {
        lastMessages[user._id] = message;
      }
    }
    
    res.json(lastMessages);
  } catch (error) {
    console.error("Error in getLastMessages:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};   

