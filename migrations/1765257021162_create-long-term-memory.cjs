exports.up = pgm => {
  pgm.createTable("chat_memory", {
    id: "id",
    user_id: { type: "integer", notNull:true },
    summary: { type:"text", notNull:true },
    last_update: { type:"timestamp", default:pgm.func("now()") }
  });
};

exports.down = pgm => {
  pgm.dropTable("chat_memory");
};
