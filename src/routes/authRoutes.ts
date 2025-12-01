import { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.ts";

// Helper function to generate JWT token
function generateToken(userId: string, role: string): string {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || "task-manager-secret",
    { expiresIn: "7d" }
  );
}

// POST - Register User
export async function registerUser(req: Request, res: Response) {
  const { username, email, password, role } = req.body;

  // Basic validation
  if (!username || !email || !password) {
    return res.status(400).send({
      success: false,
      message: "Please provide username, email, and password.",
    });
  }

  // Check if user already exists
  const isUserExisted = await User.findOne({ $or: [{ email }, { username }] });
  if (isUserExisted)
    return res.status(409).send({
      success: false,
      message: "User already exists with this email or username.",
    });

  // Create new user (password is hashed by pre-save hook)
  const newUser = await User.create({
    username,
    email,
    password,
    role: role && role.toLowerCase(),
  });

  if (!newUser) {
    return res.status(500).send({
      success: false,
      message: "Failed to register user. Please try again.",
    });
  }

  // Generate token after successful registration (auto-login)
  const token = generateToken(newUser._id.toString(), newUser.role);

  res.status(201).send({
    success: true,
    data: {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      token,
    },
    message: "User registered successfully.",
  });
}

// POST - Login User
export async function loginUser(req: Request, res: Response) {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).send({
      success: false,
      message: "Please provide email and password.",
    });
  }

  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).send({
      success: false,
      message: "Invalid email or password.",
    });
  }

  // Compare passwords
  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    return res.status(401).send({
      success: false,
      message: "Invalid email or password.",
    });
  }

  // Generate token for valid user
  const token = generateToken(user._id.toString(), user.role);

  res.status(200).send({
    success: true,
    data: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      token,
    },
    message: "Login successful.",
  });
}
