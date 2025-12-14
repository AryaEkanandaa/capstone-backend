import express from "express";
import sensorController from "../controllers/sensor/sensorController.js";

const router = express.Router();

router.get("/latest-all", sensorController.getLatestAllMachines);
router.get("/:machine_id/latest", sensorController.getLatestByMachine);
router.get("/history", sensorController.getHistory);
router.post("/logs", sensorController.addLog);
router.get("/:machine_id/trend", sensorController.getTrend);
export default router;
