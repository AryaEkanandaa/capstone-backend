exports.up = (pgm) => {
    pgm.createTable("maintenance_tickets", {
        id: "id",
        ticket_number: { type: "varchar(50)", notNull: true, unique: true },

        machine_id: {
            type: "integer",
            notNull: true,
            references: '"machines"',
            onDelete: "cascade"
        },

        title: { type: "varchar(255)", notNull: true },
        description: { type: "text" },
        priority: { type: "varchar(20)", notNull: true, default: "MEDIUM" },
        status: { type: "varchar(20)", notNull: true, default: "OPEN" },

        creation_type: { type: "varchar(20)", notNull: true },
        created_by: {
            type: "integer",
            references: '"users"',
            onDelete: "set null"
        },
        assigned_to: {
            type: "integer",
            references: '"users"',
            onDelete: "set null"
        },

        sensor_data: { type: "jsonb" },
        anomaly_score: { type: "numeric(10,4)" },
        prediction_status: { type: "varchar(50)" },
        failure_type: { type: "varchar(100)" },
        failure_probability: { type: "numeric(5,4)" },

        ai_recommendations: { type: "text" },
        user_notes: { type: "text" },

        created_at: { type: "timestamp", default: pgm.func("now()") },
        updated_at: { type: "timestamp", default: pgm.func("now()") },
        scheduled_date: { type: "timestamp" },
        completed_at: { type: "timestamp" },
    });

    pgm.createTable("ticket_activity_logs", {
        id: "id",
        ticket_id: {
            type: "integer",
            notNull: true,
            references: '"maintenance_tickets"',
            onDelete: "cascade"
        },
        user_id: {
            type: "integer",
            references: '"users"',
            onDelete: "set null"
        },

        action: { type: "varchar(50)", notNull: true },
        old_value: { type: "text" },
        new_value: { type: "text" },
        comment: { type: "text" },

        created_at: { type: "timestamp", default: pgm.func("now()") }
    });

    pgm.createIndex("maintenance_tickets", "machine_id");
    pgm.createIndex("maintenance_tickets", "status");
    pgm.createIndex("maintenance_tickets", "priority");
    pgm.createIndex("maintenance_tickets", ["created_at"]);
    pgm.createIndex("maintenance_tickets", "ticket_number");

    pgm.createIndex("ticket_activity_logs", "ticket_id");

    pgm.createFunction(
        "generate_ticket_number",
        [],
        {
            returns: "varchar",
            language: "plpgsql",
            replace: true,
        },
        `
    DECLARE
      today_date VARCHAR(8);
      counter INTEGER;
      ticket_num VARCHAR(50);
    BEGIN
      today_date := TO_CHAR(NOW(), 'YYYYMMDD');

      SELECT COUNT(*) + 1 INTO counter
      FROM maintenance_tickets
      WHERE ticket_number LIKE 'TKT-' || today_date || '%';

      ticket_num := 'TKT-' || today_date || '-' || LPAD(counter::TEXT, 3, '0');

      RETURN ticket_num;
    END;
    `
    );

    pgm.createFunction(
        "set_ticket_number",
        [],
        {
            returns: "trigger",
            language: "plpgsql",
            replace: true,
        },
        `
    BEGIN
      IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
        NEW.ticket_number := generate_ticket_number();
      END IF;
      RETURN NEW;
    END;
    `
    );

    pgm.createTrigger(
        "maintenance_tickets",
        "trigger_set_ticket_number",
        {
            when: "BEFORE",
            operation: "INSERT",
            function: "set_ticket_number",
            level: "ROW"
        }
    );

    pgm.createFunction(
        "update_maintenance_ticket_timestamp",
        [],
        {
            returns: "trigger",
            language: "plpgsql",
            replace: true,
        },
        `
    BEGIN
      NEW.updated_at := NOW();
      RETURN NEW;
    END;
    `
    );

    pgm.createTrigger(
        "maintenance_tickets",
        "trigger_update_ticket_timestamp",
        {
            when: "BEFORE",
            operation: "UPDATE",
            function: "update_maintenance_ticket_timestamp",
            level: "ROW"
        }
    );
};

exports.down = (pgm) => {
    pgm.dropTrigger("maintenance_tickets", "trigger_update_ticket_timestamp");
    pgm.dropFunction("update_maintenance_ticket_timestamp");

    pgm.dropTrigger("maintenance_tickets", "trigger_set_ticket_number");
    pgm.dropFunction("set_ticket_number");
    pgm.dropFunction("generate_ticket_number");

    pgm.dropTable("ticket_activity_logs");
    pgm.dropTable("maintenance_tickets");
};