import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request type to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      };
    }
  }
}

/**
 * middleware to authenticate JWT token from request
 * @param req : Request
 * @param res : Response
 * @param next : NextFunction
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Get token from multiple sources (Authorization header, cookies, or body)
    let token =
      req.headers.authorization?.split(" ")[1] || // Bearer <token>
      req.cookies?.token ||
      req.body?.token;

    // Validate token exists
    if (!token) {
      return res.status(401).send({
        success: false,
        message: "No token provided, authorization denied. Please log in.",
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "task-manager-secret"
    ) as { id: string; role: string };
    console.log("Decoded JWT:", decoded);
    // Attach user data to request object for use in protected routes
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).send({
        success: false,
        message: "Token has expired. Please log in again.",
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).send({
        success: false,
        message: "Invalid token. Authorization denied.",
      });
    }

    return res.status(500).send({
      success: false,
      message: "Authentication error. Please try again.",
    });
  }
}

// Middleware to check for admin role
export async function isAdminMiddleware(req: Request,res: Response,next: NextFunction){
    console.log("User role:", req.user?.role);
    if(req.user?.role !== "admin"){
        return res.status(403).send({
            success: false,
            message: "Access denied. Admins only.",
        });
    }
    return next();
}