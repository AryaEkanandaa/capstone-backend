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
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.created_at,
      },
      message: ` Tiket maintenance berhasil dibuat!

Nomor tiket **${ticket.ticket_number}** untuk **Mesin ${ticket.machine_id}** telah diterbitkan.

Silakan buka halaman **Maintenance Ticket** untuk melihat detail dan status terbaru.`,
    };

  } catch (error) {
    console.error("Ticket creation error:", error);
    return {
      success: false,
      error: error.message,
      message: ` Gagal membuat tiket maintenance: ${error.message}`,
    };
  }
}


export function detectTicketRequest(userMessage) {
  const msg = userMessage.toLowerCase().trim();

  const ticketTriggers = [
    /\b(buat|buatkan|tolong.*buat|tolong.*buatkan)\b.*\b(tiket|ticket)\b.*\bmaintenance\b/,
    /\b(request|permintaan)\b.*\bmaintenance\b/,
    /\bperlu\b.*\bmaintenance\b/,
    /\bbutuh\b.*\bperbaikan\b/,
    /\bmaintenance\b.*\b(mohon|tolong|please|buatkan|minta)\b/,
  ];

  const hasTrigger = ticketTriggers.some((pattern) => pattern.test(msg));
  if (!hasTrigger) return { isTicketRequest: false, machineId: null };

  // Cari nomor mesin yang disebut user
  const machineMatch = msg.match(/(?:mesin|machine)\s*(\d+)/i);

  if (!machineMatch) {
    return {
      isTicketRequest: true,
      machineId: null,
      rawMessage: userMessage,
    };
  }

  return {
    isTicketRequest: true,
    machineId: Number(machineMatch[1]),
    rawMessage: userMessage,
  };
}

export function extractUserNotes(userMessage) {
  const msg = userMessage.trim();

  // 1. Cek alasan langsung
  const reasonPatterns = [
    /karena\s+(.+)/i,
    /sebab\s+(.+)/i,
    /alasan\s*:?\s*(.+)/i,
  ];

  for (const pattern of reasonPatterns) {
    const match = msg.match(pattern);
    if (match && match[1]) {
      const clean = match[1].trim();
      return clean.length >= 5 ? clean : null;
    }
  }

  // 2. Bersihkan keyword tiket + mesin → sisakan alasan
  let cleaned = msg
    .replace(/buat(kan)?\s*(saya\s*)?tiket( maintenance)?/gi, "")
    .replace(/request(.*)?maintenance/gi, "")
    .replace(/maintenance(.*)?request/gi, "")
    .replace(/mesin\s*\d+/gi, "")
    .replace(/machine\s*\d+/gi, "")
    .replace(/\bmaintenance\b/gi, "")
    .trim();

  // Normalize double spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Jika hasilnya terlalu pendek, anggap tidak ada alasan
  if (!cleaned || cleaned.length < 5) return null;

  return cleaned;
}
