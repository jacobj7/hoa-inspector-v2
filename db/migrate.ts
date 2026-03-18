import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        email_verified BOOLEAN DEFAULT FALSE,
        image VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)
    `);

    // Owners table
    await client.query(`
      CREATE TABLE IF NOT EXISTS owners (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        mailing_address TEXT,
        city VARCHAR(100),
        state VARCHAR(50),
        zip_code VARCHAR(20),
        country VARCHAR(100) DEFAULT 'USA',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_owners_user_id ON owners(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_owners_email ON owners(email)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_owners_last_name ON owners(last_name)
    `);

    // Properties table
    await client.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER REFERENCES owners(id) ON DELETE SET NULL,
        parcel_number VARCHAR(100) UNIQUE,
        address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(50) NOT NULL,
        zip_code VARCHAR(20) NOT NULL,
        property_type VARCHAR(100),
        zoning_code VARCHAR(50),
        lot_size NUMERIC(12, 2),
        year_built INTEGER,
        latitude NUMERIC(10, 7),
        longitude NUMERIC(10, 7),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_properties_parcel_number ON properties(parcel_number)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_properties_zip_code ON properties(zip_code)
    `);

    // Inspectors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inspectors (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        badge_number VARCHAR(50) UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        department VARCHAR(200),
        certification_number VARCHAR(100),
        certification_expiry DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inspectors_user_id ON inspectors(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inspectors_badge_number ON inspectors(badge_number)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inspectors_is_active ON inspectors(is_active)
    `);

    // Violation categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS violation_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        severity VARCHAR(50) DEFAULT 'medium',
        base_fine_amount NUMERIC(10, 2) DEFAULT 0.00,
        escalation_fine_amount NUMERIC(10, 2) DEFAULT 0.00,
        compliance_days INTEGER DEFAULT 30,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_violation_categories_code ON violation_categories(code)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_violation_categories_severity ON violation_categories(severity)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_violation_categories_is_active ON violation_categories(is_active)
    `);

    // Violations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS violations (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        inspector_id INTEGER REFERENCES inspectors(id) ON DELETE SET NULL,
        category_id INTEGER REFERENCES violation_categories(id) ON DELETE SET NULL,
        violation_number VARCHAR(100) UNIQUE NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        description TEXT NOT NULL,
        location_detail TEXT,
        inspection_date TIMESTAMP WITH TIME ZONE NOT NULL,
        compliance_deadline TIMESTAMP WITH TIME ZONE,
        resolved_date TIMESTAMP WITH TIME ZONE,
        resolution_notes TEXT,
        severity VARCHAR(50) DEFAULT 'medium',
        repeat_violation BOOLEAN DEFAULT FALSE,
        ai_analysis TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_violations_property_id ON violations(property_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_violations_inspector_id ON violations(inspector_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_violations_category_id ON violations(category_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_violations_violation_number ON violations(violation_number)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_violations_inspection_date ON violations(inspection_date)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_violations_compliance_deadline ON violations(compliance_deadline)
    `);

    // Evidence photos table
    await client.query(`
      CREATE TABLE IF NOT EXISTS evidence_photos (
        id SERIAL PRIMARY KEY,
        violation_id INTEGER NOT NULL REFERENCES violations(id) ON DELETE CASCADE,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        file_name VARCHAR(500) NOT NULL,
        file_url TEXT NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        caption TEXT,
        taken_at TIMESTAMP WITH TIME ZONE,
        ai_description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_evidence_photos_violation_id ON evidence_photos(violation_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_evidence_photos_uploaded_by ON evidence_photos(uploaded_by)
    `);

    // Notices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notices (
        id SERIAL PRIMARY KEY,
        violation_id INTEGER NOT NULL REFERENCES violations(id) ON DELETE CASCADE,
        issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        notice_number VARCHAR(100) UNIQUE NOT NULL,
        notice_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        sent_at TIMESTAMP WITH TIME ZONE,
        delivered_at TIMESTAMP WITH TIME ZONE,
        delivery_method VARCHAR(50) DEFAULT 'email',
        recipient_email VARCHAR(255),
        recipient_address TEXT,
        ai_generated BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notices_violation_id ON notices(violation_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notices_issued_by ON notices(issued_by)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notices_notice_number ON notices(notice_number)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notices_status ON notices(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notices_notice_type ON notices(notice_type)
    `);

    // Fines table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fines (
        id SERIAL PRIMARY KEY,
        violation_id INTEGER NOT NULL REFERENCES violations(id) ON DELETE CASCADE,
        issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        fine_number VARCHAR(100) UNIQUE NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        due_date TIMESTAMP WITH TIME ZONE,
        paid_date TIMESTAMP WITH TIME ZONE,
        payment_method VARCHAR(100),
        payment_reference VARCHAR(200),
        waived BOOLEAN DEFAULT FALSE,
        waiver_reason TEXT,
        waived_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        waived_at TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fines_violation_id ON fines(violation_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fines_issued_by ON fines(issued_by)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fines_fine_number ON fines(fine_number)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fines_status ON fines(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fines_due_date ON fines(due_date)
    `);

    // Appeals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS appeals (
        id SERIAL PRIMARY KEY,
        violation_id INTEGER NOT NULL REFERENCES violations(id) ON DELETE CASCADE,
        fine_id INTEGER REFERENCES fines(id) ON DELETE SET NULL,
        submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        appeal_number VARCHAR(100) UNIQUE NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'submitted',
        grounds TEXT NOT NULL,
        supporting_documents TEXT,
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        hearing_date TIMESTAMP WITH TIME ZONE,
        decision VARCHAR(50),
        decision_notes TEXT,
        decided_at TIMESTAMP WITH TIME ZONE,
        ai_recommendation TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_appeals_violation_id ON appeals(violation_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_appeals_fine_id ON appeals(fine_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_appeals_submitted_by ON appeals(submitted_by)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_appeals_reviewed_by ON appeals(reviewed_by)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_appeals_appeal_number ON appeals(appeal_number)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_appeals_hearing_date ON appeals(hearing_date)
    `);

    await client.query("COMMIT");

    console.log("Migration completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Fatal migration error:", err);
  process.exit(1);
});
