exports.up = (pgm) => {
  pgm.addConstraint(
    "users",
    "users_role_check",
    {
      check: "role IN ('USER', 'TECHNICIAN', 'ADMIN', 'SYSTEM')",
      ifNotExists: true,
    }
  );

  pgm.sql(`
    UPDATE users
    SET role = 'TECHNICIAN'
    WHERE id = 2
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET role = 'USER'
    WHERE id = 2
  `);
};
