exports.up = pgm => {
  pgm.addColumn("users", {
    is_verified: { type: "BOOLEAN", default: false }
  });
};

exports.down = pgm => {
  pgm.dropColumn("users", "is_verified");
};
