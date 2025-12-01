import mongoose from "mongoose";

// Connection configuration with best practices
const mongooseOptions: mongoose.ConnectOptions = {
  retryWrites: true,
  w: "majority",
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4
};

// Function to connect to MongoDB
export default async function connectDB(): Promise<void> {
  try {
    // Validate required environment variable
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }

    await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
    console.log("MongoDB connected successfully");

    // Connection event listeners for monitoring
    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected");
    });

    mongoose.connection.on("error", (error: Error) => {
      console.error("MongoDB connection error:", error.message);
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected successfully");
    });

  } catch (error) {
    console.error("MongoDB connection failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
