import { pool } from "../../db/db.js";
import { getLatestByMachine } from "../sensor/sensorService.js";
import { runFailurePrediction } from "../prediction/predictionService.js";
import { runAnomalyDetection } from "../anomaly/anomalyService.js";
import { chatToLangChainAgent } from "../agent/langchainAgent.js";

const SYSTEM_USER_ID = 1;

export async function createAutoTickets() {
    try {
        console.log("Running auto ticket creation...");

        const criticalMachines = await pool.query(`
      WITH latest_anomalies AS (
        SELECT DISTINCT ON (machine_id)
          machine_id, score, created_at
        FROM anomaly_logs
        ORDER BY machine_id, created_at DESC
      ),
      latest_predictions AS (
        SELECT DISTINCT ON (machine_id)
          machine_id,
          failure_type,
          failure_probability,
          status,
          created_at
        FROM prediction_logs
        ORDER BY machine_id, created_at DESC
      )
      SELECT
        m.id AS machine_id,
        la.score AS anomaly_score,
        lp.failure_type AS predicted_failure,
        lp.failure_probability,
        lp.status AS prediction_status
      FROM machines m
      LEFT JOIN latest_anomalies la ON m.id = la.machine_id
      LEFT JOIN latest_predictions lp ON m.id = lp.machine_id
      WHERE la.score > 0.5
         OR lp.status IN ('CRITICAL','WARNING')
    `);

        const createdTickets = [];

        for (const machine of criticalMachines.rows) {

            const duplicate = await pool.query(
                `
        SELECT id
        FROM maintenance_tickets
        WHERE machine_id = $1
          AND creation_type = 'AUTO'
          AND status IN ('OPEN','IN_PROGRESS')
          AND failure_type = $2
          AND created_at > NOW() - INTERVAL '30 minutes'
        LIMIT 1
        `,
                [machine.machine_id, machine.predicted_failure]
            );

            if (duplicate.rowCount > 0) {
                console.log(`⏭️ Skip machine ${machine.machine_id} (duplicate failure)`);
                continue;
            }

            const technicianId = await getLeastBusyTechnician();

            const sensorData = await getLatestByMachine(machine.machine_id);

            const aiRecommendations = await generateAIRecommendations(
                machine.machine_id,
                sensorData,
                machine
            );

            const priority = determinePriority(machine);

            const ticket = await pool.query(
                `
        INSERT INTO maintenance_tickets (
          machine_id,
          title,
          description,
          priority,
          status,
          creation_type,
          created_by,
          assigned_to,
          sensor_data,
          anomaly_score,
          prediction_status,
          failure_type,
          failure_probability,
          ai_recommendations
        ) VALUES (
          $1,$2,$3,$4,
          'OPEN',
          'AUTO',
          $5,
          $6,
          $7,$8,$9,$10,$11,$12
        )
        RETURNING *
        `,
                [
                    machine.machine_id,
                    `Maintenance Required - Machine ${machine.machine_id}`,
                    "Automated ticket due to critical condition",
                    priority,
                    SYSTEM_USER_ID,
                    technicianId,
                    JSON.stringify(sensorData),
                    machine.anomaly_score,
                    machine.prediction_status,
                    machine.predicted_failure,
                    machine.failure_probability,
                    aiRecommendations
                ]
            );

            await logTicketActivity(
                ticket.rows[0].id,
                SYSTEM_USER_ID,
                "ASSIGNED",
                null,
                technicianId,
                "Auto-assigned to technician"
            );

            createdTickets.push(ticket.rows[0]);
            console.log(`Ticket created for machine ${machine.machine_id}`);
        }

        return createdTickets;

    } catch (error) {
        console.error("Auto ticket creation error:", error);
        throw error;
    }
}


export async function createManualTicket(machineId, userId, userNotes = null, conversationContext = null) {
    try {
        console.log(`Creating manual ticket for machine ${machineId} by user ${userId}`);

        // Fetch sensor data
        const sensorData = await getLatestByMachine(machineId);

        // Run prediction
        let prediction = null;
        try {
            prediction = await runFailurePrediction({
                Type: "M",
                air_temp: sensorData.air_temperature,
                process_temp: sensorData.process_temperature,
                rpm: sensorData.rotational_speed,
                torque: sensorData.torque,
                tool_wear: sensorData.tool_wear
            });
        } catch (e) {
            console.log("Prediction failed:", e);
        }

        // RUN ANOMALY DETECTION
        let anomaly = null;
        try {
            anomaly = await runAnomalyDetection({
                Type: "M",
                air_temp: sensorData.air_temperature,
                process_temp: sensorData.process_temperature,
                rpm: sensorData.rotational_speed,
                torque: sensorData.torque,
                tool_wear: sensorData.tool_wear
            });
        } catch (e) {
            console.log("Anomaly detection failed:", e);
        }

        // Generate AI recommendations
        let aiRecs = null;
        try {
            aiRecs = await chatToLangChainAgent(
                `Buat rekomendasi maintenance berdasarkan data berikut:
         Air Temp: ${sensorData.air_temperature}
         Process Temp: ${sensorData.process_temperature}
         RPM: ${sensorData.rotational_speed}
         Torque: ${sensorData.torque}
         Tool Wear: ${sensorData.tool_wear}
         Failure: ${prediction?.predicted_failure}
         Probability: ${(prediction?.confidence * 100)?.toFixed(1)}%
         Anomaly: ${anomaly?.score}`
            );
        } catch (e) {
            console.log("AI Recommendations failed:", e);
        }

        const ticket = await pool.query(
            `INSERT INTO maintenance_tickets (
        machine_id,
        title,
        description,
        priority,
        creation_type,
        created_by,
        assigned_to,
        sensor_data,
        anomaly_score,
        prediction_status,
        failure_type,
        failure_probability,
        ai_recommendations,
        user_notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
            [
                machineId,
                `Manual Maintenance Request - Machine ${machineId}`,
                `User requested maintenance`,
                "MEDIUM",
                "MANUAL",
                userId,
                userId, // assign langsung ke pembuat
                JSON.stringify(sensorData),
                anomaly?.score || null,
                prediction?.status || null,
                prediction?.predicted_failure || null,
                prediction?.confidence || null,
                aiRecs || null,
                userNotes
            ]
        );

        return ticket.rows[0];

    } catch (error) {
        console.error("Error creating manual ticket:", error);
        throw error;
    }
}



export async function getTickets(filters = {}, userId = null, isAdmin = false) {
    try {
        let query = `
      SELECT 
        mt.*,
        m.name as machine_name,
        u1.full_name as created_by_name,
        u2.full_name as assigned_to_name
      FROM maintenance_tickets mt
      LEFT JOIN machines m ON mt.machine_id = m.id
      LEFT JOIN users u1 ON mt.created_by = u1.id
      LEFT JOIN users u2 ON mt.assigned_to = u2.id
      WHERE 1=1
    `;

        const params = [];
        let idx = 1;

        // 🛡️ If user is NOT admin → restrict by ownership
        if (!isAdmin && userId) {
            query += ` AND (mt.created_by = $${idx} OR mt.assigned_to = $${idx})`;
            params.push(userId);
            idx++;
        }

        if (filters.machine_id) {
            query += ` AND mt.machine_id = $${idx}`;
            params.push(filters.machine_id);
            idx++;
        }

        if (filters.status) {
            query += ` AND mt.status = $${idx}`;
            params.push(filters.status);
            idx++;
        }

        if (filters.priority) {
            query += ` AND mt.priority = $${idx}`;
            params.push(filters.priority);
            idx++;
        }

        if (filters.creation_type) {
            query += ` AND mt.creation_type = $${idx}`;
            params.push(filters.creation_type);
            idx++;
        }

        query += ` ORDER BY mt.created_at DESC`;

        const result = await pool.query(query, params);
        return result.rows;

    } catch (error) {
        console.error("Error fetching tickets:", error);
        throw error;
    }
}

export async function getTicketById(ticketId) {
    try {
        const result = await pool.query(
            `SELECT 
        mt.*,
        m.name as machine_name,
        u1.full_name as created_by_name,
        u2.full_name as assigned_to_name
      FROM maintenance_tickets mt
      LEFT JOIN machines m ON mt.machine_id = m.id
      LEFT JOIN users u1 ON mt.created_by = u1.id
      LEFT JOIN users u2 ON mt.assigned_to = u2.id
      WHERE mt.id = $1`,
            [ticketId]
        );

        return result.rows[0];
    } catch (error) {
        console.error("Error fetching ticket:", error);
        throw error;
    }
}

export async function updateTicketStatus(ticketId, newStatus, userId, comment) {
    try {
        // Ambil status lama
        const old = await pool.query(
            `SELECT status FROM maintenance_tickets WHERE id = $1`,
            [ticketId]
        );
        const oldStatus = old.rows[0]?.status || null;

        // UPDATE ticket (dengan CAST)
        await pool.query(
            `
            UPDATE maintenance_tickets
            SET 
                status = CAST($1 AS VARCHAR),
                updated_at = NOW(),
                completed_at = CASE 
                    WHEN CAST($1 AS VARCHAR) = 'COMPLETED' THEN NOW()
                    ELSE completed_at 
                END
            WHERE id = CAST($2 AS INTEGER)
            `,
            [newStatus, ticketId]
        );

        // LOG ACTIVITY (dengan CAST)
        await pool.query(
            `INSERT INTO ticket_activity_logs (
                ticket_id, user_id, action, old_value, new_value, comment
            ) VALUES (
                CAST($1 AS INTEGER),
                CAST($2 AS INTEGER),
                'STATUS_CHANGED',
                CAST($3 AS TEXT),
                CAST($4 AS TEXT),
                CAST($5 AS TEXT)
            )`,
            [ticketId, userId, oldStatus, newStatus, comment]
        );

        // RETURN DATA LENGKAP
        const full = await pool.query(`
            SELECT 
                mt.*,
                u1.full_name AS created_by_name,
                u2.full_name AS assigned_to_name,
                m.name AS machine_name
            FROM maintenance_tickets mt
            LEFT JOIN users u1 ON mt.created_by = u1.id
            LEFT JOIN users u2 ON mt.assigned_to = u2.id
            LEFT JOIN machines m ON mt.machine_id = m.id
            WHERE mt.id = $1
        `, [ticketId]);

        return full.rows[0];

    } catch (err) {
        console.error(" Update status error:", err);

        throw {
            message: "Failed to update ticket status",
            detail: err.detail || err.message
        };
    }
}


async function generateAIRecommendations(machineId, sensorData, machineStatus) {
    try {
        const prompt = `
Mesin ${machineId} memerlukan maintenance berdasarkan data berikut:

**Data Sensor:**
- Air Temp: ${sensorData?.air_temp || "N/A"}°C
- Process Temp: ${sensorData?.process_temp || "N/A"}°C
- RPM: ${sensorData?.rpm || "N/A"}
- Torque: ${sensorData?.torque || "N/A"} Nm
- Tool Wear: ${sensorData?.tool_wear || "N/A"}

**Status Analisis:**
- Anomaly Score: ${machineStatus.anomaly_score || "N/A"}
- Prediction Status: ${machineStatus.prediction_status || "N/A"}
- Failure Type: ${machineStatus.predicted_failure || "No Failure"}
- Failure Probability: ${((machineStatus.failure_probability || 0) * 100).toFixed(1)}%

Berikan rekomendasi maintenance yang spesifik dan actionable dalam format:
1. Prioritas tindakan (urgent/high/medium)
2. Langkah-langkah maintenance yang harus dilakukan
3. Estimasi waktu pengerjaan
4. Part/komponen yang perlu diperiksa atau diganti

Jawab dalam bahasa Indonesia, singkat dan to-the-point.
`;

        const response = await chatToLangChainAgent(prompt);
        return response;
    } catch (error) {
        console.error("Error generating AI recommendations:", error);
        return "AI recommendations not available at this time.";
    }
}

function determinePriority(machineStatus) {
    if (machineStatus.anomaly_score > 1.0 || machineStatus.prediction_status === "CRITICAL") {
        return "CRITICAL";
    }

    if (
        machineStatus.anomaly_score > 0.7 ||
        machineStatus.prediction_status === "WARNING" ||
        machineStatus.failure_probability > 0.7
    ) {
        return "HIGH";
    }

    if (machineStatus.anomaly_score > 0.5) {
        return "MEDIUM";
    }

    return "LOW";
}


async function logTicketActivity(ticketId, userId, action, oldValue, newValue, comment) {
    try {
        const fallback = await pool.query(
            `SELECT created_by FROM maintenance_tickets WHERE id = $1`,
            [ticketId]
        );

        const finalUserId = userId ?? fallback.rows[0]?.created_by ?? null;

        await pool.query(
            `INSERT INTO ticket_activity_logs 
                (ticket_id, user_id, action, old_value, new_value, comment)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [ticketId, finalUserId, action, oldValue, newValue, comment]
        );
    } catch (error) {
        console.error("Error logging ticket activity:", error);
    }
}


async function getLeastBusyTechnician() {
    const r = await pool.query(`
    SELECT u.id
    FROM users u
    LEFT JOIN maintenance_tickets mt
      ON mt.assigned_to = u.id
      AND mt.status IN ('OPEN','IN_PROGRESS')
    WHERE u.role = 'TECHNICIAN'
    GROUP BY u.id
    ORDER BY COUNT(mt.id) ASC
    LIMIT 1
  `);

    return r.rows[0]?.id || null;
}
