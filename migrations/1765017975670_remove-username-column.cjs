exports.up = (pgm) => {
  pgm.dropColumn("users", "username");
};

exports.down = (pgm) => {
  pgm.addColumn("users", {
    username: { type: "VARCHAR(100)", notNull: true, unique: true }
  });
};
