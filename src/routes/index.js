import express from "express";

import sensorRoutes from "./sensorRoutes.js";
import anomalyRoutes from "./anomalyRoutes.js";
import predictRoutes from "./predictRoutes.js";
import healthRoutes from "./healthRoutes.js";
import authRoutes from "./auth/authRoutes.js";

import ticketActivityRoutes from "./ticketActivityRoutes.js";
import ticketRoutes from "./ticketRoutes.js";

import chatRoutes from "./chatRoutes.js";

import { verifyAuth } from "../middlewares/verifyAuth.js";

const router = express.Router();


router.use("/auth", authRoutes);
router.use("/sensor", verifyAuth, sensorRoutes);
router.use("/anomaly", verifyAuth, anomalyRoutes);  
router.use("/predict", verifyAuth, predictRoutes);
router.use("/health", verifyAuth, healthRoutes);
router.use("/tickets", verifyAuth, ticketRoutes);
router.use("/ticket-activity", verifyAuth, ticketActivityRoutes);
router.use("/chat", chatRoutes);

export default router;
