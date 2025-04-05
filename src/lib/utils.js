import jwt from "jsonwebtoken";

export const generateToken = (userId, res) => {
  try {
    // Generate JWT token
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: "15d", algorithm: "HS256" }
    );

    // Set cookie for cookie-based authentication
    res.cookie("jwt", token, {
      httpOnly: true,
      maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/"
    });

    // Return token for token-based authentication
    return token;
  } catch (error) {
    console.error("Error generating token:", error);
    throw new Error("Failed to generate authentication token");
  }
};

