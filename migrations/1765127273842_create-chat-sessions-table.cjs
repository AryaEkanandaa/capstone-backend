exports.up = (pgm) => {
  pgm.createTable("chat_sessions", {
    id: "id",
    user_id: { type: "integer", notNull: false },
    title: { type: "text", notNull: true, default: "Chat" },
    updated_at: { type: "timestamp", notNull: true, default: pgm.func("now()") }
  });
};

exports.down = (pgm) => {
  pgm.dropTable("chat_sessions");
};