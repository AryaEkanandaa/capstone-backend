import { pool } from "../db/db.js";
import { runAnomalyDetection, saveAnomaly } from "../services/anomaly/anomalyService.js";

// POST /api/anomaly
export const detectAnomaly = async (req, res, next) => {
  try {
    const payload = req.body;
    const result = await runAnomalyDetection(payload);

    const saved = await saveAnomaly({
      machine_id: payload.machine_id ?? null,
      type: payload.Type ?? "M",
      air_temp: payload.air_temp ?? null,
      process_temp: payload.process_temp ?? null,
      rpm: payload.rpm ?? null,
      torque: payload.torque ?? null,
      tool_wear: payload.tool_wear ?? null,
      is_anomaly: result.is_anomaly,
      score: result.score,
      status: result.status,
      raw: result.raw,
    });

    globalThis._io?.emit("anomaly:update", {
      machine_id: saved.machine_id,
      is_anomaly: saved.is_anomaly,
      score: saved.score,
      status: saved.status,
      timestamp: saved.created_at,
    });

    return res.json({ status: "success", data: saved });

  } catch (err) {
    next(err);
  }
};


// GET all machines with anomaly
export const getAnomalyMachines = async (req, res) => {
  try {
    const q = await pool.query(`
      SELECT DISTINCT ON(machine_id)
        machine_id, score, is_anomaly, created_at
      FROM anomaly_logs
      WHERE is_anomaly = true
      ORDER BY machine_id, created_at DESC;
    `);

    res.json({ success: true, count: q.rowCount, data: q.rows });

  } catch (error) {
    console.error("[ANOMALY_FETCH_ERROR]", error);
    res.status(500).json({ error: "Gagal mengambil data anomaly mesin" });
  }
};


// GET latest anomaly per machine
export const getLatestAnomalyPerMachine = async (req, res) => {
  try {
    const q = await pool.query(`
      SELECT DISTINCT ON (machine_id)
        machine_id, is_anomaly, score, status, created_at
      FROM anomaly_logs
      ORDER BY machine_id, created_at DESC;
    `);

    res.json({ success: true, data: q.rows });

  } catch (err) {
    console.error("[ANOMALY_LATEST_ERROR]", err);
    res.status(500).json({ error: "Failed fetching latest anomaly per machine" });
  }
};

// GET /api/anomaly/history (PAGINATED)
export const getAnomalyHistory = async (req, res) => {
  try {
    const {
      machineId,
      status,
      range,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    const filters = [];
    const values = [];

    if (machineId) {
      values.push(machineId);
      filters.push(`machine_id = $${values.length}`);
    }

    if (status === "ANOMALY") {
      filters.push(`is_anomaly = true`);
    }

    if (status === "NORMAL") {
      filters.push(`is_anomaly = false`);
    }

    if (range && range !== "ALL") {
      const map = {
        "1h": "1 hour",
        "24h": "1 day",
        "7d": "7 days"
      };
      if (map[range]) {
        filters.push(`created_at >= NOW() - INTERVAL '${map[range]}'`);
      }
    }

    const where = filters.length
      ? `WHERE ${filters.join(" AND ")}`
      : "";

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM anomaly_logs
      ${where}
    `;

    const dataQuery = `
      SELECT machine_id, is_anomaly, score, status, created_at
      FROM anomaly_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    const countRes = await pool.query(countQuery, values);
    values.push(limit, offset);
    const dataRes = await pool.query(dataQuery, values);

    const total = countRes.rows[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages,
      data: dataRes.rows
    });

  } catch (err) {
    console.error("[ANOMALY_HISTORY_ERROR]", err);
    res.status(500).json({ error: "Gagal mengambil anomaly history" });
  }
};

// GET anomaly history by machine
export const getAnomalyHistoryByMachine = async (req, res) => {
  try {
    const {
      machineId,
      page = 1,
      limit = 20,
      status = "ALL",
      range = "ALL"
    } = req.query;

    const offset = (page - 1) * limit;
    const filters = [];
    const values = [];

    if (machineId) {
      values.push(machineId);
      filters.push(`machine_id = $${values.length}`);
    }

    if (status !== "ALL") {
      values.push(status === "ANOMALY");
      filters.push(`is_anomaly = $${values.length}`);
    }

    if (range !== "ALL") {
      const map = {
        "1h": "1 hour",
        "24h": "1 day",
        "7d": "7 days",
      };
      if (map[range]) {
        filters.push(`created_at >= NOW() - INTERVAL '${map[range]}'`);
      }
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const countQ = `
      SELECT COUNT(*)::int AS total
      FROM anomaly_logs
      ${where}
    `;

    const dataQ = `
      SELECT *
      FROM anomaly_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `;

    values.push(limit, offset);

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQ, values.slice(0, -2)),
      pool.query(dataQ, values),
    ]);

    res.json({
      success: true,
      page,
      limit,
      total: countRes.rows[0].total,
      totalPages: Math.ceil(countRes.rows[0].total / limit),
      data: dataRes.rows,
    });

  } catch (err) {
    console.error("[ANOMALY_HISTORY_ERROR]", err);
    res.status(500).json({ error: "Failed fetching anomaly history" });
  }
};

// GET machines by anomaly status
export const getMachineByAnomalyStatus = async (req, res) => {
  try {
    const { status } = req.params;

    const q = await pool.query(`
      SELECT DISTINCT machine_id
      FROM anomaly_logs
      WHERE is_anomaly = $1
    `, [status === "ANOMALY"]);

    res.json({ success: true, data: q.rows });

  } catch (err) {
    console.error("[ANOMALY_STATUS_ERROR]", err);
    res.status(500).json({ error: "Failed fetching machines by anomaly status" });
  }
};


export default {
  detectAnomaly,
  getAnomalyMachines,
  getLatestAnomalyPerMachine
};
