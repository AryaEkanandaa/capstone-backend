import { pool } from "../../db/db.js";
import { runFailurePrediction, savePrediction, mapStatus } from "./predictionService.js";

export async function autoPredictAllMachines() {
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

      const result = await runFailurePrediction(payload);
      const status = mapStatus(result.predicted_failure, result.confidence);

      const saved = await savePrediction({
        machine_id: m.machine_id,
        predicted_failure: result.predicted_failure,
        confidence: result.confidence,
        status,
        raw: result.raw,
      });

      globalThis._io?.emit("prediction_update", {
        machine_id: m.machine_id,
        failure_type: saved.failure_type,
        probability: saved.failure_probability,
        status: saved.status,
        timestamp: saved.created_at,
      });
    }

    return latestSensor.rowCount;
  } catch (err) {
    console.error("[AUTO-PREDICT ERROR]", err);
    return 0;
  }
}
