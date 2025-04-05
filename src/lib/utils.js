import jwt from "jsonwebtoken";

export const generateToken = (res, userId) => {
  // Generate token with proper expiration
  const token = jwt.sign(
    { userId }, 
    process.env.JWT_SECRET, 
    { 
      expiresIn: "3d",
      algorithm: "HS256"
    }
  );
  
  // Set cookie for cookie-based authentication
  res.cookie("jwt", token, {
    maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/"
  });

  return token;
};

