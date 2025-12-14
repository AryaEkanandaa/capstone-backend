exports.up = (pgm) => {
  pgm.addColumn("users", {
    role: {
      type: "TEXT",
      notNull: true,
      default: "USER",
    },
  });

  // Jadikan user dengan id = 2 sebagai ADMIN
  pgm.sql(`UPDATE users SET role = 'ADMIN' WHERE id = 4`);
};

exports.down = (pgm) => {
  pgm.dropColumn("users", "role");
};
