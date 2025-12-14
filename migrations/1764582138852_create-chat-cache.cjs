exports.up = (pgm) => {
  pgm.createTable("chat_cache", {
    id: "id",
    message: { type: "TEXT", notNull: true },
    answer: { type: "TEXT", notNull: true },
    embedding: { type: "jsonb", notNull: true },
    created_at: { type: "TIMESTAMP", default: pgm.func("current_timestamp") }
  });
};

exports.down = (pgm) => {
  pgm.dropTable("chat_cache");
};
