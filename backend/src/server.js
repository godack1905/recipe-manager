import mongoose from "mongoose";
import dotenv from "dotenv";
import app from "./app.js";

// Configurar variables de entorno
dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/recipe_app";

// Configurar mongoose
mongoose.set("strictQuery", true);

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB conectado exitosamente");
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error.message);
    process.exit(1);
  }
};

// Manejar cierre de conexión
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("MongoDB desconectado por terminación de la aplicación");
  process.exit(0);
});

// Iniciar servidor
const startServer = async () => {
  await connectDB();
  
  const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📁 Entorno: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔗 URL: http://192.168.1.52:${PORT}`);
  });

  // Manejar errores del servidor
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`❌ Puerto ${PORT} ya está en uso`);
      process.exit(1);
    } else {
      console.error("❌ Error del servidor:", error);
      process.exit(1);
    }
  });
};

startServer().catch(console.error);