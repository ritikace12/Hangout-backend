import jwt from "jsonwebtoken";

export const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "3d" });
  res.cookie("jwt", token, {
    maxAge: 3 * 24 * 60 * 60 * 1000,
    httpOnly: true, // prevent client side js from accessing the cookie
    sameSite: "strict", // prevent csrf attacks
    secure: process.env.NODE_ENV !== "development", // only send the cookie over https in production
  });

  return token;
};

