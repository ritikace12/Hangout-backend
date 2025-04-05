import jwt from "jsonwebtoken";

export const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "3d" });
  
  // Set cookie for cookie-based authentication
  res.cookie("jwt", token, {
    maxAge: 3 * 24 * 60 * 60 * 1000,
    httpOnly: true, // prevent client side js from accessing the cookie
    sameSite: "none", // allow cross-site requests
    secure: true, // always send the cookie over https
  });

  // Return token for token-based authentication
  return token;
};

