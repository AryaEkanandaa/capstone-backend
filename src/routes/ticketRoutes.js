import express from "express";
import { verifyAuth as authenticateToken } from "../middlewares/verifyAuth.js";
import { pool } from "../db/db.js";

import {
  getTickets,
  getTicketById,
  updateTicketStatus,
  createManualTicket,
} from "../services/maintenance/maintenanceTicketService.js";

import { triggerManualAutoTicketCreation } from "../jobs/autoTicketCreation.js";

const router = express.Router();

router.get("/stats/summary", authenticateToken, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(*) FILTER (WHERE status = 'OPEN') as open_tickets,
        COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_tickets,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_tickets,
        COUNT(*) FILTER (WHERE priority = 'CRITICAL') as critical_tickets,
        COUNT(*) FILTER (WHERE priority = 'HIGH') as high_priority_tickets,
        COUNT(*) FILTER (WHERE creation_type = 'AUTO') as auto_tickets,
        COUNT(*) FILTER (WHERE creation_type = 'MANUAL') as manual_tickets
      FROM maintenance_tickets
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error("Error fetching ticket stats:", error);
    res.status(500).json({ message: "Failed to fetch ticket statistics" });
  }
});

router.post("/auto/trigger", authenticateToken, async (req, res) => {
  try {
    const result = await triggerManualAutoTicketCreation();

    res.json({
      success: true,
      ticketsCreated: result.ticketsCreated,
      tickets: result.tickets,
    });
  } catch (error) {
    console.error("Error triggering auto tickets:", error);
    res.status(500).json({ message: "Failed to trigger auto ticket creation" });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const filters = {
      machine_id: req.query.machine_id ? parseInt(req.query.machine_id) : null,
      status: req.query.status || null,
      priority: req.query.priority || null,
      creation_type: req.query.creation_type || null,
    };

    const tickets = await getTickets(filters, req.user.id, req.user.role === "ADMIN");

    res.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ message: "Failed to fetch tickets" });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  try {
    const ticket = await createManualTicket({
      ...req.body,
      userId: req.user.id,
    });

    res.json(ticket);
  } catch (error) {
    console.error("Error creating manual ticket:", error);
    res.status(500).json({ message: "Failed to create ticket" });
  }
});

router.patch("/:id/status", authenticateToken, async (req, res) => {
  try {
    const { status, comment } = req.body;

    const ticket = await updateTicketStatus(req.params.id, status, req.user.id, comment);

    res.json({
      success: true,
      ticket,
      message: "Ticket status updated successfully",
    });
  } catch (error) {
  console.error("🔥 ERROR update status:", error.message, error);
  return res.status(500).json({
    message: "Failed to update ticket status",
    detail: error.message,
  });
}
});

router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const ticket = await getTicketById(req.params.id);

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    res.json(ticket);
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({ message: "Failed to fetch ticket" });
  }
});

export default router;
