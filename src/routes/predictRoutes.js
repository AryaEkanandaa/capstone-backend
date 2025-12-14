import express from "express";
import {
  getPredictionHistory,
  getLatestPredictionPerMachine,
  getPredictionHistoryByMachine,
  getMachineByStatus
} from "../controllers/predictController.js";
import { verifyAuth } from "../middlewares/verifyAuth.js";
import { pool } from "../db/db.js";

const router = express.Router();

router.get("/history", verifyAuth, getPredictionHistory);
router.get("/latest-by-machine", verifyAuth, getLatestPredictionPerMachine);
router.get("/history-by-machine/:id", verifyAuth, getPredictionHistoryByMachine);

router.get("/status/:status", verifyAuth, getMachineByStatus);

router.post("/log/save", verifyAuth, async (req,res)=> {
  const { machine_id, failure_type, failure_probability, status } = req.body;

  if(!machine_id || !failure_type || typeof failure_probability!=="number" || !status)
    return res.status(400).json({success:false,msg:"Missing fields"});

  await pool.query(`
    INSERT INTO prediction_logs(machine_id,failure_type,failure_probability,status)
    VALUES($1,$2,$3,$4)
  `,[machine_id,failure_type,failure_probability,status]);

  res.json({success:true});
});

export default router;
