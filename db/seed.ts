import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Create users table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'inspector',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create violation_categories table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS violation_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        severity VARCHAR(50) NOT NULL DEFAULT 'medium',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create properties table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        address VARCHAR(500) NOT NULL,
        city VARCHAR(255) NOT NULL,
        state VARCHAR(100) NOT NULL,
        zip_code VARCHAR(20) NOT NULL,
        property_type VARCHAR(100) NOT NULL DEFAULT 'residential',
        owner_name VARCHAR(255),
        owner_email VARCHAR(255),
        owner_phone VARCHAR(50),
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create inspections table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS inspections (
        id SERIAL PRIMARY KEY,
        property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
        inspector_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        scheduled_date TIMESTAMP WITH TIME ZONE,
        completed_date TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create violations table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS violations (
        id SERIAL PRIMARY KEY,
        inspection_id INTEGER REFERENCES inspections(id) ON DELETE CASCADE,
        property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES violation_categories(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        severity VARCHAR(50) NOT NULL DEFAULT 'medium',
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        due_date TIMESTAMP WITH TIME ZONE,
        resolved_date TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Seed manager user
    const managerPassword = await bcrypt.hash("manager123!", 12);
    const managerResult = await client.query(
      `
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        updated_at = NOW()
      RETURNING id, email, role
    `,
      [
        "Admin Manager",
        "manager@inspectionapp.com",
        managerPassword,
        "manager",
      ],
    );
    console.log("✅ Manager user seeded:", managerResult.rows[0]);

    // Seed inspector users
    const inspectorPassword = await bcrypt.hash("inspector123!", 12);
    const inspector1Result = await client.query(
      `
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        updated_at = NOW()
      RETURNING id, email, role
    `,
      [
        "John Inspector",
        "john.inspector@inspectionapp.com",
        inspectorPassword,
        "inspector",
      ],
    );
    console.log("✅ Inspector 1 seeded:", inspector1Result.rows[0]);

    const inspector2Result = await client.query(
      `
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        updated_at = NOW()
      RETURNING id, email, role
    `,
      [
        "Jane Inspector",
        "jane.inspector@inspectionapp.com",
        inspectorPassword,
        "inspector",
      ],
    );
    console.log("✅ Inspector 2 seeded:", inspector2Result.rows[0]);

    // Seed violation categories
    const violationCategories = [
      {
        name: "Structural Damage",
        description:
          "Issues related to the structural integrity of the building including foundation, walls, roof, and load-bearing elements.",
        severity: "high",
      },
      {
        name: "Electrical Hazards",
        description:
          "Electrical system violations including faulty wiring, exposed conductors, overloaded circuits, and non-compliant installations.",
        severity: "high",
      },
      {
        name: "Plumbing Issues",
        description:
          "Plumbing system violations including leaks, improper drainage, water pressure issues, and non-compliant fixtures.",
        severity: "medium",
      },
      {
        name: "Fire Safety",
        description:
          "Fire safety violations including missing smoke detectors, blocked exits, improper storage of flammable materials, and non-compliant fire suppression systems.",
        severity: "high",
      },
      {
        name: "Sanitation & Hygiene",
        description:
          "Sanitation violations including pest infestations, mold growth, improper waste disposal, and inadequate sanitary facilities.",
        severity: "medium",
      },
      {
        name: "HVAC Systems",
        description:
          "Heating, ventilation, and air conditioning system violations including inadequate ventilation, improper installation, and maintenance issues.",
        severity: "medium",
      },
      {
        name: "Accessibility",
        description:
          "ADA compliance and accessibility violations including missing ramps, inadequate door widths, and non-compliant facilities.",
        severity: "medium",
      },
      {
        name: "Exterior Maintenance",
        description:
          "Exterior property maintenance violations including deteriorating facades, broken windows, damaged walkways, and landscaping issues.",
        severity: "low",
      },
      {
        name: "Interior Maintenance",
        description:
          "Interior property maintenance violations including damaged flooring, peeling paint, broken fixtures, and general deterioration.",
        severity: "low",
      },
      {
        name: "Zoning & Land Use",
        description:
          "Zoning violations including unauthorized use of property, illegal additions, and non-compliant signage.",
        severity: "high",
      },
      {
        name: "Environmental Hazards",
        description:
          "Environmental violations including asbestos, lead paint, hazardous waste, and contamination issues.",
        severity: "high",
      },
      {
        name: "Building Permits",
        description:
          "Permit violations including unpermitted construction, expired permits, and work not matching approved plans.",
        severity: "medium",
      },
    ];

    for (const category of violationCategories) {
      const result = await client.query(
        `
        INSERT INTO violation_categories (name, description, severity)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        RETURNING id, name, severity
      `,
        [category.name, category.description, category.severity],
      );
      if (result.rows.length > 0) {
        console.log("✅ Violation category seeded:", result.rows[0]);
      } else {
        console.log(`⚠️  Violation category already exists: ${category.name}`);
      }
    }

    // Seed test properties
    const testProperties = [
      {
        address: "123 Main Street",
        city: "Springfield",
        state: "IL",
        zip_code: "62701",
        property_type: "residential",
        owner_name: "Robert Johnson",
        owner_email: "robert.johnson@email.com",
        owner_phone: "555-0101",
        status: "active",
        notes: "Single family home, built in 1985",
      },
      {
        address: "456 Oak Avenue",
        city: "Springfield",
        state: "IL",
        zip_code: "62702",
        property_type: "commercial",
        owner_name: "Springfield Business LLC",
        owner_email: "contact@springfieldbusiness.com",
        owner_phone: "555-0102",
        status: "active",
        notes: "Retail strip mall with 5 units",
      },
      {
        address: "789 Elm Street",
        city: "Springfield",
        state: "IL",
        zip_code: "62703",
        property_type: "residential",
        owner_name: "Mary Williams",
        owner_email: "mary.williams@email.com",
        owner_phone: "555-0103",
        status: "active",
        notes: "Duplex property, both units occupied",
      },
      {
        address: "321 Pine Road",
        city: "Shelbyville",
        state: "IL",
        zip_code: "62565",
        property_type: "industrial",
        owner_name: "Shelbyville Manufacturing Inc",
        owner_email: "facilities@shelbyvillemfg.com",
        owner_phone: "555-0104",
        status: "active",
        notes: "Light industrial warehouse facility",
      },
      {
        address: "654 Maple Drive",
        city: "Springfield",
        state: "IL",
        zip_code: "62704",
        property_type: "residential",
        owner_name: "David Brown",
        owner_email: "david.brown@email.com",
        owner_phone: "555-0105",
        status: "active",
        notes: "Multi-family apartment building, 12 units",
      },
      {
        address: "987 Cedar Lane",
        city: "Capital City",
        state: "IL",
        zip_code: "62706",
        property_type: "commercial",
        owner_name: "Capital City Properties",
        owner_email: "info@capitalcityprops.com",
        owner_phone: "555-0106",
        status: "inactive",
        notes: "Office building, currently vacant",
      },
      {
        address: "147 Birch Boulevard",
        city: "Springfield",
        state: "IL",
        zip_code: "62705",
        property_type: "residential",
        owner_name: "Susan Davis",
        owner_email: "susan.davis@email.com",
        owner_phone: "555-0107",
        status: "active",
        notes: "Single family home with detached garage",
      },
      {
        address: "258 Walnut Way",
        city: "Shelbyville",
        state: "IL",
        zip_code: "62565",
        property_type: "mixed_use",
        owner_name: "Walnut Way Partners",
        owner_email: "partners@walnutway.com",
        owner_phone: "555-0108",
        status: "active",
        notes: "Ground floor retail, upper floors residential",
      },
    ];

    for (const property of testProperties) {
      const result = await client.query(
        `
        INSERT INTO properties (address, city, state, zip_code, property_type, owner_name, owner_email, owner_phone, status, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT DO NOTHING
        RETURNING id, address, city
      `,
        [
          property.address,
          property.city,
          property.state,
          property.zip_code,
          property.property_type,
          property.owner_name,
          property.owner_email,
          property.owner_phone,
          property.status,
          property.notes,
        ],
      );
      if (result.rows.length > 0) {
        console.log("✅ Property seeded:", result.rows[0]);
      } else {
        console.log(`⚠️  Property may already exist: ${property.address}`);
      }
    }

    await client.query("COMMIT");
    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n📋 Default credentials:");
    console.log("  Manager: manager@inspectionapp.com / manager123!");
    console.log(
      "  Inspector 1: john.inspector@inspectionapp.com / inspector123!",
    );
    console.log(
      "  Inspector 2: jane.inspector@inspectionapp.com / inspector123!",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Seeding failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error("Fatal error during seeding:", error);
  process.exit(1);
});
