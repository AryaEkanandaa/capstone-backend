import { pool } from "../../db/db.js";
import { generateSensorForMachine, getMachineCount as getCount } from "./sensorGenerator.js";

export function getMachineCount() {
  return getCount();
}

export const autoGenerateAllMachines = async () => {
  const count = getMachineCount();
  const results = [];

  for (let id = 1; id <= count; id++) {
    const data = generateSensorForMachine(id);
    const saved = await saveSensorLog(data);
    results.push(saved);
  }

  return results;
};

export const saveSensorLog = async (payload) => {
  const {
    machine_id,
    airTemperature,
    processTemperature,
    rotationalSpeed,
    torque,
    toolWear,
  } = payload;

  const q = `
    INSERT INTO sensor_logs
      (machine_id, air_temperature, process_temperature, rotational_speed, torque, tool_wear)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
  `;

  const r = await pool.query(q, [
    machine_id,
    airTemperature,
    processTemperature,
    rotationalSpeed,
    torque,
    toolWear,
  ]);

  const saved = r.rows[0];

  if (globalThis._io) {
    globalThis._io.emit("sensor:update", {
      ...saved,
      Type: payload.Type,
      rpm: payload.rpm,
      tool_wear: saved.tool_wear,
      air_temp: saved.air_temperature,
      process_temp: saved.process_temperature
    });
  }

  return saved;
};


export const getLatestByMachine = async (machine_id) => {
  const r = await pool.query(
    `
    SELECT *
    FROM sensor_logs
    WHERE machine_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [machine_id]
  );

  return r.rows[0] || null;
};

export const getLatestAll = async () => {
  const count = getMachineCount();
  const result = [];

  for (let id = 1; id <= count; id++) {
    result.push(await getLatestByMachine(id));
  }

  return result;
};

export const getSensorHistory = async ({ page = 1, limit = 200, date_from, date_to, machine_id, range }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const values = [];

  if (machine_id) {
    values.push(machine_id);
    filters.push(`machine_id = $${values.length}`);
  }

  if (date_from) {
    values.push(date_from);
    filters.push(`created_at >= $${values.length}`);
  }

  if (date_to) {
    values.push(date_to);
    filters.push(`created_at <= $${values.length}`);
  }

  if (range) {
    const map = {
      "10m": "10 minutes",
      "30m": "30 minutes",
      "1h": "1 hour",
      "6h": "6 hours",
      "24h": "1 day",
      "7d": "7 days",
    };

    if (map[range]) {
      filters.push(`created_at >= NOW() - INTERVAL '${map[range]}'`);
    }
  }


  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const countQ = `SELECT COUNT(*)::int AS total FROM sensor_logs ${where}`;

  const dataQ = `
    SELECT *
    FROM sensor_logs
    ${where}
    ORDER BY created_at DESC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `;

  values.push(limit, offset);

  const [countRes, rowsRes] = await Promise.all([
    pool.query(countQ, values.slice(0, -2)),
    pool.query(dataQ, values),
  ]);

  return {
    page,
    limit,
    total: countRes.rows[0].total,
    data: rowsRes.rows,
  };
};

export const getPreviousSensorReading = async (machine_id) => {
  const r = await pool.query(
    `
    SELECT *
    FROM sensor_logs
    WHERE machine_id = $1
    ORDER BY created_at DESC
    OFFSET 1 LIMIT 1
    `,
    [machine_id]
  );
  return r.rows[0] || null;
};

export const getMachineTrend = async (machine_id, range = "24h") => {

  if (!/^\d+(m|h|d)$/i.test(range)) {
    throw new Error("Invalid range. Format valid: Xm / Xh / Xd  → contoh: 5m, 30m, 2h, 1d, 7d");
  }

  return await pool.query(
    `
    SELECT machine_id, air_temperature, process_temperature, rotational_speed,
           torque, tool_wear, created_at
    FROM sensor_logs
    WHERE machine_id = $1
      AND created_at >= NOW() - INTERVAL '${range}'
    ORDER BY created_at ASC
    `,
    [machine_id]
  );
};

export default {
  saveSensorLog,
  getLatestByMachine,
  getLatestAll,
  getSensorHistory,
  getPreviousSensorReading,
  getMachineCount,
  autoGenerateAllMachines,
  getMachineTrend,
};