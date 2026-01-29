import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

export const registerController = async (req, res) => {
  try {
    console.log('Registration attempt:', { 
      username: req.body.username, 
      email: req.body.email, 
      role: req.body.role 
    });

    const { username, email, password, role } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ message: "Username, email, and password are required" });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ 
      username, 
      email, 
      password: hashedPassword, 
      role: role || 'viewer',
      organization: req.body.organization
    });
    
    await user.save();
    console.log('User created successfully:', user.email);

    const token = generateToken(user._id);
    
    // Remove password from response
    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      organization: user.organization,
      isActive: user.isActive
    };
    
    res.status(201).json({ message: "Registered successfully", token, user: userResponse });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
};

export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);
    res.json({ message: "Login successful", token, user });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
};

export const roleLoginController = async (req, res) => {
  try {
    const { email, password, requiredRole } = req.body;

    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const roleHierarchy = { 'viewer': 1, 'editor': 2, 'admin': 3 };
    if (roleHierarchy[user.role] < roleHierarchy[requiredRole]) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const token = generateToken(user._id);
    res.json({ message: "Login successful", token, user });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
};

export const getCurrentUserController = async (req, res) => {
  res.json({ user: req.user });
};

export const refreshTokenController = async (req, res) => {
  try {
    const { _id } = req.user;
    const token = generateToken(_id);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Token refresh failed" });
  }
};