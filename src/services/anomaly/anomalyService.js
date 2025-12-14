import fetch from "node-fetch";
import { pool } from "../../db/db.js";

export async function saveAnomaly({
  machine_id = null,
  type = "M",
  air_temp = null,
  process_temp = null,
  rpm = null,
  torque = null,
  tool_wear = null,
  is_anomaly = false,
  score = null,
  status = null,
  raw = null,
}) {
  const q = `
    INSERT INTO anomaly_logs
      (machine_id, type, air_temp, process_temp, rpm, torque, tool_wear, is_anomaly, score, status, raw)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *;
  `;

  const r = await pool.query(q, [
    machine_id,
    type,
    air_temp,
    process_temp,
    rpm,
    torque,
    tool_wear,
    is_anomaly,
    score,
    status,
    raw ? JSON.stringify(raw) : null,
  ]);

  return r.rows[0];
}

export async function runAnomalyDetection(payload) {
const mlUrl = process.env.ML_ANOMALY_URL ?? "http://localhost:8001/anomaly";

  const response = await fetch(mlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error("Anomaly ML error");
    err.detail = data;
    throw err;
  }

  // normalize expected fields
const score = data.score ?? 0;

// NORMAL isolation forest rule:
// score < 0  → normal
// score > 0  → anomaly
const isAnomaly = score > 0;

return {
  is_anomaly: isAnomaly,
  score,
  status: isAnomaly ? "WARNING" : "NORMAL",
  raw: data,
};

}

/**
 * Get latest anomaly for a machine
 */
export async function getLatestAnomaly(machineId) {
  const q = await pool.query(
    `
    SELECT *
    FROM anomaly_logs
    WHERE machine_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [machineId]
  );
  return q.rows[0] || null;
}

/**
 * Auto anomaly monitor (periodic)
 */
export async function autoAnomalyMonitor() {
  try {
    const latestSensor = await pool.query(`
      SELECT DISTINCT ON (machine_id)
          machine_id,
          air_temperature,
          process_temperature,
          rotational_speed,
          torque,
          tool_wear,
          created_at
      FROM sensor_logs
      ORDER BY machine_id, created_at DESC
    `);

    if (!latestSensor.rowCount) return 0;

    for (const m of latestSensor.rows) {
      const payload = {
        Type: "M",
        air_temp: m.air_temperature,
        process_temp: m.process_temperature,
        rpm: m.rotational_speed,
        torque: m.torque,
        tool_wear: m.tool_wear,
      };

      try {
        const result = await runAnomalyDetection(payload);

        const saved = await saveAnomaly({
          machine_id: m.machine_id,
          type: "M",
          air_temp: m.air_temperature,
          process_temp: m.process_temperature,
          rpm: m.rotational_speed,
          torque: m.torque,
          tool_wear: m.tool_wear,
          is_anomaly: result.is_anomaly,
          score: result.score,
          status: result.status,
          raw: result.raw,
        });

        globalThis._io?.emit("anomaly:update", {
          machine_id: m.machine_id,
          is_anomaly: saved.is_anomaly,
          score: saved.score,
          status: saved.status,
          timestamp: saved.created_at,
        });
      } catch (err) {
        console.error("[AUTO-ANOMALY ML ERROR]", err);
      }
    }

    return latestSensor.rowCount;
  } catch (err) {
    console.error("[AUTO-ANOMALY ERROR]", err);
    return 0;
  }
}

export default {
  saveAnomaly,
  runAnomalyDetection,
  getLatestAnomaly,
  autoAnomalyMonitor,
};
