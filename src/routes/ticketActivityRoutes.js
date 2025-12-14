import express from "express";
import { verifyAuth as authenticateToken } from "../middlewares/verifyAuth.js";
import { pool } from "../db/db.js";

const router = express.Router();

router.get("/:ticketId", authenticateToken, async (req, res) => {
    try {
        const { ticketId } = req.params;

        const result = await pool.query(
            `
SELECT 
  tal.id,
  tal.ticket_id,
  tal.user_id,
  u.full_name AS full_name,
  tal.action,
  tal.old_value,
  tal.new_value,
  tal.comment,
  tal.created_at
FROM ticket_activity_logs tal
LEFT JOIN users u ON tal.user_id = u.id
WHERE tal.ticket_id = $1
ORDER BY tal.created_at DESC


      `,
            [ticketId]
        );

        return res.json(result.rows);

    } catch (error) {
        console.error("Error fetching ticket activity:", error);
        res.status(500).json({ message: "Failed to fetch ticket activity" });
    }
});

export default router;
