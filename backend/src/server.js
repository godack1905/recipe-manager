import mongoose from "mongoose";
import dotenv from "dotenv";
import app from "./app.js";

// Configure the environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;
const IP = process.env.IP;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/recipe_app";

// Configure mongoose
mongoose.set("strictQuery", true);

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  } catch (error) {
    process.exit(1);
  }
};

// Logout handler
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  process.exit(0);
});

// Start the server
const startServer = async () => {
  await connectDB();
  
  const server = app.listen(PORT, () => {
    console.log(`Server running in port ${PORT}`);
    console.log(`Enviroment: ${process.env.NODE_ENV || "development"}`);
    console.log(`URL: http://${IP}:${PORT}`);
  });

  // Handle server errors
  server.on("error", () => {
    process.exit(1);
  });
};

startServer().catch(console.error);