import { createManualTicket } from "../../maintenance/maintenanceTicketService.js";

export async function handleTicketCreation(input) {
  const { machineId, userId, userNotes, conversationContext } = input;

  try {
    const ticket = await createManualTicket(
      machineId,
      userId,
      userNotes,
      conversationContext
    );

    return {
      success: true,
      ticket: {
        ticketNumber: ticket.ticket_number,
        machineId: ticket.machine_id,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.created_at,
      },
      message: `Tiket maintenance berhasil dibuat!

**Nomor Tiket:** ${ticket.ticket_number}
**Mesin:** Machine ${ticket.machine_id}
**Status:** ${ticket.status}
**Prioritas:** ${ticket.priority}

Silakan cek halaman **Maintenance Tickets** untuk detail lengkap.`,
    };

  } catch (error) {
    console.error("Ticket creation error:", error);

    return {
      success: false,
      error: error.message,
      message: `Gagal membuat tiket: ${error.message}`,
    };
  }
}

export function detectTicketRequest(userMessage) {
  const msg = userMessage.toLowerCase().trim();

  const triggers = [
    /\b(buat|buatkan|tolong buat|tolong buatkan)\b.*\b(tiket|ticket)\b/,
    /\b(perlu|butuh)\b.*\bmaintenance\b/,
    /\b(request|permintaan)\b.*\bmaintenance\b/,
    /\bmaintenance\b.*\b(mohon|tolong|please)\b/,
  ];

  const machineMatch = msg.match(/(?:mesin|machine)\s*(\d+)/i);
  const isRequest = triggers.some((p) => p.test(msg));

  if (isRequest && machineMatch) {
    return {
      isTicketRequest: true,
      machineId: parseInt(machineMatch[1]),
      rawMessage: userMessage,
    };
  }

  return { isTicketRequest: false, machineId: null };
}

export function extractUserNotes(userMessage) {
  const msg = userMessage.trim();

  const reasonPatterns = [
    /karena\s+(.+)/i,
    /sebab\s+(.+)/i,
    /alasan\s*:?\s*(.+)/i,
  ];

  for (const p of reasonPatterns) {
    const match = msg.match(p);
    if (match && match[1]) return match[1].trim();
  }

  let cleaned = msg
    .replace(/buat(kan)?\s*(saya\s*)?tiket( maintenance)?/gi, "")
    .replace(/request(.*)?maintenance/gi, "")
    .replace(/maintenance(.*)?request/gi, "")
    .replace(/mesin\s*\d+/gi, "")
    .replace(/machine\s*\d+/gi, "")
    .trim();

  if (!cleaned || cleaned.length < 3) return null;

  return cleaned;
}
