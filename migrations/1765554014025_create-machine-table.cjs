exports.up = (pgm) => {
  pgm.createTable("machines", {
    id: "id",
    name: { type: "varchar(100)", notNull: true },
    description: { type: "text" },
    created_at: { type: "timestamp", default: pgm.func("current_timestamp") }
  });

  pgm.sql(`
    INSERT INTO machines (name, description)
    VALUES 
      ('Machine 1', 'Simulated industrial machine'),
      ('Machine 2', 'Simulated industrial machine'),
      ('Machine 3', 'Simulated industrial machine'),
      ('Machine 4', 'Simulated industrial machine'),
      ('Machine 5', 'Simulated industrial machine');
  `);
};

exports.down = (pgm) => {
  pgm.dropTable("machines");
};
