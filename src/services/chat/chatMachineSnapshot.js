
import { getLatestByMachine } from "../sensor/sensorService.js";
import { pool } from "../../db/db.js";

export async function getMachineSnapshot(machineId) {
  try {

    const sensorData = await getLatestByMachine(machineId);
    
    if (!sensorData) {
      return `### Mesin ${machineId}\n\nMesin tidak ditemukan atau belum ada data sensor.`;
    }

    const predictionResult = await pool.query(`
      SELECT predicted_failure, confidence, status, created_at
      FROM prediction_logs
      WHERE machine_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [machineId]);
    
    const prediction = predictionResult.rows[0] || null;

    const anomalyResult = await pool.query(`
      SELECT is_anomaly, score, status, created_at
      FROM anomaly_logs
      WHERE machine_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [machineId]);
    
    const anomaly = anomalyResult.rows[0] || null;

    let response = `## Status Mesin ${machineId}\n\n`;

    response += `### Data Sensor Terkini\n\n`;
    response += `| Parameter | Nilai | Status |\n`;
    response += `|-----------|-------|--------|\n`;
    response += `| **Air Temperature** | ${sensorData.air_temperature}°K | ${getStatusBadge('air_temperature', sensorData.air_temp)} |\n`;
    response += `| **Process Temperature** | ${sensorData.process_temperature}°K | ${getStatusBadge('process_temp', sensorData.process_temperature)} |\n`;
    response += `| **RPM** | ${sensorData.rotational_speed} | ${getStatusBadge('rpm', sensorData.rotational_speed)} |\n`;
    response += `| **Torque** | ${sensorData.torque} Nm | ${getStatusBadge('torque', sensorData.torque)} |\n`;
    response += `| **Tool Wear** | ${sensorData.tool_wear} min | ${getStatusBadge('tool_wear', sensorData.tool_wear)} |\n\n`;
    
    response += `**Terakhir update:** ${new Date(sensorData.created_at).toLocaleString('id-ID')}\n\n`;

    if (prediction) {
      const statusEmoji = prediction.status === 'CRITICAL' ? '🔴' : 
                         prediction.status === 'WARNING' ? '⚠️' : '✅';
      
      response += `### 🔮 Prediksi Kerusakan (ML)\n\n`;
      response += `- **Failure Type:** ${prediction.predicted_failure}\n`;
      response += `- **Confidence:** ${(prediction.confidence * 100).toFixed(1)}%\n`;
      response += `- **Status:** ${statusEmoji} ${prediction.status}\n`;
      response += `- **Prediksi dibuat:** ${new Date(prediction.created_at).toLocaleString('id-ID')}\n\n`;
    } else {
      response += `### 🔮 Prediksi Kerusakan\n\nBelum ada prediksi untuk mesin ini.\n\n`;
    }
    
    // Anomaly Section
    if (anomaly) {
      const anomalyEmoji = anomaly.is_anomaly ? '⚠️' : '✅';
      
      response += `### 🔍 Deteksi Anomali\n\n`;
      response += `- **Anomali:** ${anomalyEmoji} ${anomaly.is_anomaly ? 'Terdeteksi' : 'Tidak ada'}\n`;
      response += `- **Score:** ${anomaly.score.toFixed(3)}\n`;
      response += `- **Status:** ${anomaly.status}\n`;
      response += `- **Terakhir cek:** ${new Date(anomaly.created_at).toLocaleString('id-ID')}\n\n`;
    } else {
      response += `### 🔍 Deteksi Anomali\n\nBelum ada data anomali untuk mesin ini.\n\n`;
    }
    
    // Recommendation
    response += `### 💡 Rekomendasi\n\n`;
    response += generateRecommendation(sensorData, prediction, anomaly);
    
    return response;
    
  } catch (error) {
    console.error("getMachineSnapshot error:", error);
    return `### ⚠️ Error\n\nGagal mengambil data mesin: ${error.message}`;
  }
}

/**
 * Get status badge for sensor value
 */
function getStatusBadge(param, value) {
  if (param === 'tool_wear') {
    if (value < 100) return '✅ Normal';
    if (value < 150) return '⚠️ Warning';
    return '🔴 Critical';
  }
  
  if (param === 'air_temp') {
    if (value >= 295 && value <= 302) return '✅ Normal';
    return '⚠️ Abnormal';
  }
  
  if (param === 'process_temp') {
    if (value >= 305 && value <= 312) return '✅ Normal';
    if (value < 305) return 'ℹ️ Low';
    return '🔴 High';
  }
  
  if (param === 'rpm') {
    if (value >= 1300 && value <= 1600) return '✅ Normal';
    if (value < 1300) return '⚠️ Low';
    return '⚠️ High';
  }
  
  if (param === 'torque') {
    if (value >= 30 && value <= 50) return '✅ Normal';
    if (value < 30) return '⚠️ Low';
    return '⚠️ High';
  }
  
  return '–';
}

/**
 * Generate actionable recommendations
 */
function generateRecommendation(sensorData, prediction, anomaly) {
  const recommendations = [];
  
  // Tool wear recommendations
  if (sensorData.tool_wear > 150) {
    recommendations.push("🔴 **CRITICAL:** Tool wear melebihi batas (>150 min). Hentikan mesin dan ganti tool SEGERA!");
  } else if (sensorData.tool_wear > 120) {
    recommendations.push("⚠️ **WARNING:** Tool wear tinggi (>120 min). Jadwalkan penggantian dalam 24-48 jam.");
  } else if (sensorData.tool_wear > 100) {
    recommendations.push("ℹ️ Tool wear mendekati batas warning. Siapkan spare parts.");
  }
  
  // Temperature recommendations
  if (sensorData.process_temperature > 312) {
    recommendations.push("🔴 **HIGH TEMP:** Process temperature melebihi normal (>312°K). Periksa sistem pendinginan segera!");
  } else if (sensorData.process_temperature < 305) {
    recommendations.push("ℹ️ Process temperature rendah (<305°K). Mesin mungkin underutilized atau ada masalah heater.");
  }
  
  if (sensorData.air_temperature > 302) {
    recommendations.push("⚠️ Air temperature tinggi (>302°K). Periksa ventilasi ruangan.");
  }
  
  // RPM recommendations
  if (sensorData.rotational_speed < 1300) {
    recommendations.push("⚠️ RPM rendah (<1300). Periksa power supply dan motor drive.");
  } else if (sensorData.rotational_speed > 1600) {
    recommendations.push("⚠️ RPM tinggi (>1600). Kurangi beban atau check setpoint.");
  }
  
  // Torque recommendations
  if (sensorData.torque < 30) {
    recommendations.push("⚠️ Torque rendah (<30 Nm). Indikasi beban kurang atau power issue.");
  } else if (sensorData.torque > 50) {
    recommendations.push("⚠️ Torque tinggi (>50 Nm). Risiko overstrain - kurangi beban kerja.");
  }
  
  // Prediction-based recommendations
  if (prediction) {
    if (prediction.status === 'CRITICAL' && prediction.confidence > 0.8) {
      recommendations.push(`🔴 **ML PREDICTION:** High confidence (${(prediction.confidence * 100).toFixed(1)}%) ${prediction.predicted_failure} failure. Inspeksi segera diperlukan!`);
    } else if (prediction.status === 'WARNING') {
      recommendations.push(`⚠️ **ML PREDICTION:** Moderate risk of ${prediction.predicted_failure}. Monitor lebih ketat.`);
    }
  }
  
  // Anomaly-based recommendations
  if (anomaly && anomaly.is_anomaly) {
    if (anomaly.score > 1.0) {
      recommendations.push(`🔍 **ANOMALY DETECTED:** High anomaly score (${anomaly.score.toFixed(3)}). Pola operasi abnormal - investigasi diperlukan.`);
    } else if (anomaly.score > 0.5) {
      recommendations.push(`🔍 Anomali terdeteksi (score: ${anomaly.score.toFixed(3)}). Perhatikan parameter yang tidak biasa.`);
    }
  }
  
  // If everything is normal
  if (recommendations.length === 0) {
    return " **NORMAL:** Mesin beroperasi dalam kondisi baik. Lanjutkan monitoring rutin sesuai jadwal.";
  }
  
  return recommendations.join('\n\n');
}

/**
 * Get quick machine status (simplified version)
 */
export async function getQuickMachineStatus(machineId) {
  try {
    const data = await getLatestByMachine(machineId);
    
    if (!data) {
      return { 
        machine_id: machineId, 
        status: "NOT_FOUND",
        message: "Mesin tidak ditemukan"
      };
    }
    
    // Determine overall status
    let status = "NORMAL";
    let issues = [];
    
    if (data.tool_wear > 150) {
      status = "CRITICAL";
      issues.push("Tool wear critical");
    } else if (data.tool_wear > 120) {
      status = "WARNING";
      issues.push("Tool wear high");
    }
    
    if (data.process_temperature > 312 || data.process_temperature < 305) {
      if (status === "NORMAL") status = "WARNING";
      issues.push("Process temp abnormal");
    }
    
    if (data.rotational_speed < 1300 || data.rotational_speed > 1600) {
      if (status === "NORMAL") status = "WARNING";
      issues.push("RPM abnormal");
    }
    
    return {
      machine_id: machineId,
      status,
      issues,
      sensor_data: data,
    };
    
  } catch (error) {
    return {
      machine_id: machineId,
      status: "ERROR",
      message: error.message,
    };
  }
}

export async function compareMachines(machineId1, machineId2) {
  try {
    const [machine1, machine2] = await Promise.all([
      getMachineSnapshot(machineId1),
      getMachineSnapshot(machineId2),
    ]);
    
    return `## Perbandingan Mesin\n\n` +
           `### Mesin ${machineId1}\n${machine1}\n\n` +
           `---\n\n` +
           `### Mesin ${machineId2}\n${machine2}`;
    
  } catch (error) {
    return `###  Error\n\nGagal membandingkan mesin: ${error.message}`;
  }
}