import { INTENT_TYPES } from "./intentClassifier.js";

export function formatResponse(data, intent) {
  if (typeof data === "string") {
    return ensureHeading(data);
  }

  if (data.type === "error") {
    return `### ⚠️ Informasi\n\n${data.message}`;
  }

  switch (intent.type) {

    case INTENT_TYPES.SINGLE_MACHINE:
      return JSON.stringify(data);

    case INTENT_TYPES.MACHINE_TREND:
      return formatMachineTrend(data);

    case INTENT_TYPES.CRITICAL_STATUS:
      return formatCriticalStatus(data);

    case INTENT_TYPES.WARNING_STATUS:
      return formatWarningStatus(data);

    case INTENT_TYPES.ALL_MACHINES:
      return JSON.stringify({
        type: "all_machine_status",
        machines: data.machines,
      });


    case INTENT_TYPES.ANOMALY_CHECK:
      return formatAnomalyCheck(data);

    case INTENT_TYPES.MANUAL_PREDICTION:
      return formatManualPrediction(data);

    default:
      return ensureHeading(JSON.stringify(data));
  }
}

// function formatSingleMachine(data) {
//   const m = data.data;
//   const id = data.machine_id;

//   const getStatusBadge = (param, value) => {
//     if (param === 'tool_wear') {
//       if (value < 100) return ' Normal';
//       if (value < 150) return ' Warning';
//       return ' Critical';
//     }
//     if (param === 'air_temp') {
//       if (value >= 295 && value <= 302) return ' Normal';
//       return ' Abnormal';
//     }
//     if (param === 'process_temp') {
//       if (value >= 305 && value <= 312) return ' Normal';
//       return ' Abnormal';
//     }
//     if (param === 'rpm') {
//       if (value >= 1300 && value <= 1600) return ' Normal';
//       return ' Abnormal';
//     }
//     if (param === 'torque') {
//       if (value >= 30 && value <= 50) return ' Normal';
//       return ' Low';
//     }
//     return '–';
//   };

//   return `## Status Mesin ${id}

// | Parameter | Nilai | Status |
// |-----------|-------|--------|
// | **Air Temperature** | ${m.air_temperature}°K | ${getStatusBadge('air_temp', m.air_temperature)} |
// | **Process Temperature** | ${m.process_temperature}°K | ${getStatusBadge('process_temp', m.process_temperature)} |
// | **RPM** | ${m.rotational_speed} | ${getStatusBadge('rpm', m.rotational_speed)} |
// | **Torque** | ${m.torque} Nm | ${getStatusBadge('torque', m.torque)} |
// | **Tool Wear** | ${m.tool_wear} min | ${getStatusBadge('tool_wear', m.tool_wear)} |

// **Terakhir update:** ${new Date(m.created_at).toLocaleString('id-ID')}

// ### Rekomendasi
// ${generateRecommendation(m)}
// `;
// }

function formatMachineTrend(data) {
  const { machine_id, hours, data: trendData } = data;

  if (!trendData || trendData.length === 0) {
    return `###  Trend Mesin ${machine_id}\n\nTidak ada data trend tersedia.`;
  }

  const latest = trendData[0];
  const oldest = trendData[trendData.length - 1];

  const tempChange = latest.process_temperature - oldest.process_temperature;
  const rpmChange = latest.rpm - oldest.rpm;
  const wearChange = latest.tool_wear - oldest.tool_wear;

  const tempTrend = tempChange > 5 ? " Naik" : tempChange < -5 ? " Turun" : " Stabil";
  const rpmTrend = rpmChange > 100 ? " Naik" : rpmChange < -100 ? " Turun" : " Stabil";
  const wearTrend = wearChange > 10 ? " Meningkat" : " Normal";

  return `## 📈 Trend Mesin ${machine_id} (${hours} jam terakhir)

**Data Points:** ${trendData.length} pembacaan

### Perubahan Parameter

| Parameter | Awal | Terkini | Perubahan | Trend |
|-----------|------|---------|-----------|-------|
| **Process Temp** | ${oldest.process_temperature}°K | ${latest.process_temperature}°K | ${tempChange > 0 ? '+' : ''}${tempChange.toFixed(1)}°K | ${tempTrend} |
| **RPM** | ${oldest.rotational_speed} | ${latest.rotational_speed} | ${rpmChange > 0 ? '+' : ''}${rpmChange} | ${rpmTrend} |
| **Tool Wear** | ${oldest.tool_wear} | ${latest.tool_wear} | ${wearChange > 0 ? '+' : ''}${wearChange} min | ${wearTrend} |

### 🔍 Analisis
${analyzeTrend(tempChange, rpmChange, wearChange)}
`;
}

/**
 * Format critical status
 */
function formatCriticalStatus(data) {
  const { critical, warning, normal, total } = data;

  if (critical.length === 0) {
    return `##  Status Critical

**Good news!** Tidak ada mesin dalam status CRITICAL.

### Ringkasan
- **Critical:** 0 mesin 
- **Warning:** ${warning.length} mesin ${warning.length > 0 ? '⚠️' : '✅'}
- **Normal:** ${normal.length} mesin ✅
- **Total:** ${total} mesin

${warning.length > 0 ? formatWarningList(warning.slice(0, 5)) : ''}
`;
  }

  return `## 🔴 Status Critical (${critical.length} mesin)

${formatCriticalList(critical)}

### Ringkasan Keseluruhan
- **Critical:** ${critical.length} mesin 🔴
- **Warning:** ${warning.length} mesin ⚠️
- **Normal:** ${normal.length} mesin ✅

### Action Required
${critical.length} mesin memerlukan inspeksi segera!
`;
}

function formatWarningStatus(data) {
  const { machines, count } = data;

  if (count === 0) {
    return `##  Status Warning\n\nTidak ada mesin dalam status WARNING. Semua mesin dalam kondisi baik!`;
  }

  return `##  Status Warning (${count} mesin)

${formatWarningList(machines)}

**Catatan:** Mesin-mesin ini memerlukan monitoring lebih ketat.
`;
}

// function formatAllMachines(data) {
//   const { critical, warning, normal, total, health_score } = data;

//   return `## 📊 Status Semua Mesin

// ### Health Score: ${health_score}%

// | Status | Jumlah | Persentase |
// |--------|--------|------------|
// | 🔴 Critical | ${critical.length} | ${((critical.length / total) * 100).toFixed(1)}% |
// | ⚠️ Warning | ${warning.length} | ${((warning.length / total) * 100).toFixed(1)}% |
// | ✅ Normal | ${normal.length} | ${((normal.length / total) * 100).toFixed(1)}% |

// ${critical.length > 0 ? `### 🔴 Top Critical (${critical.length})\n${formatCriticalList(critical.slice(0, 3))}` : ''}
// ${warning.length > 0 ? `\n### ⚠️ Top Warning (${warning.length})\n${formatWarningList(warning.slice(0, 3))}` : ''}
// `;
// }


function formatAnomalyCheck(data) {
  const { machines, count } = data;

  if (count === 0) {
    return `##  Deteksi Anomali\n\nTidak ada mesin dengan anomali terdeteksi. Semua mesin beroperasi normal!`;
  }

  return `##  Mesin dengan Anomali (${count} mesin)

| Mesin ID | Anomaly Score | Severity | Rekomendasi |
|----------|---------------|----------|-------------|
${machines.map(m => {
    const score = m.score.toFixed(3);
    let severity, recommendation;

    if (m.score > 1.0) {
      severity = ' High';
      recommendation = 'Inspeksi segera';
    } else if (m.score > 0.5) {
      severity = ' Moderate';
      recommendation = 'Monitor ketat';
    } else {
      severity = ' Low';
      recommendation = 'Pengecekan rutin';
    }

    return `| **Mesin ${m.machine_id}** | ${score} | ${severity} | ${recommendation} |`;
  }).join('\n')}

**Catatan:** Anomaly score > 1.0 memerlukan perhatian segera.
`;
}

function formatManualPrediction(data) {
  const { input, prediction, anomaly } = data;

  return JSON.stringify({
    type: "manual_prediction",
    input: {
      air_temp: input.air_temp,
      process_temp: input.process_temp,
      rpm: input.rpm,
      torque: input.torque,
      tool_wear: input.tool_wear,
    },
    prediction: {
      predicted_failure: prediction.predicted_failure,
      confidence: prediction.confidence,
      status: prediction.status,
    },
    anomaly: {
      is_anomaly: anomaly.is_anomaly,
      score: anomaly.score.toFixed(3),
      status: anomaly.status,
    },
  });
}


function generateRecommendation(data) {
  const recommendations = [];

  if (data.tool_wear > 150) {
    recommendations.push(" **Tool wear critical** - Ganti tool segera!");
  } else if (data.tool_wear > 100) {
    recommendations.push(" **Tool wear tinggi** - Jadwalkan penggantian tool.");
  }

  if (data.process_temp > 312) {
    recommendations.push(" **Process temp tinggi** - Periksa sistem pendinginan.");
  }

  if (data.rpm < 1300 || data.rpm > 1600) {
    recommendations.push(" **RPM abnormal** - Kalibrasi kecepatan motor.");
  }

  if (data.torque < 30) {
    recommendations.push(" **Torque rendah** - Periksa beban mesin.");
  }

  if (recommendations.length === 0) {
    return " Mesin beroperasi dalam kondisi normal. Lanjutkan monitoring rutin.";
  }

  return recommendations.join('\n');
}

function analyzeTrend(tempChange, rpmChange, wearChange) {
  const insights = [];

  if (tempChange > 5) {
    insights.push(" Suhu meningkat signifikan - perhatikan sistem pendinginan");
  }

  if (Math.abs(rpmChange) > 100) {
    insights.push(" RPM berfluktuasi - indikasi beban tidak stabil");
  }

  if (wearChange > 15) {
    insights.push(" Tool wear meningkat cepat - segera jadwalkan maintenance");
  }

  if (insights.length === 0) {
    return " Trend normal, tidak ada anomali terdeteksi.";
  }

  return insights.join('\n');
}

function interpretPrediction(prediction, anomaly) {
  const confidence = prediction.confidence * 100;

  let interpretation = "";

  if (confidence > 80) {
    interpretation += ` **Confidence tinggi (${confidence.toFixed(1)}%)** - Prediksi sangat reliable.\n\n`;
  } else if (confidence > 50) {
    interpretation += ` **Confidence sedang (${confidence.toFixed(1)}%)** - Monitoring diperlukan.\n\n`;
  } else {
    interpretation += ` **Confidence rendah (${confidence.toFixed(1)}%)** - Risiko minimal.\n\n`;
  }

  if (anomaly.is_anomaly && anomaly.score > 1.0) {
    interpretation += " **Anomali terdeteksi dengan score tinggi** - Inspeksi segera disarankan!";
  } else if (anomaly.is_anomaly) {
    interpretation += " **Anomali terdeteksi** - Monitor lebih ketat.";
  } else {
    interpretation += " **Tidak ada anomali** - Parameter dalam range normal.";
  }

  return interpretation;
}

function formatCriticalList(machines) {
  return machines.map(m =>
    `- **Mesin ${m.machine_id}** → ${m.failure_type} (${(m.failure_probability * 100).toFixed(1)}%)`
  ).join('\n');
}

function formatWarningList(machines) {
  return machines.map(m =>
    `- **Mesin ${m.machine_id}** → ${m.failure_type} (${(m.failure_probability * 100).toFixed(1)}%)`
  ).join('\n');
}

function getStatusEmoji(status) {
  const emojiMap = {
    'CRITICAL': '🔴',
    'WARNING': '⚠️',
    'NORMAL': '✅',
  };
  return emojiMap[status] || '❓';
}

function ensureHeading(text) {
  if (!text) return "";
  const first = text.trim().split("\n")[0];
  if (/^#+\s/.test(first)) return text;
  return "## 💬 Jawaban\n\n" + text;
}