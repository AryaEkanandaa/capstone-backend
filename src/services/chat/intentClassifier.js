export const INTENT_TYPES = {
    SINGLE_MACHINE: "single_machine",
    MULTIPLE_MACHINES: "multiple_machines",
    MACHINE_TREND: "machine_trend",
    CRITICAL_STATUS: "critical_status",
    WARNING_STATUS: "warning_status",
    ALL_MACHINES: "all_machines",
    ANOMALY_CHECK: "anomaly_check",
    MANUAL_PREDICTION: "manual_prediction",
    MAINTENANCE_TICKET: "maintenance_ticket",
    GENERAL_CHAT: "general_chat",
};

export function classifyIntent(message) {
    const msg = message.toLowerCase().trim();

    // 🔍 DEBUG LOG
    console.log("📥 Incoming message:", message);
    console.log("📥 Lowercased:", msg);

    // ============================================================
    // 1️⃣ PRIORITAS UTAMA — DETEKSI TIKET MAINTENANCE
    // ============================================================
    if (/buat(kan)?\s*tiket\s*maintenance.*mesin\s*\d+/i.test(msg)) {
        const machine_id = Number(msg.match(/mesin\s*(\d+)/i)?.[1]);
        const reason = extractMaintenanceReason(msg, machine_id);

        return {
            type: INTENT_TYPES.MAINTENANCE_TICKET,
            confidence: 0.97,
            metadata: {
                machine_id,
                reason,
            }
        };
    }

    // ============================================================
    // 2️⃣ INPUT SENSOR MANUAL (PRIORITAS TINGGI)
    // ============================================================
    console.log("🧪 Testing hasManualSensorInput...");
    const hasManual = hasManualSensorInput(msg);
    console.log("🧪 hasManualSensorInput result:", hasManual);

    if (hasManual) {
        const extracted = extractSensorNumbers(msg);
        console.log("🧪 Extracted metadata:", extracted);

        return {
            type: INTENT_TYPES.MANUAL_PREDICTION,
            confidence: 0.95,
            metadata: extracted,
        };
    }
    const machineIds = [];
    const regex = /(?:mesin|machine)\s*(\d+)/gi;
    let match;

    while ((match = regex.exec(msg)) !== null) {
        machineIds.push(Number(match[1]));
    }

    console.log("🔢 Detected machine IDs:", machineIds);

    if (machineIds.length > 1) {
        console.log("✅ Multiple machines detected:", machineIds);

        return {
            type: INTENT_TYPES.MULTIPLE_MACHINES,
            confidence: 0.9,
            metadata: { machine_ids: machineIds },
        };
    }
    // ============================================================
    // 3️⃣ INTENT BERBASIS MESIN (SINGLE / TREND)
    // ============================================================
    const machineMatch = msg.match(/(?:mesin|machine)\s*(\d+)/i);

    if (machineMatch) {
        const machineId = Number(machineMatch[1]);

        if (/trend|tren|history|riwayat|grafik|perkembangan/i.test(msg)) {
            return {
                type: INTENT_TYPES.MACHINE_TREND,
                confidence: 0.9,
                metadata: { machine_id: machineId, hours: 24 },
            };
        }

        return {
            type: INTENT_TYPES.SINGLE_MACHINE,
            confidence: 0.85,
            metadata: { machine_id: machineId },
        };
    }

    // ============================================================
    // 4️⃣ INTENT BERBASIS STATUS
    // ============================================================
    if (/kritis|critical|bahaya|urgent|emergency/i.test(msg)) {
        return {
            type: INTENT_TYPES.CRITICAL_STATUS,
            confidence: 0.9,
            metadata: {},
        };
    }

    if (/warning|waspada|perlu perhatian|hati.?hati/i.test(msg)) {
        return {
            type: INTENT_TYPES.WARNING_STATUS,
            confidence: 0.85,
            metadata: {},
        };
    }

    if (/anomali|anomaly|tidak normal|aneh/i.test(msg)) {
        return {
            type: INTENT_TYPES.ANOMALY_CHECK,
            confidence: 0.85,
            metadata: {},
        };
    }

    if (/semua mesin|status semua|overview|ringkasan|dashboard|summary/i.test(msg)) {
        return {
            type: INTENT_TYPES.ALL_MACHINES,
            confidence: 0.9,
            metadata: {},
        };
    }

    // ============================================================
    // 5️⃣ DEFAULT — GENERAL CHAT
    // ============================================================
    return {
        type: INTENT_TYPES.GENERAL_CHAT,
        confidence: 0.5,
        metadata: {},
    };
}

// ============================================================
// SENSOR MANUAL DETECTOR (FIXED REGEX)
// ============================================================
function hasManualSensorInput(msg) {
    // Improved patterns to match "Air Temp = 32" or "air temp 32" or "air temp: 32"
    const patterns = [
        /air\s*temp(?:erature)?[\s=:]+(\d+(?:\.\d+)?)/i,      // Air Temp = 32
        /process\s*temp(?:erature)?[\s=:]+(\d+(?:\.\d+)?)/i,  // Process Temp = 32
        /\brpm[\s=:]+(\d+(?:\.\d+)?)/i,                       // RPM = 421
        /torque[\s=:]+(\d+(?:\.\d+)?)/i,                      // Torque = 2145
        /(?:tool\s*)?wear[\s=:]+(\d+(?:\.\d+)?)/i,           // Wear = 3
    ];

    const matches = patterns.filter((p) => p.test(msg));

    // 🔍 DEBUG: Log setiap pattern
    console.log("🧪 Pattern matching results:");
    patterns.forEach((p, i) => {
        const match = msg.match(p);
        const labels = ["air_temp", "process_temp", "rpm", "torque", "wear"];
        console.log(`   - ${labels[i]}: ${match ? `✅ ${match[1]}` : '❌'}`);
    });
    console.log(`🧪 Total matches: ${matches.length}/5 (need >= 3)`);

    return matches.length >= 3;  // Minimal 3 parameter terdeteksi
}

// ============================================================
// PARSE SENSOR DATA (FIXED REGEX)
// ============================================================
export function extractSensorNumbers(text) {
    const msg = text.toLowerCase().trim();

    // Improved regex with flexible separators
    const air = msg.match(/air\s*temp(?:erature)?[\s=:]+(\d+(?:\.\d+)?)/i)?.[1];
    const proc = msg.match(/process\s*temp(?:erature)?[\s=:]+(\d+(?:\.\d+)?)/i)?.[1];
    const rpm = msg.match(/\brpm[\s=:]+(\d+(?:\.\d+)?)/i)?.[1];
    const torque = msg.match(/torque[\s=:]+(\d+(?:\.\d+)?)/i)?.[1];
    const wear = msg.match(/(?:tool\s*)?wear[\s=:]+(\d+(?:\.\d+)?)/i)?.[1];

    console.log("🧪 Extracted raw values:", { air, proc, rpm, torque, wear });

    // Jika tidak ada satupun yang terdeteksi, return null
    if ([air, proc, rpm, torque, wear].every((v) => !v)) {
        console.log("⚠️ No sensor values extracted!");
        return null;
    }

    const result = {
        air_temp: air ? Number(air) : null,
        process_temp: proc ? Number(proc) : null,
        rpm: rpm ? Number(rpm) : null,
        torque: torque ? Number(torque) : null,
        tool_wear: wear ? Number(wear) : null,
    };

    console.log("🧪 Final extracted numbers:", result);

    return result;
}

// ============================================================
// LLM HANDLING
// ============================================================
export function needsLLM(intent) {
    const noLLMIntents = [
        INTENT_TYPES.MANUAL_PREDICTION,
        INTENT_TYPES.MAINTENANCE_TICKET,
        INTENT_TYPES.SINGLE_MACHINE,
        INTENT_TYPES.MULTIPLE_MACHINES,
        INTENT_TYPES.MACHINE_TREND,
        INTENT_TYPES.CRITICAL_STATUS,
        INTENT_TYPES.WARNING_STATUS,
        INTENT_TYPES.ALL_MACHINES,
        INTENT_TYPES.ANOMALY_CHECK,
    ];

    return !noLLMIntents.includes(intent.type);
}

// ============================================================
// TOOL MAPPING
// ============================================================
export function getSuggestedTools(intent) {
    const toolMap = {
        [INTENT_TYPES.SINGLE_MACHINE]: ["get_machine_data"],
        [INTENT_TYPES.MULTIPLE_MACHINES]: ["get_multiple_machines_data"],
        [INTENT_TYPES.MACHINE_TREND]: ["get_machine_trend"],
        [INTENT_TYPES.CRITICAL_STATUS]: ["get_critical_machines"],
        [INTENT_TYPES.WARNING_STATUS]: ["get_warning_machines"],
        [INTENT_TYPES.ALL_MACHINES]: ["get_all_machines_summary"],
        [INTENT_TYPES.ANOMALY_CHECK]: ["get_anomaly_machines"],
        [INTENT_TYPES.MANUAL_PREDICTION]: null,
        [INTENT_TYPES.MAINTENANCE_TICKET]: ["create_ticket"],
        [INTENT_TYPES.GENERAL_CHAT]: null,
    };

    return toolMap[intent.type];
}

// ============================================================
// PROMPT BUILDER
// ============================================================
export function buildIntentPrompt(intent, message, context = "") {
    const basePrompt = `Kamu adalah teknisi ahli mesin industri.
User bertanya: "${message}"

${context}

Berikan analisis singkat, padat, dan actionable.`;

    if (intent.confidence > 0.8) {
        const map = {
            [INTENT_TYPES.SINGLE_MACHINE]: "Fokus pada kondisi mesin.",
            [INTENT_TYPES.MULTIPLE_MACHINES]: "Berikan kondisi mesin-mesin ini.",
            [INTENT_TYPES.MACHINE_TREND]: "Analisis trend.",
            [INTENT_TYPES.CRITICAL_STATUS]: "Prioritaskan mesin paling urgent.",
            [INTENT_TYPES.WARNING_STATUS]: "Identifikasi potensi eskalasi.",
            [INTENT_TYPES.ALL_MACHINES]: "Berikan ringkasan singkat.",
            [INTENT_TYPES.ANOMALY_CHECK]: "Jelaskan penyebab anomali.",
            [INTENT_TYPES.MANUAL_PREDICTION]: "Interpretasi hasil model ML.",
        };

        if (map[intent.type]) {
            return `${basePrompt}\n\nFOKUS: ${map[intent.type]}`;
        }
    }

    return basePrompt;
}

// ============================================================
// EXTRACT REASON (for maintenance ticket)
// ============================================================
function extractMaintenanceReason(msg, machineId) {
    const index = msg.indexOf(`mesin ${machineId}`);
    if (index === -1) return null;

    let reason = msg.slice(index + (`mesin ${machineId}`).length).trim();

    const r = msg.match(/karena\s+(.+)/i);
    if (r && r[1]) return r[1].trim();

    if (reason.length < 5) return null;

    return reason;
}

// ============================================================
// VALIDATION
// ============================================================
export function validateIntent(intent) {
    if (intent.type === INTENT_TYPES.SINGLE_MACHINE) {
        if (!intent.metadata.machine_id || intent.metadata.machine_id < 1) {
            return { valid: false, error: "Invalid machine_id" };
        }
    }
    if (intent.type === INTENT_TYPES.MULTIPLE_MACHINES) {
        if (!intent.metadata.machine_ids || intent.metadata.machine_ids.length < 2) {
            return { valid: false, error: "Need at least 2 machine IDs" };
        }
    }

    if (intent.type === INTENT_TYPES.MANUAL_PREDICTION) {
        const { air_temp, process_temp, rpm, torque, tool_wear } = intent.metadata;
        if (!air_temp || !process_temp || !rpm || !torque || !tool_wear) {
            return { valid: false, error: "Incomplete sensor data" };
        }
    }

    return { valid: true };
}

// DEBUG UTILITY (untuk testing manual)
export function testSensorPatterns(message) {
    const msg = message.toLowerCase().trim();

    const patterns = [
        { name: "air_temp", regex: /air\s*temp(?:erature)?[\s=:]+(\d+(?:\.\d+)?)/i },
        { name: "process_temp", regex: /process\s*temp(?:erature)?[\s=:]+(\d+(?:\.\d+)?)/i },
        { name: "rpm", regex: /\brpm[\s=:]+(\d+(?:\.\d+)?)/i },
        { name: "torque", regex: /torque[\s=:]+(\d+(?:\.\d+)?)/i },
        { name: "wear", regex: /(?:tool\s*)?wear[\s=:]+(\d+(?:\.\d+)?)/i },
    ];

    console.log("\n========== TESTING SENSOR PATTERNS ==========");
    console.log("Message:", msg);
    console.log("\nPattern Results:");

    patterns.forEach(p => {
        const match = msg.match(p.regex);
        console.log(`  ${p.name.padEnd(15)}: ${match ? `✅ ${match[1]}` : '❌ Not found'}`);
    });

    const totalMatches = patterns.filter(p => p.regex.test(msg)).length;
    console.log(`\nTotal matches: ${totalMatches}/5`);
    console.log(`Should detect: ${totalMatches >= 3 ? '✅ YES' : '❌ NO'}`);
    console.log("=============================================\n");

    return totalMatches >= 3;
}