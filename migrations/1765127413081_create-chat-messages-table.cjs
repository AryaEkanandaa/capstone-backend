/* eslint-disable */

exports.up = (pgm) => {
  pgm.createTable("chat_messages", {
    id: "id",
    session_id: {
      type: "integer",
      notNull: true,
      references: "chat_sessions",
      onDelete: "cascade"
    },
    sender: { type: "varchar(20)", notNull: true },
    content: { type: "text", notNull: false },
    content_json: { type: "jsonb", notNull: false },
    is_deleted: { type: "boolean", notNull: true, default: false },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("now()") }
  });
};

exports.down = (pgm) => {
  pgm.dropTable("chat_messages");
};
