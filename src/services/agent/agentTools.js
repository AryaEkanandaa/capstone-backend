// services/agent/agentTools.js

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { pool } from "../../db/db.js";

// Import existing services
import {
  getLatestByMachine,
  getLatestAll,
  getMachineTrend,
} from "../sensor/sensorService.js";

import {
  runFailurePrediction,
  getCriticalMachines,
  getWarningMachines,
  getNormalMachines,
} from "../prediction/predictionService.js";

import {
  runAnomalyDetection,
} from "../anomaly/anomalyService.js";

export const getMachineDataTool = new DynamicStructuredTool({
  name: "get_machine_data",
  description: `Ambil STATUS LENGKAP satu mesin:
  - sensor terbaru
  - prediksi kegagalan (ML)
  - deteksi anomali

  Gunakan ketika user bertanya:
  "cek mesin X", "status mesin X", "kondisi mesin X"`,

  schema: z.object({
    machine_id: z.number().describe("ID mesin"),
  }),

  func: async ({ machine_id }) => {
    try {
      const sensor = await getLatestByMachine(machine_id);

      if (!sensor) {
        return JSON.stringify({
          error: `Mesin ${machine_id} tidak ditemukan atau belum ada data.`,
        });
      }

      // ✅ Payload ML yang BENAR
      const payload = {
        Type: "M",
        air_temp: sensor.air_temp,
        process_temp: sensor.process_temp,
        rpm: sensor.rpm,
        torque: sensor.torque,
        tool_wear: sensor.tool_wear,
      };

      // 🔮 Prediction
      const prediction = await runFailurePrediction(payload);

      // 🚨 Anomaly
      const anomaly = await runAnomalyDetection(payload);

      return JSON.stringify({
        type: "machine_status", // ⬅️ PENTING UNTUK FRONTEND
        machine_id,

        sensor: {
          air_temp: sensor.air_temp,
          process_temp: sensor.process_temp,
          rpm: sensor.rpm,
          torque: sensor.torque,
          tool_wear: sensor.tool_wear,
          timestamp: sensor.created_at,
        },

        prediction: {
          status: prediction.status,
          failure_type: prediction.predicted_failure,
          probability: prediction.confidence,
        },

        anomaly: {
          is_anomaly: anomaly.is_anomaly,
          score: anomaly.score,
          status: anomaly.status,
        },
      });

    } catch (error) {
      return JSON.stringify({
        error: `Gagal mengambil data mesin ${machine_id}: ${error.message}`,
      });
    }
  },
});

// TOOL 2: Get Machine Trend (Historical Data)
export const getMachineTrendTool = new DynamicStructuredTool({
  name: "get_machine_trend",
  description: `Ambil data historis/trend mesin.
  Gunakan ketika user tanya tentang: trend, perubahan, history, grafik, perkembangan.
  Contoh: "trend mesin 5", "history mesin 3", "perubahan suhu mesin 7"
  
  Default range: 1h (1 jam terakhir)
  Format range: Xm/Xh/Xd (contoh: 30m, 2h, 24h, 7d)`,

  schema: z.object({
    machine_id: z.number().describe("ID mesin"),
    range: z.string().default("1h").describe("Range waktu (default: 1h). Format: Xm/Xh/Xd"),
  }),

  func: async ({ machine_id, range = "1h" }) => { // ⬅️ Tambah default di sini juga
    try {
      const data = await getMachineTrend(machine_id, range);

      if (!data || data.length === 0) {
        return JSON.stringify({
          error: `Tidak ada data trend untuk mesin ${machine_id} dalam ${range} terakhir.`
        });
      }

      // Calculate statistics
      const latest = data[0];
      const oldest = data[data.length - 1];

      const tempChange = latest.process_temp - oldest.process_temp;
      const rpmChange = latest.rpm - oldest.rpm;
      const wearChange = latest.tool_wear - oldest.tool_wear;

      return JSON.stringify({
        type: "machine_trend",
        machine_id,
        range,
        data_points: data.length,
        latest: {
          timestamp: latest.created_at,
          air_temp: latest.air_temp,
          process_temp: latest.process_temp,
          rpm: latest.rpm,
          torque: latest.torque,
          tool_wear: latest.tool_wear,
        },
        changes: {
          process_temp: tempChange.toFixed(2),
          rpm: rpmChange,
          tool_wear: wearChange,
        },
        trend_direction: {
          temperature: tempChange > 5 ? "naik" : tempChange < -5 ? "turun" : "stabil",
          rpm: rpmChange > 100 ? "naik" : rpmChange < -100 ? "turun" : "stabil",
          wear: wearChange > 10 ? "meningkat" : "normal",
        },
        raw_data: data
      });

    } catch (error) {
      return JSON.stringify({
        error: `Gagal mengambil trend mesin ${machine_id}: ${error.message}`
      });
    }
  },
});

// TOOL 3: Get Critical Machines
export const getCriticalMachinesTool = new DynamicStructuredTool({
  name: "get_critical_machines",
  description: `Ambil daftar mesin dengan status CRITICAL (high risk failure).
  Gunakan ketika user tanya: mesin kritis, mesin bermasalah, mesin bahaya, mesin urgent.`,

  schema: z.object({
    limit: z.number().default(10).describe("Berapa mesin yang ditampilkan (default 5)"),
  }),

  func: async ({ limit }) => {
    try {
      const machines = await getCriticalMachines();

      if (machines.length === 0) {
        return JSON.stringify({
          message: "Tidak ada mesin critical saat ini. Semua mesin aman!",
          count: 0,
          machines: []
        });
      }

      const topMachines = machines.slice(0, limit).map(m => ({
        machine_id: m.machine_id,
        failure_type: m.failure_type,
        probability: (m.failure_probability * 100).toFixed(1) + "%",
        status: m.status,
        predicted_at: m.predicted_at,
      }));

      return JSON.stringify({
        message: `Ditemukan ${machines.length} mesin CRITICAL!`,
        count: machines.length,
        machines: topMachines,
      });

    } catch (error) {
      return JSON.stringify({
        error: `Gagal mengambil data critical machines: ${error.message}`
      });
    }
  },
});


// TOOL 4: Get Warning Machines
export const getWarningMachinesTool = new DynamicStructuredTool({
  name: "get_warning_machines",
  description: `Ambil daftar mesin dengan status WARNING (medium risk).
  Gunakan ketika user tanya: mesin warning, mesin perlu diperhatikan, mesin waspada.`,

  schema: z.object({
    limit: z.number().default(10).describe("Berapa mesin yang ditampilkan"),
  }),

  func: async ({ limit }) => {
    try {
      const machines = await getWarningMachines();

      if (machines.length === 0) {
        return JSON.stringify({
          message: "Tidak ada mesin warning.",
          count: 0
        });
      }

      return JSON.stringify({
        count: machines.length,
        machines: machines.slice(0, limit).map(m => ({
          machine_id: m.machine_id,
          failure_type: m.failure_type,
          probability: (m.failure_probability * 100).toFixed(1) + "%",
        })),
      });

    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  },
});


// TOOL 5: Get All Machines Status Summary

export const getAllMachinesSummaryTool = new DynamicStructuredTool({
  name: "get_all_machines_summary",
  description: `Ambil ringkasan status SEMUA mesin (critical, warning, normal).
  Gunakan ketika user tanya: status semua mesin, overview, ringkasan, dashboard.`,

  schema: z.object({}),

  func: async () => {
    try {
      const [critical, warning, normal] = await Promise.all([
        getCriticalMachines(),
        getWarningMachines(),
        getNormalMachines(),
      ]);

      const total = critical.length + warning.length + normal.length;

      return JSON.stringify({
        total_machines: total,
        summary: {
          critical: critical.length,
          warning: warning.length,
          normal: normal.length,
        },
        health_score: ((normal.length / total) * 100).toFixed(1) + "%",
        top_critical: critical.slice(0, 3).map(m => ({
          machine_id: m.machine_id,
          failure_type: m.failure_type,
          probability: (m.failure_probability * 100).toFixed(1) + "%",
        })),
      });

    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  },
});

// TOOL 6: Predict Failure from Manual Input
export const predictFailureTool = new DynamicStructuredTool({
  name: "predict_failure",
  description: `Jalankan prediksi ML untuk data sensor yang diberikan user.
  Gunakan ketika user memberikan angka sensor manual, contoh:
  "cek prediksi air temp 300, rpm 1500, torque 40, wear 120"`,

  schema: z.object({
    air_temp: z.number().describe("Air temperature (K)"),
    process_temp: z.number().describe("Process temperature (K)"),
    rpm: z.number().describe("Rotational speed (rpm)"),
    torque: z.number().describe("Torque (Nm)"),
    tool_wear: z.number().describe("Tool wear (min)"),
  }),

  func: async ({ air_temp, process_temp, rpm, torque, tool_wear }) => {
    try {
      const payload = {
        Type: "M",
        air_temp,
        process_temp,
        rpm,
        torque,
        tool_wear,
      };

      const prediction = await runFailurePrediction(payload);
      const anomaly = await runAnomalyDetection(payload);

      return JSON.stringify({
        sensor_input: payload,
        prediction: {
          failure_type: prediction.predicted_failure,
          confidence: (prediction.confidence * 100).toFixed(1) + "%",
          status: prediction.status,
        },
        anomaly: {
          is_anomaly: anomaly.is_anomaly,
          score: anomaly.score.toFixed(3),
          status: anomaly.status,
        },
      });

    } catch (error) {
      return JSON.stringify({
        error: `Prediction failed: ${error.message}`
      });
    }
  },
});

export const getAnomalyMachinesTool = new DynamicStructuredTool({
  name: "get_anomaly_machines",
  description: `Ambil daftar mesin yang terdeteksi anomali.
  Gunakan ketika user tanya: mesin anomali, mesin tidak normal, mesin aneh.`,

  schema: z.object({
    limit: z.number().default(10).describe("Jumlah mesin"),
  }),

  func: async ({ limit }) => {
    try {
      const result = await pool.query(`
        SELECT DISTINCT ON(machine_id)
          machine_id, is_anomaly, score, created_at
        FROM anomaly_logs
        WHERE is_anomaly = true
        ORDER BY machine_id, created_at DESC
        LIMIT $1
      `, [limit]);

      if (result.rowCount === 0) {
        return JSON.stringify({
          message: "Tidak ada mesin dengan anomali.",
          count: 0
        });
      }

      return JSON.stringify({
        count: result.rowCount,
        machines: result.rows.map(m => ({
          machine_id: m.machine_id,
          anomaly_score: m.score.toFixed(3),
          detected_at: m.created_at,
        })),
      });

    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  },
});

export const getMultipleMachinesDataTool = new DynamicStructuredTool({
  name: "get_multiple_machines_data",
  description: `Ambil STATUS LENGKAP untuk BEBERAPA mesin sekaligus.
  Gunakan ketika user minta data lebih dari 1 mesin spesifik.
  Contoh: "cek mesin 1 dan 2", "status mesin 3, 5, 4", "mesin 1 2 3"`,

  schema: z.object({
    machine_ids: z.array(z.number()).describe("Array ID mesin yang diminta"),
  }),

  func: async ({ machine_ids }) => {
    try {
      const results = await Promise.all(
        machine_ids.map(async (machine_id) => {
          try {
            const sensor = await getLatestByMachine(machine_id);

            if (!sensor) {
              return {
                machine_id,
                error: `Data tidak ditemukan`,
              };
            }

            const payload = {
              Type: "M",
              air_temp: sensor.air_temp,
              process_temp: sensor.process_temp,
              rpm: sensor.rpm,
              torque: sensor.torque,
              tool_wear: sensor.tool_wear,
            };
            const [prediction, anomaly] = await Promise.all([
              runFailurePrediction(payload),
              runAnomalyDetection(payload),
            ]);

            return {
              machine_id,
              sensor: {
                air_temperature: sensor.air_temp,
                process_temperature: sensor.process_temp,
                rotational_speed: sensor.rpm,
                torque: sensor.torque,
                tool_wear: sensor.tool_wear,
                timestamp: sensor.created_at,
              },
              prediction: {
                status: prediction.status,
                failure_type: prediction.predicted_failure,
                probability: prediction.confidence,
              },
              anomaly: {
                is_anomaly: anomaly.is_anomaly,
                score: anomaly.score,
                status: anomaly.status,
              },
            };
          } catch (error) {
            return {
              machine_id,
              error: error.message,
            };
          }
        })
      );

      return JSON.stringify({
        type: "all_machine_status",
        machines: results.filter(r => !r.error),
        failed: results.filter(r => r.error),
      });

    } catch (error) {
      return JSON.stringify({
        error: `Gagal mengambil data mesin: ${error.message}`,
      });
    }
  },
});

export const allTools = [
  getMachineDataTool,
  getMultipleMachinesDataTool,
  getMachineTrendTool,
  getCriticalMachinesTool,
  getWarningMachinesTool,
  getAllMachinesSummaryTool,
  predictFailureTool,
  getAnomalyMachinesTool,
];