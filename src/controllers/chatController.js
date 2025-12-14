import { pool } from "../db/db.js";
import { orchestrateChat, validateMessage } from "../services/agent/agentOrchestrator.js";
import { getAgentHealth } from "../services/agent/langchainAgent.js";

import {
  detectTicketRequest,
  extractUserNotes,
  handleTicketCreation,
} from "../services/agent/tools/ticketTool.js";

// GET CHAT SESSIONS
export const getSessions = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "userId required" });
    }

    const result = await pool.query(
      `SELECT * FROM chat_sessions
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get Sessions Error:", error);
    res.status(500).json({ message: "Gagal mengambil session" });
  }
};

// CREATE NEW CHAT SESSION
export const createSession = async (req, res) => {
  try {
    const { userId, title } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId required" });
    }

    const result = await pool.query(
      `INSERT INTO chat_sessions (user_id, title)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, title || "Chat Baru"]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Create Session Error:", error);
    res.status(500).json({ message: "Gagal membuat session" });
  }
};

// LOAD MESSAGES
export const getMessages = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE session_id = $1 AND is_deleted = false
       ORDER BY created_at ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get Messages Error:", error);
    res.status(500).json({ message: "Gagal mengambil pesan" });
  }
};

export const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "session id required" });
    }

    // Soft delete messages
    await pool.query(
      `UPDATE chat_messages
       SET is_deleted = true
       WHERE session_id = $1`,
      [id]
    );

    // Delete session
    await pool.query(
      `DELETE FROM chat_sessions
       WHERE id = $1`,
      [id]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Delete Session Error:", error);
    return res.status(500).json({ message: "Gagal menghapus session" });
  }
};

// SEND MESSAGE (SIMPLE MODE)
export const sendMessage = async (req, res) => {
  try {
    const { session_id, message, userId } = req.body;

    // Basic validation
    const validation = validateMessage(message);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error });
    }

    if (!session_id) {
      return res.status(400).json({ message: "session_id required" });
    }

    // Rate limiter
    const health = getAgentHealth();
    if (health.rate_limited) {
      return res.status(429).json({
        message: `Sistem sedang recovery dari rate limit. Coba lagi dalam ${health.cooldown_remaining} detik.`,
        cooldown_seconds: health.cooldown_remaining,
      });
    }
    // SAVE USER MESSAGE

    await pool.query(
      `INSERT INTO chat_messages (session_id, sender, content)
       VALUES ($1, 'user', $2)`,
      [session_id, message]
    );

    // AUTO RENAME (HANYA PESAN USER PERTAMA)
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM chat_messages
       WHERE session_id = $1 AND sender = 'user'`,
      [session_id]
    );

    if (Number(countResult.rows[0].count) === 1) {
      const title =
        message.length > 50
          ? message.slice(0, 50) + "..."
          : message;

      await pool.query(
        `UPDATE chat_sessions
         SET title = $1
         WHERE id = $2`,
        [title, session_id]
      );
    }

    // LOAD SHORT HISTORY

    const historyResult = await pool.query(
      `SELECT sender, content
       FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [session_id]
    );

    const chatHistory = historyResult.rows
      .reverse()
      .map((m) => `${m.sender === "user" ? "User" : "AI"}: ${m.content}`)
      .join("\n");

    // TICKET MODE
    const ticketDetection = detectTicketRequest(message);

    if (ticketDetection.isTicketRequest) {
      const machineId = ticketDetection.machineId;

      const userNotes =
        extractUserNotes(message) ||
        message ||
        "User tidak memberikan alasan";

      const created = await handleTicketCreation({
        machineId,
        userId,
        userNotes,
        conversationContext: chatHistory,
      });

      const ticketPayload = {
        type: "ticket_confirmation",
        ticket_number: created.ticket.ticketNumber,
        machine_name: `Machine ${created.ticket.machineId}`,
        status: created.ticket.status,
        priority: created.ticket.priority,
      };


      // simpan ke DB (JSON STRING)
      await pool.query(
        `INSERT INTO chat_messages (session_id, sender, content)
   VALUES ($1, 'bot', $2)`,
        [session_id, JSON.stringify(ticketPayload)]
      );

      // TOUCH SESSION
      await pool.query(
        `UPDATE chat_sessions
   SET updated_at = NOW()
   WHERE id = $1`,
        [session_id]
      );

      // kirim ke frontend
      return res.json({
        reply: JSON.stringify(ticketPayload),
      });
    }

    // NORMAL AI MODE
    const result = await orchestrateChat(message, chatHistory);

    await pool.query(
      `INSERT INTO chat_messages (session_id, sender, content)
       VALUES ($1, 'bot', $2)`,
      [session_id, result.reply]
    );

    // TOUCH SESSION
    await pool.query(
      `UPDATE chat_sessions
       SET updated_at = NOW()
       WHERE id = $1`,
      [session_id]
    );

    return res.json({
      reply: result.reply,
      metadata: {
        method: result.method,
        intent: result.intent,
        processed_at: Date.now(),
      },
    });

  } catch (error) {
    console.error("Send Message Error:", error);

    return res.status(500).json({
      message: "Terjadi kesalahan sistem. Silakan coba lagi.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};