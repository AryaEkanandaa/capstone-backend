import express from "express";
import { verifyAuth } from "../middlewares/verifyAuth.js";
import {
  detectAnomaly,
  getLatestAnomalyPerMachine,
  getAnomalyHistory
} from "../controllers/anomalyController.js";

const router = express.Router();

router.post("/", verifyAuth, detectAnomaly);
router.get("/latest", verifyAuth, getLatestAnomalyPerMachine);
router.get("/history", verifyAuth, getAnomalyHistory);

export default router;
