exports.up = pgm => {
  pgm.createTable("maintenance_logs", {
    id: "id",
    machine_id: { type: "integer", notNull: true },
    action_taken: { type: "text", notNull: true },
    technician: { type: "text", notNull: true },
    notes: { type: "text" },
    status_before: { type: "text", notNull: true },
    status_after: { type: "text", notNull: true },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("current_timestamp") }
  });
};

exports.down = pgm => {
  pgm.dropTable("maintenance_logs");
};
