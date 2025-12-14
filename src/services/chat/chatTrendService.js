// udah ga pake

import { getMachineTrend } from "../sensor/sensorService.js";

export async function getTrendResponse(message, machineMatch) {
  try {
    const machineId = Number(machineMatch[1]);
    
    // Determine hours from message (default 24)
    let hours = 24;
    const hourMatch = message.match(/(\d+)\s*(?:jam|hour)/i);
    if (hourMatch) {
      hours = Math.min(Number(hourMatch[1]), 168); // Max 7 days
    }
    
    const trendData = await getMachineTrend(machineId, hours);
    
    if (!trendData || trendData.length === 0) {
      return `### ⚠️ Trend Mesin ${machineId}\n\nTidak ada data trend untuk mesin ${machineId} dalam ${hours} jam terakhir.`;
    }
    
    // Calculate statistics
    const latest = trendData[0];
    const oldest = trendData[trendData.length - 1];
    
    const tempChange = latest.process_temp - oldest.process_temp;
    const rpmChange = latest.rpm - oldest.rpm;
    const wearChange = latest.tool_wear - oldest.tool_wear;
    
    // Determine trend directions
    const tempTrend = tempChange > 5 ? "📈 Naik" : tempChange < -5 ? "📉 Turun" : "➡️ Stabil";
    const rpmTrend = rpmChange > 100 ? "📈 Naik" : rpmChange < -100 ? "📉 Turun" : "➡️ Stabil";
    const wearTrend = wearChange > 10 ? "⚠️ Meningkat Cepat" : wearChange > 5 ? "➡️ Normal" : "✅ Minimal";
    
    // Build response
    let response = `### 📈 Trend Mesin ${machineId} (${hours} jam terakhir)\n\n`;
    response += `**Data Points:** ${trendData.length} pembacaan\n\n`;
    
    response += `#### Perubahan Parameter\n\n`;
    response += `| Parameter | Awal | Terkini | Perubahan | Trend |\n`;
    response += `|-----------|------|---------|-----------|-------|\n`;
    response += `| **Process Temp** | ${oldest.process_temp}°K | ${latest.process_temp}°K | ${tempChange > 0 ? '+' : ''}${tempChange.toFixed(1)}°K | ${tempTrend} |\n`;
    response += `| **RPM** | ${oldest.rpm} | ${latest.rpm} | ${rpmChange > 0 ? '+' : ''}${rpmChange} | ${rpmTrend} |\n`;
    response += `| **Tool Wear** | ${oldest.tool_wear} | ${latest.tool_wear} | ${wearChange > 0 ? '+' : ''}${wearChange} min | ${wearTrend} |\n`;
    response += `| **Torque** | ${oldest.torque} Nm | ${latest.torque} Nm | ${(latest.torque - oldest.torque) > 0 ? '+' : ''}${(latest.torque - oldest.torque).toFixed(1)} Nm | – |\n\n`;
    
    // Analysis
    response += `#### 🔍 Analisis\n\n`;
    
    const insights = [];
    
    if (tempChange > 5) {
      insights.push("⚠️ Suhu meningkat signifikan - perhatikan sistem pendinginan");
    } else if (tempChange < -5) {
      insights.push("ℹ️ Suhu menurun - mesin mungkin underutilized");
    }
    
    if (Math.abs(rpmChange) > 100) {
      insights.push("⚠️ RPM berfluktuasi besar - indikasi beban tidak stabil");
    }
    
    if (wearChange > 15) {
      insights.push("🔴 Tool wear meningkat cepat - segera jadwalkan maintenance");
    } else if (wearChange > 10) {
      insights.push("⚠️ Tool wear meningkat - perhatikan dalam beberapa hari");
    }
    
    if (latest.tool_wear > 150) {
      insights.push("🔴 Tool wear sudah CRITICAL (>150) - ganti tool segera!");
    }
    
    if (insights.length === 0) {
      response += "✅ Trend normal, tidak ada anomali signifikan terdeteksi.\n";
    } else {
      response += insights.join('\n') + '\n';
    }
    
    // Recommendation
    response += `\n#### 💡 Rekomendasi\n\n`;
    
    if (latest.tool_wear > 150) {
      response += "🔴 **URGENT:** Hentikan mesin dan ganti tool segera.\n";
    } else if (wearChange > 15 || tempChange > 8) {
      response += "⚠️ **PERHATIAN:** Jadwalkan inspeksi dalam 24-48 jam.\n";
    } else {
      response += "✅ Lanjutkan monitoring rutin. Kondisi mesin dalam batas normal.\n";
    }
    
    return response;
    
  } catch (error) {
    console.error("getTrendResponse error:", error);
    return `### ⚠️ Error\n\nGagal mengambil data trend: ${error.message}`;
  }
}

/**
 * Calculate average values from trend data
 */
export function calculateTrendStats(trendData) {
  if (!trendData || trendData.length === 0) return null;
  
  const sum = trendData.reduce((acc, curr) => ({
    air_temp: acc.air_temp + curr.air_temp,
    process_temp: acc.process_temp + curr.process_temp,
    rpm: acc.rpm + curr.rpm,
    torque: acc.torque + curr.torque,
    tool_wear: acc.tool_wear + curr.tool_wear,
  }), {
    air_temp: 0,
    process_temp: 0,
    rpm: 0,
    torque: 0,
    tool_wear: 0,
  });
  
  const count = trendData.length;
  
  return {
    avg_air_temp: (sum.air_temp / count).toFixed(2),
    avg_process_temp: (sum.process_temp / count).toFixed(2),
    avg_rpm: Math.round(sum.rpm / count),
    avg_torque: (sum.torque / count).toFixed(2),
    avg_tool_wear: (sum.tool_wear / count).toFixed(2),
    data_points: count,
  };
}

/**
 * Detect trend anomalies
 */
export function detectTrendAnomalies(trendData) {
  if (!trendData || trendData.length < 2) return [];
  
  const anomalies = [];
  
  for (let i = 1; i < trendData.length; i++) {
    const prev = trendData[i - 1];
    const curr = trendData[i];
    
    // Sudden temperature spike
    if (curr.process_temp - prev.process_temp > 10) {
      anomalies.push({
        type: "temperature_spike",
        severity: "high",
        message: `Lonjakan suhu tiba-tiba: ${prev.process_temp}°K → ${curr.process_temp}°K`,
        timestamp: curr.created_at,
      });
    }
    
    // Sudden RPM drop
    if (prev.rpm - curr.rpm > 200) {
      anomalies.push({
        type: "rpm_drop",
        severity: "high",
        message: `RPM turun drastis: ${prev.rpm} → ${curr.rpm}`,
        timestamp: curr.created_at,
      });
    }
    
    // Rapid tool wear
    if (curr.tool_wear - prev.tool_wear > 20) {
      anomalies.push({
        type: "rapid_wear",
        severity: "medium",
        message: `Tool wear meningkat cepat: ${prev.tool_wear} → ${curr.tool_wear} min`,
        timestamp: curr.created_at,
      });
    }
  }
  
  return anomalies;
}