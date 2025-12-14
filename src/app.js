import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://predix-five.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// ⬅️ ROUTES
app.use("/api", router);

// ⬅️ ERROR HANDLERS
app.use(notFound);
app.use(errorHandler);

export default app;
