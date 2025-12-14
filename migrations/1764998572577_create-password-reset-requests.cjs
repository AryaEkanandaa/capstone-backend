exports.up = pgm => {
  pgm.createTable("password_reset_request", {
    id: "id",
    user_id: {
      type: "INTEGER",
      references: "users(id)",
      onDelete: "CASCADE",
      notNull: true
    },
    otp: { type: 'VARCHAR(6)', notNull: true },
    expired_at: { type: 'TIMESTAMP', notNull: true }
  });
};

exports.down = pgm => {
  pgm.dropTable("password_reset_request");
};
