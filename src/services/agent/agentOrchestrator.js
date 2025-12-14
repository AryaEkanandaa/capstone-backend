import { chatToLangChainAgent, chatToLangChainAgentWithTools } from "./langchainAgent.js";
import {
  classifyIntent,
  needsLLM,
  buildIntentPrompt,
  getSuggestedTools,
  INTENT_TYPES,
} from "../chat/intentClassifier.js";

import {
  getLatestByMachine,
  getMachineTrend,
} from "../sensor/sensorService.js";

import {
  getCriticalMachines,
  getWarningMachines,
  getNormalMachines,
  runFailurePrediction,
  savePrediction,
} from "../prediction/predictionService.js";

import {
  runAnomalyDetection,
  saveAnomaly,
} from "../anomaly/anomalyService.js";

import {
  detectTicketRequest,
  extractUserNotes,
  handleTicketCreation
} from "./tools/ticketTool.js";
import { pool } from "../../db/db.js";
import { formatResponse } from "../chat/responseFormatter.js";

export async function orchestrateChat(message, chatHistory = "", session = null) {
  try {
    const intent = classifyIntent(message);

    console.log(" Intent detected:", intent.type, `(${(intent.confidence * 100).toFixed(0)}% confidence)`);

    if (intent.type === INTENT_TYPES.MAINTENANCE_TICKET) {
      console.log(" Creating maintenance ticket via agent tool");

      const machineId = intent.metadata.machine_id;
      const reason = intent.metadata.reason || null;

      const userId = session?.userId || 1;

      const result = await handleTicketCreation({
        machineId,
        userId,
        userNotes: reason,
        conversationContext: chatHistory,
      });

      if (!result.success) {
        return {
          reply: `Gagal membuat tiket: ${result.error}`,
          method: "maintenance_ticket_error",
          intent: intent.type,
        };
      }

      return {
        reply: `**Tiket maintenance berhasil dibuat!**  

**Nomor Tiket:** ${result.ticket.ticketNumber}  
**Mesin:** ${result.ticket.machineId}  

Silakan cek halaman *Maintenance Ticket* untuk melihat detail dan status terbaru.`,
        method: "maintenance_ticket_created",
        intent: intent.type,
      };
    }
    if (intent.type === INTENT_TYPES.MANUAL_PREDICTION) {
      console.log("FORCED MANUAL ML PATH");

      const directResponse = await handleDirectIntent(intent, message);

      if (!directResponse) {
        throw new Error("Manual prediction failed in direct handler");
      }

      return {
        reply: formatResponse(directResponse, intent),
        method: "forced_manual_ml",
        intent: intent.type,
      };
    }
    if (!needsLLM(intent)) {
      const directResponse = await handleDirectIntent(intent, message);
      if (directResponse) {
        return {
          reply: formatResponse(directResponse, intent),
          method: "direct",
          intent: intent.type,
        };
      }
    }

    const suggestedTools = getSuggestedTools(intent);

    if (suggestedTools && suggestedTools.length > 0) {
      console.log(" Using Agent with Tools:", suggestedTools);

      const context = await buildContext(intent);
      const prompt = buildIntentPrompt(intent, message, context);

      const response = await chatToLangChainAgentWithTools(prompt, suggestedTools);

      return {
        reply: formatResponse(response, intent),
        method: "agent_with_tools",
        intent: intent.type,
      };
    }

    console.log("Using Simple Chat");

    const prompt = buildIntentPrompt(intent, message, chatHistory);
    const response = await chatToLangChainAgent(prompt);

    return {
      reply: formatResponse(response, intent),
      method: "simple_chat",
      intent: intent.type,
    };

  } catch (error) {
    console.error("Orchestrator Error:", error.message);

    return {
      reply: "Sistem sedang mengalami gangguan. Silakan coba lagi.",
      method: "error",
      intent: "unknown",
      error: error.message,
    };
  }
}

async function handleDirectIntent(intent, message) {
  try {
    switch (intent.type) {

      case INTENT_TYPES.SINGLE_MACHINE: {
        const { machine_id } = intent.metadata;

        const sensor = await getLatestByMachine(machine_id);

        if (!sensor) {
          return {
            type: "error",
            message: `Mesin ${machine_id} tidak ditemukan.`,
          };
        }

        const payload = {
          Type: "M",
          air_temp: sensor.air_temperature,
          process_temp: sensor.process_temperature,
          rpm: sensor.rotational_speed,
          torque: sensor.torque,
          tool_wear: sensor.tool_wear,
        };

        const [prediction, anomaly] = await Promise.all([
          runFailurePrediction(payload),
          runAnomalyDetection(payload),
        ]);

        return {
          type: "machine_status",
          machine_id,

          sensor: {
            air_temperature: sensor.air_temperature,
            process_temperature: sensor.process_temperature,
            rotational_speed: sensor.rotational_speed,
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
      }
      case INTENT_TYPES.MULTIPLE_MACHINES:
        console.log("🔧 Handling multiple machines:", intent.metadata.machine_ids);

        const { machine_ids } = intent.metadata;
    
    const results = await Promise.all(
        machine_ids.map(async (machine_id) => {
            try {
                const sensor = await getLatestByMachine(machine_id);
                
                if (!sensor) {
                    console.error(`❌ No sensor data for machine ${machine_id}`);
                    return { machine_id, error: "Data tidak ditemukan" };
                }

                // ⬇️ PAYLOAD DENGAN TYPE DEFAULT "M"
                const payload = {
                    Type: "M", // ⬅️ HARDCODE
                    air_temp: sensor.air_temp,
                    process_temp: sensor.process_temp,
                    rpm: sensor.rpm,
                    torque: sensor.torque,
                    tool_wear: sensor.tool_wear,
                };

                console.log(`🚀 ML Payload for machine ${machine_id}:`, payload);

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
                console.error(`❌ Error loading machine ${machine_id}:`, error);
                return { machine_id, error: error.message };
            }
        })
    );

    const successMachines = results.filter(r => !r.error);
    const failedMachines = results.filter(r => r.error);

    return JSON.stringify({
        type: "all_machine_status",
        machines: successMachines,
        failed: failedMachines.length > 0 ? failedMachines : undefined,
    });

      case INTENT_TYPES.MACHINE_TREND: {
        const { machine_id, hours } = intent.metadata;
        const trendData = await getMachineTrend(machine_id, hours || 24);

        if (!trendData || trendData.length === 0) {
          return { type: "error", message: `Tidak ada data trend untuk mesin ${machine_id}.` };
        }

        return { type: "machine_trend", data: trendData, machine_id, hours: hours || 24 };
      }

      case INTENT_TYPES.CRITICAL_STATUS: {
        const critical = await getCriticalMachines();
        const warning = await getWarningMachines();
        const normal = await getNormalMachines();

        return { type: "critical_status", critical, warning, normal, total: critical.length + warning.length + normal.length };
      }

      case INTENT_TYPES.WARNING_STATUS: {
        const machines = await getWarningMachines();
        return { type: "warning_status", machines, count: machines.length };
      }

      case INTENT_TYPES.ALL_MACHINES: {
        const machineIds = [1, 2, 3, 4, 5];

        const machines = await Promise.all(
          machineIds.map(async (id) => {
            const sensor = await getLatestByMachine(id);
            if (!sensor) return null;

            const payload = {
              Type: "M",
              air_temp: sensor.air_temperature,
              process_temp: sensor.process_temperature,
              rpm: sensor.rotational_speed,
              torque: sensor.torque,
              tool_wear: sensor.tool_wear,
            };

            const [prediction, anomaly] = await Promise.all([
              runFailurePrediction(payload),
              runAnomalyDetection(payload),
            ]);

            return {
              type: "machine_status",
              machine_id: id,
              sensor: {
                air_temp: sensor.air_temperature,
                process_temp: sensor.process_temperature,
                rpm: sensor.rotational_speed,
                torque: sensor.torque,
                tool_wear: sensor.tool_wear,
                timestamp: sensor.created_at,
              },
              prediction: {
                failure_type: prediction.predicted_failure,
                confidence: prediction.confidence,
                status: prediction.status,
              },
              anomaly: {
                is_anomaly: anomaly.is_anomaly,
                score: anomaly.score,
                status: anomaly.status,
              },
            };
          })
        );

        return {
          type: "all_machine_status",
          machines: machines.filter(Boolean),
        };
      }

      case INTENT_TYPES.ANOMALY_CHECK: {
        const result = await pool.query(`
          SELECT DISTINCT ON(machine_id)
            machine_id, is_anomaly, score, created_at
          FROM anomaly_logs
          WHERE is_anomaly = true
          ORDER BY machine_id, created_at DESC
          LIMIT 20
        `);

        return { type: "anomaly_check", machines: result.rows, count: result.rowCount };
      }

      case INTENT_TYPES.MANUAL_PREDICTION: {
        const { air_temp, process_temp, rpm, torque, tool_wear } = intent.metadata;

        const payload = {
          Type: "M",
          air_temp,
          process_temp,
          rpm,
          torque,
          tool_wear,
        };

        const [prediction, anomaly] = await Promise.all([
          runFailurePrediction(payload),
          runAnomalyDetection(payload),
        ]);
        console.log(" ML Prediction Result:", JSON.stringify(prediction, null, 2));
        console.log(" Anomaly Detection Result:", JSON.stringify(anomaly, null, 2));
        return {
          type: "manual_prediction",
          input: payload,
          prediction,
          anomaly,
        };
      }

      default:
        return null;
    }

  } catch (error) {
    console.error("Direct handler error:", error);
    return null;
  }
}

async function buildContext(intent) {
  try {
    switch (intent.type) {

      case INTENT_TYPES.SINGLE_MACHINE: {
        const data = await getLatestByMachine(intent.metadata.machine_id);
        return data ? JSON.stringify(data) : "";
      }

      case INTENT_TYPES.CRITICAL_STATUS: {
        const critical = await getCriticalMachines();
        return `Critical machines: ${critical.length}`;
      }

      case INTENT_TYPES.ALL_MACHINES: {
        const [critical, warning] = await Promise.all([
          getCriticalMachines(),
          getWarningMachines(),
        ]);
        return `Critical: ${critical.length}, Warning: ${warning.length}`;
      }

      default:
        return "";
    }
  } catch (error) {
    return "";
  }
}

export function validateMessage(message) {
  if (!message || typeof message !== "string") {
    return { valid: false, error: "Invalid message format" };
  }

  if (message.trim().length === 0) {
    return { valid: false, error: "Empty message" };
  }

  if (message.length > 2000) {
    return { valid: false, error: "Message too long (max 2000 chars)" };
  }

  return { valid: true };
}