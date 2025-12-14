import fetch from "node-fetch";
import { pool } from "../../db/db.js";

export function mapStatus(predictedFailure, probability) {
  if (predictedFailure === "No Failure") return "NORMAL";
  if ((probability ?? 0) >= 0.80) return "CRITICAL";
  if ((probability ?? 0) >= 0.40) return "WARNING";
  return "NORMAL";
}

export async function runFailurePrediction(payload) {
  const mlUrl = process.env.ML_API_URL ?? "http://localhost:8001/predict";

  const res = await fetch(mlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("[ML API ERROR RESPONSE]", data);
    throw new Error("ML Request Error");
  }

  const predictedFailure = data.predicted_failure ?? data.label ?? "Unknown";
  const confidence = data.confidence ?? data.probability ?? 0;
  const status = mapStatus(predictedFailure, confidence);

  return {
    predicted_failure: predictedFailure,
    confidence,
    status,
    raw: data
  };
}

export async function savePrediction({machine_id=null,predicted_failure,confidence,status,raw=null}) {
  const q = `
    INSERT INTO prediction_logs
    (machine_id,failure_type,failure_probability,status,raw)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING *;
  `;

  const r = await pool.query(q,[
    machine_id, predicted_failure, confidence, status,
    raw ? JSON.stringify(raw) : null
  ]);

  return r.rows[0];
}

export async function getLatestPrediction(machine_id){
  const r = await pool.query(`
    SELECT * FROM prediction_logs
    WHERE machine_id=$1
    ORDER BY created_at DESC LIMIT 1`,[machine_id]);
  return r.rows[0] || null;
}

export async function getLatestPredictionAll(){
  const r = await pool.query(`
    SELECT DISTINCT ON (machine_id)
    machine_id,failure_type,failure_probability,status,created_at
    FROM prediction_logs
    ORDER BY machine_id,created_at DESC
  `);
  return r.rows;
}

export async function getCriticalMachines(){
  const rows = await getLatestPredictionAll();
  return rows.filter(m => m.status === "CRITICAL");
}


export async function getWarningMachines(){
  const rows = await getLatestPredictionAll();
  return rows.filter(m=>m.status==="WARNING");
}

export async function getNormalMachines(){
  const rows = await getLatestPredictionAll();
  return rows.filter(m=>m.status==="NORMAL");
}

export async function getFullStatusAllMachines(){
  const pred = await getLatestPredictionAll();
  const anom = await pool.query(`
    SELECT DISTINCT ON (machine_id)
    machine_id,is_anomaly,score,created_at
    FROM anomaly_logs
    ORDER BY machine_id,created_at DESC
  `);

  const anomalyMap = Object.fromEntries(anom.rows.map(x=>[x.machine_id,x]));

  return pred.map(p=>({
    machine_id: p.machine_id,
    status: p.status,
    failure_type: p.failure_type,
    probability: p.failure_probability,
    anomaly: anomalyMap[p.machine_id]?.is_anomaly ?? false,
    anomaly_score: anomalyMap[p.machine_id]?.score ?? null,
    last_update: p.created_at
  }));
}

export default {
  runFailurePrediction,
  savePrediction,
  mapStatus,
  getLatestPrediction,
  getLatestPredictionAll,
  getCriticalMachines,
  getWarningMachines,
  getNormalMachines,
  getFullStatusAllMachines
};
