import express, {type Application, type Request, type Response } from "express";
import dotenv from "dotenv";
import connectDB from "./config/connectDB.js";
import cors from "cors";
import { registerUser, loginUser } from "./routes/authRoutes.js";
import { createTask, getTasks, getTaskById, updateTask, deleteTask, getAllTasks } from "./routes/taskRoutes.js";
import { authMiddleware, isAdminMiddleware } from "./middleware/authMiddleware.js";

dotenv.config({path: "./src/.env"});
connectDB();

const app: Application = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(express.json());
app.use(cors(corsOptions));

// Health check
app.get("/", (_req: Request, res: Response) => {
  res.send("API is running...");
});

// Auth Routes
app.post("/api/v1/auth/register", registerUser);
app.post("/api/v1/auth/login", loginUser);

// Task Routes - CRUD Operations
// Create Task
app.post("/api/v1/tasks", authMiddleware, createTask);

// Get All Tasks for Current User
app.get("/api/v1/tasks",authMiddleware, getAllTasks);

// Get Single Task by ID
app.get("/api/v1/tasks/:taskId", authMiddleware, getTaskById);

// Update Task
app.put("/api/v1/tasks/:taskId", authMiddleware, updateTask);

// Delete Task
app.delete("/api/v1/tasks/:taskId", authMiddleware,isAdminMiddleware, deleteTask);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
