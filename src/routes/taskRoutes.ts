import type { Request, Response } from "express";
import Task from "../models/Task.ts";
import mongoose from "mongoose";
import type { SortOrder } from "mongoose";


/**
 * Helper to parse pagination query params safely.
 */
function parsePaginationParams(req: Request) {
  const rawPage = Number(req.query.page ?? 1);
  const rawLimit = Number(req.query.limit ?? 10);

  const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : Math.floor(rawPage);
  // enforce a sensible max to avoid DoS or accidental huge queries
  const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(Math.floor(rawLimit), 100);

  return { page, limit };
}


// POST - Create Task
export async function createTask(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { title, description, status } = req.body;

    // Validation
    if (!title || title.trim() === "") {
      return res.status(400).send({
        success: false,
        message: "Title is required to create a task.",
      });
    }

    // Create task for this user
    const newTask = await Task.create({
      title: title.trim(),
      description: description?.trim() || "",
      status: status || "pending",
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    if (!newTask) {
      return res.status(500).send({
        success: false,
        message: "Failed to create task. Please try again.",
      });
    }

    res.status(201).send({
      success: true,
      data: newTask,
      message: "Task created successfully.",
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).send({
      success: false,
      message: "Internal server error while creating task.",
    });
  }
}

export async function getAllTasks(req: Request, res: Response) {
  try {
    const { page, limit } = parsePaginationParams(req);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const sortParam = typeof req.query.sort === "string" ? req.query.sort.trim() : "createdAt:desc";

    // build filter
    const filter: Record<string, any> = {};
    if (search) {
      // partial, case-insensitive match on title
      filter.title = { $regex: search, $options: "i" };
    }

    // parse sort param
    const [sortField = "createdAt", sortDir = "desc"] = sortParam.split(":");
    const sortObj: Record<string, SortOrder> = {};
    sortObj[sortField] = sortDir.toLowerCase() === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    // run count and query in parallel
    const [total, tasks] = await Promise.all([
      Task.countDocuments(filter),
      Task.find(filter)
        .populate("createdBy", "username email")
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).send({
      success: true,
      data: tasks,
      page,
      limit,
      total,
      totalPages,
      message: "Tasks fetched successfully.",
    });
  } catch (error) {
    console.error("Error fetching all tasks (paginated):", error);
    return res.status(500).send({
      success: false,
      message: "Internal server error while fetching tasks.",
    });
  }
}

/**
 * GET - Fetch Tasks for Authenticated User (paginated, optional search & sort)
 * Requires authentication (req.user?.id)
 * Same query params as getAllTasks
 */
export async function getTasks(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).send({
        success: false,
        message: "User not authenticated.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send({
        success: false,
        message: "Invalid user id.",
      });
    }

    const { page, limit } = parsePaginationParams(req);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const sortParam = typeof req.query.sort === "string" ? req.query.sort.trim() : "createdAt:desc";

    const filter: Record<string, any> = {
      createdBy: new mongoose.Types.ObjectId(userId),
    };
    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }

    const [sortField = "createdAt", sortDir = "desc"] = sortParam.split(":");
    const sortObj: Record<string, SortOrder> = {};
    sortObj[sortField] = sortDir.toLowerCase() === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    const [total, tasks] = await Promise.all([
      Task.countDocuments(filter),
      Task.find(filter)
        .populate("createdBy", "username email")
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).send({
      success: true,
      data: tasks,
      page,
      limit,
      total,
      totalPages,
      message: "Tasks fetched successfully.",
    });
  } catch (error) {
    console.error("Error fetching user tasks (paginated):", error);
    return res.status(500).send({
      success: false,
      message: "Internal server error while fetching tasks.",
    });
  }
}

// GET - Fetch Single Task by ID
export async function getTaskById(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { taskId } = req.params;

    if(!taskId) return res.status(400).send({
        success: false,
        message: "Task ID is required.",
      });

    // Validate taskId format
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).send({
        success: false,
        message: "Invalid task ID format.",
      });
    }

    // Find task and ensure it belongs to the authenticated user
    const task = await Task.findOne({
      _id: new mongoose.Types.ObjectId(taskId),
      createdBy: new mongoose.Types.ObjectId(userId),
    }).populate("createdBy", "username email");

    if (!task) {
      return res.status(404).send({
        success: false,
        message: "Task not found or you don't have permission to view it.",
      });
    }

    res.status(200).send({
      success: true,
      data: task,
      message: "Task fetched successfully.",
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).send({
      success: false,
      message: "Internal server error while fetching task.",
    });
  }
}

// PUT - Update Task
export async function updateTask(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { taskId } = req.params;
    const { title, description, status } = req.body;

    
    if(!taskId) return res.status(400).send({
        success: false,
        message: "Task ID is required.",
      });

    // Validate taskId format
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).send({
        success: false,
        message: "Invalid task ID format.",
      });
    }

    // Validate that at least one field is provided for update
    if (!title && !description && !status) {
      return res.status(400).send({
        success: false,
        message: "Please provide at least one field to update (title, description, or status).",
      });
    }

    // Validate status if provided
    if (status && !["pending", "completed"].includes(status)) {
      return res.status(400).send({
        success: false,
        message: "Status must be either 'pending' or 'completed'.",
      });
    }

    // Find task and ensure it belongs to the authenticated user
    const task = await Task.findOne({
      _id: new mongoose.Types.ObjectId(taskId),
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    if (!task) {
      return res.status(404).send({
        success: false,
        message: "Task not found or you don't have permission to update it.",
      });
    }

    // Update only provided fields
    if (title) task.title = title.trim();
    if (description) task.description = description.trim();
    if (status) task.status = status.toLowerCase();

    // Save updated task
    const updatedTask = await task.save();

    res.status(200).send({
      success: true,
      data: updatedTask,
      message: "Task updated successfully.",
    });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).send({
      success: false,
      message: "Internal server error while updating task.",
    });
  }
}

// DELETE - Delete Task
export async function deleteTask(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { taskId } = req.params;

    if(!taskId) return res.status(400).send({
      success: false,
      message: "Task ID is required.",
    });

    // Validate taskId format
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).send({
        success: false,
        message: "Invalid task ID format.",
      });
    }

    // Find and delete task (ensure it belongs to authenticated user)
    const deletedTask = await Task.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(taskId),
    });

    if (!deletedTask) {
      return res.status(404).send({
        success: false,
        message: "Task not found or you don't have permission to delete it.",
      });
    }

    res.status(200).send({
      success: true,
      data: deletedTask,
      message: "Task deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).send({
      success: false,
      message: "Internal server error while deleting task.",
    });
  }
}
