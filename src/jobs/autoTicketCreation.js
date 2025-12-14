import cron from "node-cron";
import { createAutoTickets } from "../services/maintenance/maintenanceTicketService.js";

export function startAutoTicketCron() {
  // 1 jam dulu, limit API KEY AI
cron.schedule("0 */1 * * * *", async () => {
  console.log("[CRON] Running auto ticket creation (every 1 minute)");

    try {
      const tickets = await createAutoTickets();

      console.log(
        `[CRON] Auto-created ${tickets.length} maintenance ticket(s)`
      );
    } catch (error) {
      console.error("[CRON] Auto ticket creation failed:", error);
    }
  });

  console.log("Auto ticket cron job started (runs every hour)");
}

export async function triggerManualAutoTicketCreation() {
  console.log("Manual trigger: Creating auto tickets...");

  try {
    const tickets = await createAutoTickets();

    return {
      success: true,
      ticketsCreated: tickets.length,
      tickets: tickets.map((t) => ({
        ticketNumber: t.ticket_number,
        machineId: t.machine_id,
        priority: t.priority,
      })),
    };
  } catch (error) {
    console.error("Manual auto ticket creation failed:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}
