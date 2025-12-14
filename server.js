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

const PORT = process.env.PORT || 5000;


async function startServer() {
  try {
    await pool.query("SELECT NOW()");
    console.log("PostgreSQL connected successfully");

    const server = http.createServer(app);

    const io = new IOServer(server, {
      cors: { origin: "*", methods: ["GET", "POST"] }
    });

    // Authorization for socket
    io.use((socket, next) => {
      const raw =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        null;

      if (!raw) return next(new Error("NO_TOKEN_PROVIDED"));

      const token = raw.replace("Bearer ", "");

      try {
        const decoded = jwt.verify(token, jwtConfig.accessSecret);
        socket.user = decoded;
        return next();
      } catch (err) {
        return next(new Error("INVALID_TOKEN"));
      }
    });

    io.on("connection", (socket) => {
      console.log(`Socket connected: ${socket.id} (user=${socket.user?.email})`);

      socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);
      });
    });

    // Expose IO globally
    globalThis._io = io;

    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      startAutoTicketCron();
    });

    // Sensor auto generator
    const SENSOR_INTERVAL = Number(process.env.SENSOR_INTERVAL_MS) || 10000;
    setInterval(async () => {
      try {
        const inserted = await sensorService.autoGenerateAllMachines();
        console.log(`[SENSOR] Inserted ${inserted.length} logs`);
      } catch (err) {
        console.error("[SENSOR ERROR]", err);
      }
    }, SENSOR_INTERVAL);

    // Auto prediction worker
    const PREDICT_INTERVAL = Number(process.env.PREDICT_INTERVAL_MS) || 10000;
    console.log(`Prediction worker active every ${PREDICT_INTERVAL} ms`);

    setInterval(async () => {
      try {
        const count = await autoPredictAllMachines();
        if (count > 0) {
          console.log(`[PREDICT] Processed ${count} machines`);
        }
      } catch (err) {
        console.error("[AUTO-PREDICT ERROR]", err);
      }
    }, PREDICT_INTERVAL);

    // Auto anomaly monitor worker
    const ANOMALY_INTERVAL = Number(process.env.ANOMALY_INTERVAL_MS) || 10000;
    console.log(`Anomaly monitor active every ${ANOMALY_INTERVAL} ms`);

    setInterval(async () => {
      try {
        const detected = await autoAnomalyMonitor();
        if (detected > 0) {
          console.log(`[ANOMALY] Scanned ${detected} machines`);
        }
      } catch (err) {
        console.error("[AUTO-ANOMALY ERROR]", err);
      }
    }, ANOMALY_INTERVAL);

  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
