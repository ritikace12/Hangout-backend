import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/user.model.js';

dotenv.config();

const createTestUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Delete existing test users
    await User.deleteMany({ email: /test@example\.com$/ });

    const testUsers = [
      {
        fullName: "Test User 1",
        email: "test1@example.com",
        password: "password123",
      },
      {
        fullName: "Test User 2",
        email: "test2@example.com",
        password: "password123",
      },
      {
        fullName: "Test User 3",
        email: "test3@example.com",
        password: "password123",
      }
    ];

    for (const userData of testUsers) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      const user = new User({
        ...userData,
        password: hashedPassword,
      });

      await user.save();
      console.log(`Created test user: ${userData.email}`);
    }

    console.log('Test users created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating test users:', error);
    process.exit(1);
  }
};

createTestUsers(); 