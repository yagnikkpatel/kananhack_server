import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import UserLog from "../models/UserLog.js";

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

export const registerUser = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ message: "Full name, email and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await UserLog.create({
        user: existingUser._id,
        email,
        action: "REGISTER",
        success: false,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        message: "Email already registered",
      });
      return res.status(409).json({ message: "Email is already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
    });

    const token = generateToken(user._id);

    await UserLog.create({
      user: user._id,
      email: user.email,
      action: "REGISTER",
      success: true,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: "User registered successfully",
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    console.error("Error in registerUser:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      await UserLog.create({
        email,
        action: "LOGIN",
        success: false,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        message: "User not found",
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await UserLog.create({
        user: user._id,
        email,
        action: "LOGIN",
        success: false,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        message: "Incorrect password",
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    await UserLog.create({
      user: user._id,
      email: user.email,
      action: "LOGIN",
      success: true,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: "Login successful",
    });

    return res.status(200).json({
      message: "Logged in successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    console.error("Error in loginUser:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

