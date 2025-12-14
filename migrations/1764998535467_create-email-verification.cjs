exports.up = pgm => {
  pgm.createTable("email_verification", {
    user_id: {
      type: "INTEGER",
      references: "users(id)",
      onDelete: "CASCADE",
      notNull: true
    },
    otp: { type: "VARCHAR(6)", notNull: true },
    expired_at: { type: "TIMESTAMP", notNull: true }
  });
};

exports.down = pgm => {
  pgm.dropTable("email_verification");
};
