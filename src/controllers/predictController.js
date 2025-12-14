// backend/src/controllers/predictController.js
import { pool } from "../db/db.js";
import { runFailurePrediction, mapStatus, savePrediction } from "../services/prediction/predictionService.js";

export const predictFailure = async (req, res, next) => {
  try {
    const payload = req.body;
    const required = ["Type", "air_temp", "process_temp", "rpm", "torque", "tool_wear"];
    for (const key of required) {
      if (payload[key] === undefined) {
        return res.status(400).json({ status: "error", message: `Missing field: ${key}` });
      }
    }

    const result = await runFailurePrediction(payload);
    const status = mapStatus(result.predicted_failure, result.confidence);
    const machineId = payload.machine_id ?? null;

    const saved = await savePrediction({
      machine_id: machineId,
      predicted_failure: result.predicted_failure,
      confidence: result.confidence,
      status,
      raw: result.raw,
    });

    globalThis._io?.emit("prediction:update", {
      machine_id: machineId,
      failure_type: saved.failure_type,
      failure_probability: saved.failure_probability,
      status: saved.status,
      timestamp: saved.created_at,
    });

    return res.json({ status: "success", data: saved });
  } catch (err) {
    next(err);
  }
};

export const getPredictionHistory = async (req, res) => {
  const r = await pool.query(`SELECT * FROM prediction_logs ORDER BY created_at DESC LIMIT 200`);
  res.json({ success: true, data: r.rows });
};

export const getLatestPredictionPerMachine = async (req, res) => {
  const r = await pool.query(`
    SELECT DISTINCT ON (machine_id)
      machine_id, failure_type, failure_probability, status, created_at
    FROM prediction_logs
    ORDER BY machine_id, created_at DESC
  `);
  res.json({ success: true, data: r.rows });
};

export const getPredictionHistoryByMachine = async (req, res) => {
  try {
    const machineId = Number(req.params.id);

    const {
      range = "ALL",
      status = "ALL",
      page = 1,
      limit = 12,
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const filters = [`machine_id = $1`];
    const values = [machineId];

    // RANGE FILTER
    if (range === "1h") filters.push(`created_at >= NOW() - INTERVAL '1 hour'`);
    if (range === "24h") filters.push(`created_at >= NOW() - INTERVAL '1 day'`);
    if (range === "7d") filters.push(`created_at >= NOW() - INTERVAL '7 days'`);

    // STATUS FILTER
    if (status !== "ALL") {
      values.push(status);
      filters.push(`status = $${values.length}`);
    }

    const where = `WHERE ${filters.join(" AND ")}`;

    // TOTAL COUNT
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM prediction_logs
      ${where}
    `;

    const dataQuery = `
      SELECT *
      FROM prediction_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, limitNum, offset]),
    ]);

    const total = countRes.rows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      data: dataRes.rows,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
    });

  } catch (err) {
    console.error("[PREDICTION_HISTORY_ERROR]", err);
    res.status(500).json({ error: "Gagal mengambil prediction history" });
  }
};

export const getMachineByStatus = async (req, res) => {
  const status = req.params.status.toUpperCase();

  if (!["CRITICAL", "WARNING", "NORMAL"].includes(status)) {
    return res.status(400).json({ error: "Status harus NORMAL/WARNING/CRITICAL" });
  }

  const q = await pool.query(`
    SELECT DISTINCT ON(machine_id)
      machine_id, failure_type, failure_probability, status, created_at
    FROM prediction_logs
    WHERE status='${status}'
    ORDER BY machine_id, created_at DESC;
  `);

  res.json({ status, count: q.rowCount, data: q.rows });
};


export default {
  predictFailure,
  getPredictionHistory,
  getLatestPredictionPerMachine,
  getPredictionHistoryByMachine,
  getMachineByStatus,
};
