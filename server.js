// backend/server.js
import "./src/config/env.js";
import app from "./src/app.js";
import { pool } from "./src/db/db.js";

import sensorService from "./src/services/sensor/sensorService.js";
import { autoPredictAllMachines } from "./src/services/prediction/autoPredictionService.js";
import { autoAnomalyMonitor } from "./src/services/anomaly/anomalyService.js";
import { startAutoTicketCron } from "./src/jobs/autoTicketCreation.js";

import http from "http";
import { Server as IOServer } from "socket.io";

import jwt from "jsonwebtoken";
import jwtConfig from "./src/config/jwt.js";

// ===================================================
// 🚨 PORT HANDLING (FINAL & BENAR UNTUK RAILWAY)
// ===================================================
const PORT = process.env.PORT;
const HOST = "0.0.0.0";

if (!PORT) {
  throw new Error("PORT is not set by Railway");
}

// ===================================================
// 🔁 WORKERS (DELAYED START)
// ===================================================
function startWorkers() {
  const SENSOR_INTERVAL = Number(process.env.SENSOR_INTERVAL_MS) || 10000;
  setInterval(async () => {
    try {
      const inserted = await sensorService.autoGenerateAllMachines();
      console.log(`[SENSOR] Inserted ${inserted.length} logs`);
    } catch (err) {
      console.error("[SENSOR ERROR]", err);
    }
  }, SENSOR_INTERVAL);

  const PREDICT_INTERVAL = Number(process.env.PREDICT_INTERVAL_MS) || 10000;
  console.log(`Prediction worker active every ${PREDICT_INTERVAL} ms`);

  setInterval(async () => {
    try {
      const count = await autoPredictAllMachines();
      if (count > 0) console.log(`[PREDICT] Processed ${count} machines`);
    } catch (err) {
      console.error("[AUTO-PREDICT ERROR]", err);
    }
  }, PREDICT_INTERVAL);

  const ANOMALY_INTERVAL = Number(process.env.ANOMALY_INTERVAL_MS) || 10000;
  console.log(`Anomaly monitor active every ${ANOMALY_INTERVAL} ms`);

  setInterval(async () => {
    try {
      const detected = await autoAnomalyMonitor();
      if (detected > 0) console.log(`[ANOMALY] Scanned ${detected} machines`);
    } catch (err) {
      console.error("[AUTO-ANOMALY ERROR]", err);
    }
  }, ANOMALY_INTERVAL);
}

// ===================================================
// 🚀 SERVER BOOTSTRAP
// ===================================================
async function startServer() {
  try {
    try {
      await pool.query("select 1");
      console.log("PostgreSQL connected successfully");
    } catch {
      console.warn("PostgreSQL not ready yet, continuing startup...");
    }

    const server = http.createServer(app);

    const io = new IOServer(server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
    });

    io.use((socket, next) => {
      const raw =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization;

      if (!raw) return next(new Error("NO_TOKEN_PROVIDED"));

      try {
        socket.user = jwt.verify(raw.replace("Bearer ", ""), jwtConfig.accessSecret);
        next();
      } catch {
        next(new Error("INVALID_TOKEN"));
      }
    });

    io.on("connection", (socket) => {
      console.log(`Socket connected: ${socket.id}`);
      socket.on("disconnect", () =>
        console.log(`Socket disconnected: ${socket.id}`)
      );
    });

    globalThis._io = io;

    server.listen(PORT, HOST, () => {
      console.log(`🚀 Server listening on ${PORT}`);
      startAutoTicketCron();
      setTimeout(startWorkers, 5000);
    });

  } catch (err) {
    console.error("Failed to start server:", err);
  }
}

startServer();
