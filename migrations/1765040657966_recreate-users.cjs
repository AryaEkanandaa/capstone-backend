/**
 * Recreate users table with auto-username support
 */

exports.shorthands = undefined;

exports.up = pgm => {
  pgm.dropTable("users", { ifExists: true, cascade: true });

  pgm.createTable("users", {
    id: {
      type: "serial",
      primaryKey: true
    },
    full_name: {
      type: "text",
      notNull: true
    },
    username: {
      type: "text",
      notNull: true,
      unique: true
    },
    email: {
      type: "text",
      notNull: true,
      unique: true
    },
    password: {
      type: "text",
      notNull: true
    },
    created_at: {
      type: "timestamp",
      default: pgm.func("current_timestamp")
    }
  });
};

exports.down = pgm => {
  pgm.dropTable("users");
};
