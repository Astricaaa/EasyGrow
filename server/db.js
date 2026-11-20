const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'easygrow.sqlite');
const db = new DatabaseSync(DB_FILE);

// Enable WAL mode for high concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'tenant',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    dropi_product_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    cost_dropi REAL NOT NULL,
    suggested_price REAL NOT NULL,
    stock INTEGER NOT NULL,
    category TEXT NOT NULL,
    supplier TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    checkout_group_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    origin_label TEXT NOT NULL,
    origin_type TEXT NOT NULL,
    origin_city TEXT NOT NULL,
    destination_city TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    carrier_name TEXT NOT NULL,
    carrier_coverage INTEGER NOT NULL,
    shipping_cost REAL NOT NULL,
    estimated_time TEXT NOT NULL,
    items_json TEXT NOT NULL,
    subtotal_products REAL NOT NULL,
    status TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    notifications_json TEXT NOT NULL,
    evaluated INTEGER NOT NULL DEFAULT 0,
    eval_json TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_shipments_tenant ON shipments(tenant_id);

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    company TEXT,
    stage TEXT NOT NULL,
    value REAL NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0,
    tags TEXT,
    attribution TEXT,
    dropi_orders TEXT,
    timeline TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);

  CREATE TABLE IF NOT EXISTS kanban_stages (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    common_category TEXT NOT NULL,
    probability REAL NOT NULL DEFAULT 20,
    suggested_probability REAL DEFAULT NULL,
    position INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_stages_tenant ON kanban_stages(tenant_id);

  CREATE TABLE IF NOT EXISTS customer_purchases (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    order_ref TEXT NOT NULL,
    products_summary TEXT NOT NULL,
    items_json TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    order_status TEXT NOT NULL DEFAULT 'CONFIRMADO',
    estimated_delivery_date TEXT NOT NULL,
    actual_delivery_date TEXT NOT NULL DEFAULT 'Pendiente',
    created_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_purchases_tenant ON customer_purchases(tenant_id);

  CREATE TABLE IF NOT EXISTS formulas (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL DEFAULT 'private',
    tenant_id TEXT DEFAULT NULL,
    author_name TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    expression TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'COP',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_formulas_scope_tenant ON formulas(scope, tenant_id);

  CREATE TABLE IF NOT EXISTS form_configs (
    tenant_id TEXT PRIMARY KEY,
    form_title TEXT NOT NULL,
    google_form_url TEXT NOT NULL,
    embed_url TEXT NOT NULL,
    auto_created INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS form_rules (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    category_name TEXT NOT NULL,
    keywords TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_form_rules_tenant ON form_rules(tenant_id);

  CREATE TABLE IF NOT EXISTS form_submissions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    respondent_name TEXT NOT NULL,
    respondent_contact TEXT DEFAULT '',
    requirement_text TEXT NOT NULL,
    matched_category TEXT NOT NULL,
    ai_suggested_category TEXT NOT NULL,
    human_status TEXT NOT NULL DEFAULT 'Pendiente de revisión',
    human_notes TEXT DEFAULT '',
    source_channel TEXT NOT NULL DEFAULT 'Google Forms (Enlace Directo)',
    source_qr_id TEXT DEFAULT '',
    created_date TEXT NOT NULL,
    created_time TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_form_submissions_tenant ON form_submissions(tenant_id);

  CREATE TABLE IF NOT EXISTS qr_codes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    code_slug TEXT NOT NULL,
    name TEXT NOT NULL,
    placement TEXT NOT NULL DEFAULT 'Empaque / Tarjeta',
    campaign TEXT NOT NULL,
    dest_type TEXT NOT NULL DEFAULT 'google_form',
    target_url TEXT NOT NULL,
    total_scans INTEGER NOT NULL DEFAULT 0,
    unique_scans INTEGER NOT NULL DEFAULT 0,
    last_scan_at TEXT NOT NULL DEFAULT 'Sin escaneos aún',
    identified_leads INTEGER NOT NULL DEFAULT 0,
    history_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_qr_codes_tenant ON qr_codes(tenant_id);

  -- Estación 04: WhatsApp Business Platform (Multitenant + Embedded Signup v4 + Calling + Bandeja 3 Paneles)
  CREATE TABLE IF NOT EXISTS whatsapp_integrations (
    tenant_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'no_conectado',
    status_reason TEXT DEFAULT '',
    business_name TEXT DEFAULT '',
    display_phone_number TEXT DEFAULT '',
    waba_id TEXT DEFAULT '',
    phone_number_id TEXT DEFAULT '',
    encrypted_access_token TEXT DEFAULT NULL,
    token_expires_at TEXT DEFAULT NULL,
    calling_eligible INTEGER NOT NULL DEFAULT 0,
    calling_ineligible_reason TEXT NOT NULL DEFAULT 'WhatsApp Business Calling API no viene habilitada de forma predeterminada en Meta. Conecta un número empresarial elegible y habilita Call Settings en Meta.',
    missed_call_enabled INTEGER NOT NULL DEFAULT 0,
    missed_call_reply_mode TEXT NOT NULL DEFAULT 'auto_window_or_template',
    missed_call_message_text TEXT NOT NULL DEFAULT '¡Hola! Vimos tu llamada perdida por WhatsApp. En este momento nuestros asesores están atendiendo otro cliente; cuéntanos cómo podemos ayudarte por aquí.',
    missed_call_template_name TEXT NOT NULL DEFAULT 'easygrow_missed_call_followup',
    missed_call_template_lang TEXT NOT NULL DEFAULT 'es',
    last_tested_at TEXT DEFAULT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
    event_key TEXT PRIMARY KEY,
    tenant_id TEXT DEFAULT NULL,
    event_type TEXT NOT NULL,
    processed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS whatsapp_webhook_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT DEFAULT NULL,
    direction TEXT NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,
    summary TEXT NOT NULL,
    error_detail TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_wa_logs_tenant ON whatsapp_webhook_logs(tenant_id, created_at);

  CREATE TABLE IF NOT EXISTS whatsapp_calls (
    call_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    contact_id TEXT DEFAULT NULL,
    from_phone TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    call_status TEXT NOT NULL,
    auto_reply_sent INTEGER NOT NULL DEFAULT 0,
    auto_reply_status TEXT NOT NULL DEFAULT 'not_triggered',
    auto_reply_message_id TEXT DEFAULT '',
    auto_reply_preview TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_wa_calls_tenant ON whatsapp_calls(tenant_id);

  CREATE TABLE IF NOT EXISTS inbox_messages (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    direction TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    body TEXT NOT NULL,
    meta_message_id TEXT DEFAULT '',
    delivery_status TEXT NOT NULL DEFAULT 'received',
    intent_label TEXT DEFAULT '',
    intent_score REAL DEFAULT 0,
    ai_suggested_reply TEXT DEFAULT '',
    ai_approval_status TEXT DEFAULT 'none',
    approved_by TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_inbox_msgs_tenant_contact ON inbox_messages(tenant_id, contact_id);

  CREATE TABLE IF NOT EXISTS calendar_appointments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    contact_id TEXT DEFAULT NULL,
    contact_name TEXT NOT NULL,
    title TEXT NOT NULL,
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'WhatsApp',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_calendar_appts_tenant ON calendar_appointments(tenant_id);

  -- Estación 05: Marketing & Analítica (Parrilla IG/FB/TikTok, Meta/Google Ads, Permisos, Atribución y SEO)
  CREATE TABLE IF NOT EXISTS tenant_marketing_settings (
    tenant_id TEXT PRIMARY KEY,
    timezone TEXT NOT NULL DEFAULT 'America/Bogota',
    attribution_window_days INTEGER NOT NULL DEFAULT 30,
    reporting_period TEXT NOT NULL DEFAULT '30d',
    updated_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS marketing_integrations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'no_conectado',
    status_reason TEXT DEFAULT '',
    account_id TEXT DEFAULT '',
    account_name TEXT DEFAULT '',
    authorized_user_name TEXT DEFAULT '',
    authorized_user_email TEXT DEFAULT '',
    scopes_granted TEXT DEFAULT '',
    encrypted_credentials TEXT DEFAULT NULL,
    last_tested_at TEXT DEFAULT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(tenant_id, provider),
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS social_posts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content_text TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image',
    media_url TEXT DEFAULT '',
    media_format_notes TEXT DEFAULT '',
    requires_native_app INTEGER NOT NULL DEFAULT 0,
    networks_json TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'America/Bogota',
    status TEXT NOT NULL DEFAULT 'borrador',
    network_statuses_json TEXT NOT NULL DEFAULT '{}',
    error_log TEXT DEFAULT '',
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_social_posts_tenant ON social_posts(tenant_id);

  CREATE TABLE IF NOT EXISTS social_manual_reminders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    network TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'America/Bogota',
    reason TEXT NOT NULL,
    required_action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendiente',
    created_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_social_reminders_tenant ON social_manual_reminders(tenant_id);

  CREATE TABLE IF NOT EXISTS ad_campaigns (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    account_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    external_campaign_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    daily_budget REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'COP',
    spend REAL NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    reach INTEGER DEFAULT NULL,
    clicks INTEGER NOT NULL DEFAULT 0,
    period_tag TEXT NOT NULL DEFAULT '30d',
    updated_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_ad_campaigns_tenant ON ad_campaigns(tenant_id);

  CREATE TABLE IF NOT EXISTS marketing_collaborator_permissions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    collaborator_name TEXT NOT NULL,
    collaborator_email TEXT NOT NULL,
    role_preset TEXT NOT NULL DEFAULT 'Personalizado',
    can_connect_accounts INTEGER NOT NULL DEFAULT 0,
    can_view_metrics INTEGER NOT NULL DEFAULT 1,
    can_pause_resume INTEGER NOT NULL DEFAULT 0,
    can_modify_budget INTEGER NOT NULL DEFAULT 0,
    updated_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(tenant_id, collaborator_email),
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS campaign_action_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    store_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    campaign_id TEXT DEFAULT '',
    campaign_name TEXT DEFAULT '',
    action_type TEXT NOT NULL,
    previous_value TEXT DEFAULT '',
    new_value TEXT DEFAULT '',
    result_status TEXT NOT NULL,
    result_message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_campaign_logs_tenant ON campaign_action_logs(tenant_id, created_at);

  CREATE TABLE IF NOT EXISTS sales_attributions (
    order_key TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    contact_id TEXT DEFAULT NULL,
    customer_name TEXT NOT NULL,
    order_status TEXT NOT NULL DEFAULT 'COMPLETADA',
    order_amount REAL NOT NULL DEFAULT 0,
    first_origin_source TEXT NOT NULL DEFAULT 'directo',
    first_origin_medium TEXT NOT NULL DEFAULT 'none',
    first_origin_campaign TEXT DEFAULT '',
    first_origin_at TEXT DEFAULT '',
    last_paid_campaign_id TEXT DEFAULT NULL,
    last_paid_campaign_name TEXT DEFAULT NULL,
    last_paid_provider TEXT DEFAULT NULL,
    last_paid_at TEXT DEFAULT NULL,
    attribution_status TEXT NOT NULL DEFAULT 'sin_atribucion',
    attribution_window_days_applied INTEGER NOT NULL DEFAULT 30,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sales_attr_tenant ON sales_attributions(tenant_id);

  CREATE TABLE IF NOT EXISTS seo_search_console_rows (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    property_url TEXT NOT NULL,
    query TEXT NOT NULL,
    page TEXT NOT NULL,
    device TEXT NOT NULL DEFAULT 'MOBILE',
    country TEXT NOT NULL DEFAULT 'COL',
    period TEXT NOT NULL DEFAULT '28d',
    clicks INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    ctr REAL NOT NULL DEFAULT 0,
    position REAL NOT NULL DEFAULT 0,
    prev_clicks INTEGER DEFAULT NULL,
    prev_impressions INTEGER DEFAULT NULL,
    prev_position REAL DEFAULT NULL,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_seo_rows_tenant ON seo_search_console_rows(tenant_id);
`);

// Safe Column Migrations for Station 01 Scope
const productMigrations = [
  "ALTER TABLE products ADD COLUMN tenant_id TEXT DEFAULT NULL",
  "ALTER TABLE products ADD COLUMN origin_type TEXT DEFAULT 'dropi'",
  "ALTER TABLE products ADD COLUMN origin_city TEXT DEFAULT 'Medellín'",
  "ALTER TABLE products ADD COLUMN specifications TEXT DEFAULT ''",
  "ALTER TABLE products ADD COLUMN supplier_punctuality REAL DEFAULT 4.9",
  "ALTER TABLE products ADD COLUMN supplier_condition REAL DEFAULT 4.8",
  "ALTER TABLE products ADD COLUMN product_spec_quality REAL DEFAULT 4.9",
  "ALTER TABLE products ADD COLUMN reviews_count INTEGER DEFAULT 1",
  "ALTER TABLE products ADD COLUMN distribution_alliances TEXT DEFAULT ''",
  "ALTER TABLE products ADD COLUMN rea_metadata_json TEXT DEFAULT ''"
];
for (const sql of productMigrations) {
  try {
    db.exec(sql);
  } catch (e) {
    // Column already exists
  }
}

// Password Hashing Utility (Scrypt)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

// Seed Admin Master
const findAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@easygrow.co');
if (!findAdmin) {
  const { hash, salt } = hashPassword('Admin123*!');
  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, name, company_name, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'usr_admin_master',
    'admin@easygrow.co',
    hash,
    salt,
    'Administrador Maestro',
    'EasyGrow Global HQ',
    'admin',
    new Date().toISOString()
  );
  console.log('[DB] Admin maestro creado: admin@easygrow.co / Admin123*!');
}

// Seed Clean-Slate Test Account (Zero Demo Products, Empty Calendar, Predefined KPIs)
const findXiomara = db.prepare('SELECT * FROM users WHERE email = ?').get('xiomarateamo@gmail.com');
if (!findXiomara) {
  const { hash, salt } = hashPassword('12345678');
  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, name, company_name, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'usr_xiomara_clean',
    'xiomarateamo@gmail.com',
    hash,
    salt,
    'Xiomara',
    'Mi Negocio EasyGrow',
    'tenant',
    new Date().toISOString()
  );
  console.log('[DB] Cuenta limpia de prueba creada: xiomarateamo@gmail.com / 12345678');
}

const findBosco = db.prepare('SELECT * FROM users WHERE email = ?').get('boscomarica@gmail.com');
if (!findBosco) {
  const { hash, salt } = hashPassword('boscomk');
  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, name, company_name, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'usr_bosco_clean',
    'boscomarica@gmail.com',
    hash,
    salt,
    'Bosco',
    'Mi Negocio EasyGrow',
    'tenant',
    new Date().toISOString()
  );
  console.log('[DB] Cuenta limpia creada: boscomarica@gmail.com / boscomk');
}

// Seed Exact 3 Official Dropi Marketplace Products (REA Model + Standard Price + Distribution Alliances)
const seedDefaults = [
  {
    id: 'prod_12345',
    dropi_product_id: '12345',
    sku: 'SKU-REA-01',
    name: 'PowerBank Magnético Ultra Delgado 0.76cm 5000mAh',
    cost_dropi: 24900,
    suggested_price: 41456,
    stock: 38,
    category: 'Tecnología',
    supplier: 'Alianza MoveSpeed & Dropi Hub',
    origin_type: 'dropi',
    origin_city: 'Medellín',
    description: 'Batería magnética portátil 0.76cm ultra delgada con carga rápida inalámbrica y puerto USB-C.',
    specifications: 'Chasis 0.76cm • Carga magnética 15W • USB-C bidireccional • Protección térmica',
    distribution_alliances: 'Alianza Distribución: Servientrega • Coordinadora • Interrapidísimo',
    rea_metadata_json: JSON.stringify({
      resource: 'PowerBank Magnético 5000mAh (Stock verificado)',
      event: 'Reserva de unidad + Generación automática de guía',
      agents: ['Alianza MoveSpeed & Dropi Hub', 'Servientrega', 'Coordinadora', 'Interrapidísimo'],
      standardPriceCOP: 41456
    })
  },
  {
    id: 'prod_12346',
    dropi_product_id: '12346',
    sku: 'SKU-REA-02',
    name: 'Set Profesional 22 Brochas & Esponjas Maquillaje',
    cost_dropi: 6800,
    suggested_price: 11693,
    stock: 64,
    category: 'Belleza y cuidado personal',
    supplier: 'Alianza Welsunde & Dropi Beauty',
    origin_type: 'dropi',
    origin_city: 'Bogotá D.C.',
    description: 'Kit completo de 22 herramientas profesionales de maquillaje con esponjas difuminadoras.',
    specifications: '22 piezas fibra sintética hipoalergénica • 4 esponjas blender • Estuche protector',
    distribution_alliances: 'Alianza Distribución: Interrapidísimo • Envía • Servientrega',
    rea_metadata_json: JSON.stringify({
      resource: 'Set 22 Brochas & Esponjas (Calidad verificada)',
      event: 'Reserva en carrito multi-origen + Guía por envío',
      agents: ['Alianza Welsunde & Dropi Beauty', 'Interrapidísimo', 'Envía', 'Servientrega'],
      standardPriceCOP: 11693
    })
  },
  {
    id: 'prod_12347',
    dropi_product_id: '12347',
    sku: 'SKU-REA-03',
    name: 'Cortina de Luces LED Inteligente 3x3m USB',
    cost_dropi: 10200,
    suggested_price: 17134,
    stock: 45,
    category: 'Hogar inteligente',
    supplier: 'Alianza Hiuan Home & Dropi Cali',
    origin_type: 'dropi',
    origin_city: 'Cali',
    description: 'Cortina decorativa de 300 luces LED de bajo consumo con control remoto y modos programables.',
    specifications: '300 LEDs cálidos/RGB • Control remoto 8 efectos • Conexión USB 5V bajo consumo',
    distribution_alliances: 'Alianza Distribución: Coordinadora • Servientrega • Envía',
    rea_metadata_json: JSON.stringify({
      resource: 'Cortina Luces LED 3x3m (Control remoto)',
      event: 'Asignación logística por cobertura/costo/tiempo',
      agents: ['Alianza Hiuan Home & Dropi Cali', 'Coordinadora', 'Servientrega', 'Envía'],
      standardPriceCOP: 17134
    })
  }
];

// Limpiar antiguos productos de ejemplo (incluyendo restos de pruebas anteriores) y mantener los 3 productos oficiales + futuros productos propios del usuario
db.prepare(`
  DELETE FROM products
  WHERE id NOT IN ('prod_12345', 'prod_12346', 'prod_12347')
    AND (origin_type = 'dropi' OR sku IN ('EG-101', 'EG-102') OR name IN ('Aro de Luz LED Profesional 14"', 'Mochila Antirrobo USB Impermeable'))
`).run();

const upsertSeedStmt = db.prepare(`
  INSERT INTO products (
    id, dropi_product_id, sku, name, cost_dropi, suggested_price, stock, category, supplier,
    description, updated_at, tenant_id, origin_type, origin_city, specifications,
    supplier_punctuality, supplier_condition, product_spec_quality, reviews_count,
    distribution_alliances, rea_metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    sku = excluded.sku,
    name = excluded.name,
    cost_dropi = excluded.cost_dropi,
    suggested_price = excluded.suggested_price,
    stock = excluded.stock,
    category = excluded.category,
    supplier = excluded.supplier,
    description = excluded.description,
    origin_type = excluded.origin_type,
    origin_city = excluded.origin_city,
    specifications = excluded.specifications,
    distribution_alliances = excluded.distribution_alliances,
    rea_metadata_json = excluded.rea_metadata_json,
    updated_at = excluded.updated_at
`);

seedDefaults.forEach(p => {
  upsertSeedStmt.run(
    p.id, p.dropi_product_id, p.sku, p.name, p.cost_dropi, p.suggested_price,
    p.stock, p.category, p.supplier, p.description, new Date().toISOString(),
    null, p.origin_type, p.origin_city, p.specifications, 4.9, 4.8, 4.9, 1,
    p.distribution_alliances, p.rea_metadata_json
  );
});

// User Methods
function findUserByEmail(email) {
  if (!email) return null;
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
}

function findUserById(id) {
  return db.prepare('SELECT id, email, name, company_name, role, created_at FROM users WHERE id = ?').get(id);
}

function createUser({ email, password, name, companyName, role = 'tenant' }) {
  const existing = findUserByEmail(email);
  if (existing) {
    throw new Error('El correo electrónico ya está registrado.');
  }
  const id = 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, name, company_name, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, email.toLowerCase().trim(), hash, salt, name.trim(), companyName.trim(), role, now);

  return { id, email: email.toLowerCase().trim(), name: name.trim(), companyName: companyName.trim(), role, createdAt: now };
}

// Product Methods (Hybrid Global Dropi + Private Own Inventory)
function getAllProducts() {
  return db.prepare('SELECT * FROM products ORDER BY updated_at DESC').all();
}

function getProductsForUser(tenantId) {
  if (!tenantId || tenantId === 'usr_admin_master') {
    return db.prepare(`
      SELECT * FROM products
      WHERE origin_type = 'dropi' OR tenant_id IS NULL OR tenant_id = ?
      ORDER BY updated_at DESC
    `).all(tenantId || 'usr_admin_master');
  }
  return db.prepare(`
    SELECT * FROM products
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
  `).all(tenantId);
}

function getProductById(id) {
  return db.prepare('SELECT * FROM products WHERE id = ? OR dropi_product_id = ?').get(id, id);
}

function canManageProduct(product, user) {
  if (!product || !user) return false;
  if (user.role === 'admin') return true;
  return product.origin_type === 'propio' && product.tenant_id === user.tenantId;
}

function createProduct(productData, user = null) {
  const id = 'prod_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const dropiId = String(Date.now()).slice(-6);
  const sku = (productData.sku && String(productData.sku).trim()) || `SKU-${Date.now().toString().slice(-4)}`;
  const now = new Date().toISOString();

  const isAdmin = user && user.role === 'admin';
  const requestedOrigin = String(productData.origin_type || 'dropi').toLowerCase() === 'propio' ? 'propio' : 'dropi';
  const originType = isAdmin ? requestedOrigin : 'propio';
  const ownerTenantId = originType === 'propio' && user ? user.tenantId : null;
  const originCity = (productData.origin_city && String(productData.origin_city).trim()) || (originType === 'propio' ? 'Bogotá D.C.' : 'Medellín');
  const supplier = (productData.supplier && String(productData.supplier).trim())
    || (originType === 'propio' ? ((user && user.companyName) || 'Mi Bodega Propia') : 'Dropi Proveedor Verificado');
  const specs = (productData.specifications && String(productData.specifications).trim()) || 'Empaque estándar • Verificación técnica EasyGrow';
  const distAlliances = (productData.distribution_alliances && String(productData.distribution_alliances).trim())
    || 'Alianza Distribución: Servientrega • Coordinadora • Interrapidísimo';
  const reaMeta = JSON.stringify({
    resource: productData.name,
    event: 'Reserva en carrito + Guía logística',
    agents: [supplier, 'Servientrega', 'Coordinadora', 'Interrapidísimo'],
    standardPriceCOP: Number(productData.suggested_price) || 0
  });

  db.prepare(`
    INSERT INTO products (
      id, dropi_product_id, sku, name, cost_dropi, suggested_price, stock, category, supplier,
      description, updated_at, tenant_id, origin_type, origin_city, specifications,
      supplier_punctuality, supplier_condition, product_spec_quality, reviews_count,
      distribution_alliances, rea_metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    dropiId,
    sku,
    productData.name,
    Number(productData.cost_dropi) || 0,
    Number(productData.suggested_price) || 0,
    Number(productData.stock) || 0,
    productData.category || 'General',
    supplier,
    productData.description || '',
    now,
    ownerTenantId,
    originType,
    originCity,
    specs,
    5.0,
    5.0,
    5.0,
    1,
    distAlliances,
    reaMeta
  );

  return getProductById(id);
}

function batchImportInventory(tenantId, isAdmin, itemsList, userObj = null) {
  const effectiveUser = userObj || { tenantId, role: isAdmin ? 'admin' : 'tenant', companyName: 'Bodega Propia' };
  const created = [];
  itemsList.forEach(item => {
    if (!item || !item.name) return;
    const prod = createProduct({
      sku: item.sku,
      name: String(item.name).trim(),
      cost_dropi: Number(item.cost_dropi) || 0,
      suggested_price: Number(item.suggested_price) || 0,
      stock: Number(item.stock) || 0,
      category: item.category || 'Inventario',
      supplier: item.supplier || (effectiveUser.companyName || 'Mi Inventario'),
      origin_type: isAdmin ? (item.origin_type || 'propio') : 'propio',
      origin_city: item.origin_city || 'Bogotá D.C.',
      specifications: item.specifications || item.description || '',
      description: item.description || item.specifications || ''
    }, effectiveUser);
    created.push(prod);
  });
  return created;
}

function updateProduct(id, updates, user = null) {
  const current = getProductById(id);
  if (!current) return null;
  if (user && !canManageProduct(current, user)) return null;

  const isAdmin = !user || user.role === 'admin';
  const name = updates.name !== undefined ? updates.name : current.name;
  const cost = updates.cost_dropi !== undefined ? Number(updates.cost_dropi) : current.cost_dropi;
  const price = updates.suggested_price !== undefined ? Number(updates.suggested_price) : current.suggested_price;
  const stock = updates.stock !== undefined ? Number(updates.stock) : current.stock;
  const category = updates.category !== undefined ? updates.category : current.category;
  const supplier = updates.supplier !== undefined ? updates.supplier : current.supplier;
  const description = updates.description !== undefined ? updates.description : current.description;
  const originType = (isAdmin && updates.origin_type !== undefined) ? updates.origin_type : current.origin_type;
  const originCity = updates.origin_city !== undefined ? updates.origin_city : current.origin_city;
  const specifications = updates.specifications !== undefined ? updates.specifications : current.specifications;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE products
    SET name = ?, cost_dropi = ?, suggested_price = ?, stock = ?, category = ?, supplier = ?,
        description = ?, origin_type = ?, origin_city = ?, specifications = ?, updated_at = ?
    WHERE id = ?
  `).run(name, cost, price, stock, category, supplier, description, originType, originCity, specifications, now, current.id);

  return getProductById(current.id);
}

function deleteProduct(id, user = null) {
  const current = getProductById(id);
  if (!current) return false;
  if (user && !canManageProduct(current, user)) return false;
  db.prepare('DELETE FROM products WHERE id = ?').run(current.id);
  return true;
}

// Shipments & Multi-Origin Checkout Methods
function formatShipmentRow(row) {
  if (!row) return null;
  return {
    ...row,
    items: row.items_json ? JSON.parse(row.items_json) : [],
    steps: row.steps_json ? JSON.parse(row.steps_json) : [],
    notifications: row.notifications_json ? JSON.parse(row.notifications_json) : [],
    eval: row.eval_json ? JSON.parse(row.eval_json) : null
  };
}

function getShipmentsByTenant(tenantId) {
  const rows = db.prepare('SELECT * FROM shipments WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId);
  return rows.map(formatShipmentRow);
}

function createMultiOriginCheckout(tenantId, payload) {
  const customerName = (payload.customerName && String(payload.customerName).trim()) || 'Cliente EasyGrow';
  const destinationCity = (payload.destinationCity && String(payload.destinationCity).trim()) || 'Bogotá D.C.';
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  if (groups.length === 0) {
    throw new Error('El carrito no tiene grupos de envío válidos.');
  }

  const orderIdempotencyKey = payload.orderIdempotencyKey ? String(payload.orderIdempotencyKey).trim() : '';
  if (orderIdempotencyKey) {
    const existingAttr = db.prepare('SELECT * FROM sales_attributions WHERE order_key = ? AND tenant_id = ?').get(orderIdempotencyKey, tenantId);
    if (existingAttr) {
      const existingShipments = db.prepare('SELECT * FROM shipments WHERE checkout_group_id = ? AND tenant_id = ?').all(orderIdempotencyKey, tenantId).map(formatShipmentRow);
      return {
        duplicatePrevented: true,
        checkoutGroupId: orderIdempotencyKey,
        shipments: existingShipments,
        totalProductsValue: existingAttr.order_amount,
        totalShippingCost: existingShipments.reduce((s, sh) => s + (Number(sh.shipping_cost) || 0), 0),
        grandTotal: existingAttr.order_amount + existingShipments.reduce((s, sh) => s + (Number(sh.shipping_cost) || 0), 0),
        attribution: existingAttr
      };
    }
  }

  const checkoutGroupId = orderIdempotencyKey || ('PED-' + Math.floor(100000 + Math.random() * 900000));
  const now = new Date().toISOString();
  const timeStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const insertShipmentStmt = db.prepare(`
    INSERT INTO shipments (
      id, checkout_group_id, tenant_id, origin_label, origin_type, origin_city,
      destination_city, customer_name, carrier_name, carrier_coverage, shipping_cost,
      estimated_time, items_json, subtotal_products, status, steps_json,
      notifications_json, evaluated, eval_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)
  `);
  const updateStockStmt = db.prepare('UPDATE products SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ?');

  const createdShipments = [];
  const guideIds = [];
  let totalProductsValue = 0;
  let totalProductsCost = 0;
  let totalShippingCost = 0;

  groups.forEach((grp, idx) => {
    const rawItems = Array.isArray(grp.items) ? grp.items : [];
    const verifiedItems = [];
    let groupSubtotal = 0;
    let groupCost = 0;

    rawItems.forEach(entry => {
      const prod = getProductById(entry.productId || entry.id);
      if (!prod) return;
      const qty = Math.max(1, Number(entry.qty) || 1);
      const unitPrice = Number(prod.suggested_price) || 0;
      const unitCost = Number(prod.cost_dropi) || 0;
      groupSubtotal += unitPrice * qty;
      groupCost += unitCost * qty;
      updateStockStmt.run(qty, now, prod.id);
      verifiedItems.push({
        productId: prod.id,
        sku: prod.sku,
        name: prod.name,
        qty,
        unitPrice,
        unitCost,
        specifications: prod.specifications || '',
        originType: prod.origin_type || 'dropi',
        originCity: prod.origin_city || 'Medellín',
        supplier: prod.supplier || 'Bodega'
      });
    });

    if (verifiedItems.length === 0) return;

    const guiaId = `GUIA-${Math.floor(100000 + Math.random() * 900000)}-${idx + 1}`;
    const carrierName = grp.carrierName || 'Servientrega';
    const carrierCoverage = Number(grp.carrierCoverage) || 98;
    const shippingCost = Number(grp.shippingCost) || 12900;
    const estimatedTime = grp.estimatedTime || '24-48 hrs';
    const originCity = grp.originCity || verifiedItems[0].originCity || 'Medellín';
    const originType = grp.originType || verifiedItems[0].originType || 'dropi';
    const originLabel = grp.originLabel || `${verifiedItems[0].supplier} (${originCity})`;

    const steps = [
      { title: 'Guía Generada & Validación Origen', date: `Hoy, ${timeStr}`, done: true, current: false },
      { title: `Alistamiento en ${originCity}`, date: 'En proceso', done: false, current: true },
      { title: `Tránsito ${carrierName}`, date: estimatedTime, done: false, current: false },
      { title: `En Reparto ${destinationCity}`, date: 'Pendiente', done: false, current: false },
      { title: 'Entregado al Cliente', date: 'Pendiente', done: false, current: false }
    ];

    const notifications = [
      {
        id: 'ntf_' + Date.now() + '_' + idx,
        time: timeStr,
        type: 'guide',
        title: `Guía ${guiaId} generada`,
        message: `Envío asignado a ${carrierName} (Cobertura ${carrierCoverage}%, flete $${shippingCost.toLocaleString()} COP, estimado ${estimatedTime}) desde ${originLabel} hacia ${destinationCity}.`
      }
    ];

    insertShipmentStmt.run(
      guiaId,
      checkoutGroupId,
      tenantId,
      originLabel,
      originType,
      originCity,
      destinationCity,
      customerName,
      carrierName,
      carrierCoverage,
      shippingCost,
      estimatedTime,
      JSON.stringify(verifiedItems),
      groupSubtotal,
      'ALISTAMIENTO_ORIGEN',
      JSON.stringify(steps),
      JSON.stringify(notifications),
      now
    );

    totalProductsValue += groupSubtotal;
    totalProductsCost += groupCost;
    totalShippingCost += shippingCost;
    guideIds.push(guiaId);
    createdShipments.push(formatShipmentRow(db.prepare('SELECT * FROM shipments WHERE id = ?').get(guiaId)));
  });

  if (createdShipments.length === 0) {
    throw new Error('No se encontraron productos válidos para generar guías.');
  }

  // Register unified order into tenant CRM contacts with generated guide IDs
  const createdContact = createContact(tenantId, {
    name: customerName,
    contactPerson: customerName,
    phone: payload.customerPhone || '+57 310 000 0000',
    email: `${customerName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@cliente.co`,
    company: `Compra ${checkoutGroupId} (${createdShipments.length} envío${createdShipments.length > 1 ? 's' : ''})`,
    stage: 'closed',
    value: totalProductsValue,
    cost: totalProductsCost,
    tags: ['Estación-01', `${createdShipments.length}-Guías`, ...createdShipments.map(s => s.origin_type === 'propio' ? 'Inventario-Propio' : 'Dropi')],
    attribution: `Checkout Multi-Origen ${checkoutGroupId}`,
    dropiOrders: guideIds,
    timeline: [
      {
        date: `Hoy, ${timeStr}`,
        type: 'dropi',
        title: `${createdShipments.length} guía(s) generada(s): ${guideIds.join(', ')}`
      }
    ]
  });

  // Persist associated purchase record for Loyalty & Customer History (Station 02)
  const estDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const allBoughtItems = createdShipments.flatMap(s => s.items || []);
  const productsSummary = allBoughtItems.map(it => `${it.qty}x ${it.name}`).join(', ');
  createCustomerPurchase(tenantId, {
    contactId: createdContact.id,
    customerName,
    orderRef: `${checkoutGroupId} (${guideIds.join(', ')})`,
    productsSummary,
    items: allBoughtItems,
    amount: totalProductsValue,
    orderStatus: 'ALISTAMIENTO_ORIGEN',
    estimatedDeliveryDate: estDate,
    actualDeliveryDate: 'Pendiente'
  });

  // Record Sales Attribution in Station 05 (First Known Origin + Last Paid Campaign within Attribution Window)
  const attributionRecord = recordCheckoutAttribution(tenantId, {
    orderKey: checkoutGroupId,
    contactId: createdContact.id,
    customerName,
    orderAmount: totalProductsValue,
    orderStatus: 'COMPLETADA',
    attributionContext: payload.attributionContext || null
  });

  return {
    checkoutGroupId,
    shipments: createdShipments,
    totalProductsValue,
    totalShippingCost,
    grandTotal: totalProductsValue + totalShippingCost,
    attribution: attributionRecord
  };
}

function advanceShipmentStep(tenantId, shipmentId) {
  const row = db.prepare('SELECT * FROM shipments WHERE id = ? AND tenant_id = ?').get(shipmentId, tenantId);
  if (!row) return null;

  const steps = row.steps_json ? JSON.parse(row.steps_json) : [];
  const notifications = row.notifications_json ? JSON.parse(row.notifications_json) : [];
  const timeStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  let currentIdx = steps.findIndex(s => s.current);
  if (currentIdx === -1) {
    currentIdx = steps.findIndex(s => !s.done);
  }
  if (currentIdx === -1) {
    return formatShipmentRow(row);
  }

  steps[currentIdx].done = true;
  steps[currentIdx].current = false;
  steps[currentIdx].date = `Hoy, ${timeStr}`;

  let newStatus = row.status;
  let alertTitle = '';
  let alertMsg = '';

  const nextIdx = currentIdx + 1;
  if (nextIdx < steps.length) {
    steps[nextIdx].current = true;
    if (nextIdx === steps.length - 1) {
      steps[nextIdx].done = true;
      steps[nextIdx].current = false;
      steps[nextIdx].date = `Hoy, ${timeStr}`;
      newStatus = 'ENTREGADO';
      alertTitle = `Entrega confirmada (${row.id})`;
      alertMsg = `El envío desde ${row.origin_city} fue entregado en ${row.destination_city}. Ya puedes evaluar puntualidad, estado recibido y especificaciones.`;
    } else if (nextIdx === 2) {
      newStatus = 'EN_TRANSITO';
      alertTitle = `En tránsito con ${row.carrier_name}`;
      alertMsg = `${row.id} salió de ${row.origin_city} hacia ${row.destination_city}. Tiempo estimado: ${row.estimated_time}.`;
    } else if (nextIdx === 3) {
      newStatus = 'EN_REPARTO';
      alertTitle = `En reparto urbano (${row.destination_city})`;
      alertMsg = `El mensajero de ${row.carrier_name} lleva el paquete ${row.id} hacia ${row.customer_name}.`;
    } else {
      newStatus = 'EN_PROGRESO';
      alertTitle = `Actualización ${row.id}`;
      alertMsg = `Hito completado: ${steps[currentIdx].title}.`;
    }
  } else {
    newStatus = 'ENTREGADO';
    alertTitle = `Entrega completada (${row.id})`;
    alertMsg = `El pedido ${row.id} completó su ruta logística.`;
  }

  notifications.unshift({
    id: 'ntf_' + Date.now(),
    time: timeStr,
    type: newStatus === 'ENTREGADO' ? 'delivered' : 'progress',
    title: alertTitle,
    message: alertMsg
  });

  db.prepare(`
    UPDATE shipments SET status = ?, steps_json = ?, notifications_json = ?
    WHERE id = ? AND tenant_id = ?
  `).run(newStatus, JSON.stringify(steps), JSON.stringify(notifications), shipmentId, tenantId);

  if (newStatus === 'ENTREGADO') {
    const todayStr = new Date().toISOString().slice(0, 10);
    db.prepare(`
      UPDATE customer_purchases
      SET order_status = 'ENTREGADO', actual_delivery_date = ?
      WHERE tenant_id = ? AND order_ref LIKE ?
    `).run(todayStr, tenantId, `%${shipmentId}%`);
  }

  return formatShipmentRow(db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipmentId));
}

function evaluateShipment(tenantId, shipmentId, evalData) {
  const row = db.prepare('SELECT * FROM shipments WHERE id = ? AND tenant_id = ?').get(shipmentId, tenantId);
  if (!row) return null;

  const clampRating = (v) => Math.max(1, Math.min(5, Number(v) || 5));
  const punctuality = clampRating(evalData.punctuality);
  const receivedCondition = clampRating(evalData.receivedCondition);
  const specQuality = clampRating(evalData.specQuality);
  const notes = String(evalData.notes || '').trim();
  const timeStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const evalPayload = {
    punctuality,
    receivedCondition,
    specQuality,
    notes,
    evaluatedAt: new Date().toISOString()
  };

  const notifications = row.notifications_json ? JSON.parse(row.notifications_json) : [];
  notifications.unshift({
    id: 'ntf_eval_' + Date.now(),
    time: timeStr,
    type: 'evaluation',
    title: `Evaluación registrada (${row.id})`,
    message: `Proveedor: Puntualidad ${punctuality}/5 • Estado recibido ${receivedCondition}/5 | Producto: Especificaciones ${specQuality}/5.`
  });

  db.prepare(`
    UPDATE shipments SET evaluated = 1, eval_json = ?, notifications_json = ?
    WHERE id = ? AND tenant_id = ?
  `).run(JSON.stringify(evalPayload), JSON.stringify(notifications), shipmentId, tenantId);

  // Recalculate separated supplier & product specification quality averages in products table
  const items = row.items_json ? JSON.parse(row.items_json) : [];
  const updateProdRatingStmt = db.prepare(`
    UPDATE products
    SET supplier_punctuality = ?, supplier_condition = ?, product_spec_quality = ?, reviews_count = ?
    WHERE id = ?
  `);

  items.forEach(item => {
    const prod = getProductById(item.productId);
    if (!prod) return;
    const count = Math.max(1, Number(prod.reviews_count) || 1);
    const nextCount = count + 1;
    const avgPunct = Number((((Number(prod.supplier_punctuality) || 5) * count + punctuality) / nextCount).toFixed(2));
    const avgCond = Number((((Number(prod.supplier_condition) || 5) * count + receivedCondition) / nextCount).toFixed(2));
    const avgSpec = Number((((Number(prod.product_spec_quality) || 5) * count + specQuality) / nextCount).toFixed(2));
    updateProdRatingStmt.run(avgPunct, avgCond, avgSpec, nextCount, prod.id);
  });

  return formatShipmentRow(db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipmentId));
}

// Contacts Methods (Multi-Tenant CRM)
function getContactsByTenant(tenantId) {
  const rows = db.prepare('SELECT * FROM contacts WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId);
  return rows.map(r => ({
    ...r,
    tags: r.tags ? JSON.parse(r.tags) : [],
    dropiOrders: r.dropi_orders ? JSON.parse(r.dropi_orders) : [],
    timeline: r.timeline ? JSON.parse(r.timeline) : []
  }));
}

function createContact(tenantId, contactData) {
  const id = 'cnt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const now = new Date().toISOString();
  const tags = JSON.stringify(Array.isArray(contactData.tags) ? contactData.tags : ['Lead']);
  const dropiOrders = JSON.stringify(contactData.dropiOrders || []);
  const timeline = JSON.stringify(contactData.timeline || [
    { date: 'Hace un momento', type: 'crm', title: 'Contacto registrado en el CRM' }
  ]);

  db.prepare(`
    INSERT INTO contacts (id, tenant_id, name, contact_person, phone, email, company, stage, value, cost, tags, attribution, dropi_orders, timeline, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    contactData.name || 'Nuevo Contacto',
    contactData.contactPerson || contactData.name || '',
    contactData.phone || '',
    contactData.email || '',
    contactData.company || contactData.name || '',
    contactData.stage || 'prospects',
    Number(contactData.value) || 0,
    Number(contactData.cost) || 0,
    tags,
    contactData.attribution || 'Ingreso Manual',
    dropiOrders,
    timeline,
    now
  );

  return { id, tenantId, ...contactData };
}

// Seed Initial Community Formulas (Strict Privacy: Zero Client/Sales Data)
const communityFormulaCount = db.prepare("SELECT count(*) as count FROM formulas WHERE scope = 'community'").get().count;
if (communityFormulaCount === 0) {
  const seedFormulas = [
    {
      id: 'frm_comm_1',
      name: 'Oportunidad Ponderada Estándar',
      description: 'Fórmula compartida EasyGrow para proyectar el valor esperado de una oportunidad según la probabilidad de su etapa.',
      expression: 'VALOR_OPORTUNIDAD * (PROBABILIDAD_ETAPA / 100)',
      unit: 'COP'
    },
    {
      id: 'frm_comm_2',
      name: 'Rentabilidad Neta sobre Ventas (%)',
      description: 'Calcula el margen porcentual real descontando costos de mercancía sobre ventas cerradas.',
      expression: 'IF(VENTAS > 0, ROUND(((VENTAS - COSTOS) / VENTAS) * 100, 1), 0)',
      unit: '%'
    },
    {
      id: 'frm_comm_3',
      name: 'Proyección Combinada (Cerradas + Ponderada)',
      description: 'Suma las ventas ya ganadas más el pipeline abierto ponderado por probabilidad de etapa.',
      expression: 'VENTAS + CARTERA_PONDERADA',
      unit: 'COP'
    },
    {
      id: 'frm_comm_4',
      name: 'LTV Estimado (3 Compras Promedio)',
      description: 'Estima el valor de vida potencial de un cliente recurrente multiplicando la compra promedio por 3 ciclos.',
      expression: 'COMPRA_PROMEDIO * 3',
      unit: 'COP'
    }
  ];

  const fStmt = db.prepare(`
    INSERT INTO formulas (id, scope, tenant_id, author_name, name, description, expression, unit, created_at)
    VALUES (?, 'community', NULL, 'Equipo EasyGrow', ?, ?, ?, ?, ?)
  `);
  const nowIso = new Date().toISOString();
  seedFormulas.forEach(f => fStmt.run(f.id, f.name, f.description, f.expression, f.unit, nowIso));
}

// --- Station 02: Editable Kanban Stages + Common Categories + Weighted Probability ---
function ensureDefaultStagesForTenant(tenantId) {
  const count = db.prepare('SELECT count(*) as count FROM kanban_stages WHERE tenant_id = ?').get(tenantId).count;
  if (count > 0) return;

  const defaults = [
    { slug: 'prospects', name: 'Prospectos Iniciales', common_category: 'nuevo', probability: 20, position: 1 },
    { slug: 'negotiation', name: 'Propuesta Enviada / Negociación', common_category: 'en_progreso', probability: 50, position: 2 },
    { slug: 'closed', name: 'Ventas Ganadas (Cierre)', common_category: 'ganado', probability: 100, position: 3 },
    { slug: 'lost', name: 'Oportunidad Perdida', common_category: 'perdido', probability: 0, position: 4 }
  ];

  const stmt = db.prepare(`
    INSERT INTO kanban_stages (id, tenant_id, slug, name, common_category, probability, suggested_probability, position, created_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `);
  const now = new Date().toISOString();
  defaults.forEach((d, idx) => {
    stmt.run(`stg_${tenantId}_${idx}_${d.slug}`, tenantId, d.slug, d.name, d.common_category, d.probability, d.position, now);
  });
}

function getStagesByTenant(tenantId) {
  ensureDefaultStagesForTenant(tenantId);
  return db.prepare('SELECT * FROM kanban_stages WHERE tenant_id = ? ORDER BY position ASC, created_at ASC').all(tenantId);
}

function getHistoricalProbabilitySuggestions(tenantId) {
  const stages = getStagesByTenant(tenantId);
  const contacts = getContactsByTenant(tenantId);
  const catMap = {};
  stages.forEach(s => { catMap[s.slug] = s.common_category; });

  let wonCount = 0;
  let lostCount = 0;
  contacts.forEach(c => {
    const cat = catMap[c.stage] || (c.stage === 'closed' ? 'ganado' : (c.stage === 'lost' ? 'perdido' : 'en_progreso'));
    if (cat === 'ganado') wonCount++;
    else if (cat === 'perdido') lostCount++;
  });

  const resolvedCount = wonCount + lostCount;
  const empiricalWinPct = resolvedCount > 0 ? Math.round((wonCount / resolvedCount) * 100) : null;
  const hasEnoughHistory = resolvedCount >= 3;

  const suggestions = [];
  if (hasEnoughHistory && empiricalWinPct !== null) {
    stages.forEach(s => {
      if (s.common_category === 'nuevo') {
        const recommended = Math.min(45, Math.max(10, Math.round(empiricalWinPct * 0.4)));
        if (Math.abs(recommended - Number(s.probability)) >= 5) {
          suggestions.push({
            stageId: s.id,
            stageName: s.name,
            commonCategory: s.common_category,
            currentProbability: Number(s.probability),
            suggestedProbability: recommended,
            reason: `Basado en ${wonCount} ganadas y ${lostCount} perdidas (conversión histórica ${empiricalWinPct}%).`
          });
        }
      } else if (s.common_category === 'en_progreso') {
        const recommended = Math.min(88, Math.max(25, Math.round(empiricalWinPct * 0.85)));
        if (Math.abs(recommended - Number(s.probability)) >= 5) {
          suggestions.push({
            stageId: s.id,
            stageName: s.name,
            commonCategory: s.common_category,
            currentProbability: Number(s.probability),
            suggestedProbability: recommended,
            reason: `Ajuste calculado según ${resolvedCount} cierres evaluados en tu tienda.`
          });
        }
      }
    });
  }

  return {
    resolvedCount,
    wonCount,
    lostCount,
    empiricalWinPct: empiricalWinPct ?? 0,
    hasEnoughHistory,
    suggestions
  };
}

function createStage(tenantId, data) {
  ensureDefaultStagesForTenant(tenantId);
  const validCategories = ['nuevo', 'en_progreso', 'ganado', 'perdido'];
  const cat = validCategories.includes(data.common_category) ? data.common_category : 'en_progreso';
  const defaultProb = cat === 'ganado' ? 100 : (cat === 'perdido' ? 0 : (cat === 'nuevo' ? 20 : 50));
  const prob = data.probability !== undefined ? Math.max(0, Math.min(100, Number(data.probability) || 0)) : defaultProb;
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) as m FROM kanban_stages WHERE tenant_id = ?').get(tenantId).m;
  const id = 'stg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const slug = 'stg_' + Date.now().toString().slice(-6);
  const name = String(data.name || 'Nueva Etapa').trim();

  db.prepare(`
    INSERT INTO kanban_stages (id, tenant_id, slug, name, common_category, probability, suggested_probability, position, created_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `).run(id, tenantId, slug, name, cat, prob, maxPos + 1, new Date().toISOString());

  return db.prepare('SELECT * FROM kanban_stages WHERE id = ?').get(id);
}

function updateStageConfig(tenantId, stageId, updates) {
  const existing = db.prepare('SELECT * FROM kanban_stages WHERE id = ? AND tenant_id = ?').get(stageId, tenantId);
  if (!existing) return null;

  const validCategories = ['nuevo', 'en_progreso', 'ganado', 'perdido'];
  const name = updates.name !== undefined ? String(updates.name).trim() || existing.name : existing.name;
  const commonCategory = validCategories.includes(updates.common_category) ? updates.common_category : existing.common_category;
  const probability = updates.probability !== undefined ? Math.max(0, Math.min(100, Number(updates.probability))) : existing.probability;
  const position = updates.position !== undefined ? Number(updates.position) : existing.position;

  db.prepare(`
    UPDATE kanban_stages SET name = ?, common_category = ?, probability = ?, position = ?
    WHERE id = ? AND tenant_id = ?
  `).run(name, commonCategory, probability, position, stageId, tenantId);

  return db.prepare('SELECT * FROM kanban_stages WHERE id = ?').get(stageId);
}

function deleteStageConfig(tenantId, stageId) {
  const stages = getStagesByTenant(tenantId);
  if (stages.length <= 2) {
    throw new Error('Debes mantener al menos 2 etapas activas en el tablero.');
  }
  const target = stages.find(s => s.id === stageId);
  if (!target) return false;
  const fallback = stages.find(s => s.id !== stageId);
  if (fallback) {
    db.prepare('UPDATE contacts SET stage = ? WHERE tenant_id = ? AND stage = ?').run(fallback.slug, tenantId, target.slug);
  }
  const res = db.prepare('DELETE FROM kanban_stages WHERE id = ? AND tenant_id = ?').run(stageId, tenantId);
  return res.changes > 0;
}

// --- Station 02: Customer Loyalty & Associated Purchases History ---
function getPurchasesByTenant(tenantId) {
  const rows = db.prepare('SELECT * FROM customer_purchases WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId);
  return rows.map(r => ({
    ...r,
    items: r.items_json ? JSON.parse(r.items_json) : []
  }));
}

function createCustomerPurchase(tenantId, data) {
  const id = 'pur_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const now = new Date().toISOString();
  const estDate = data.estimatedDeliveryDate || new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const actualDate = data.actualDeliveryDate || 'Pendiente';
  const items = Array.isArray(data.items) ? data.items : [];
  const summary = data.productsSummary || (items.length > 0 ? items.map(i => `${i.qty || 1}x ${i.name}`).join(', ') : 'Compra directa');

  db.prepare(`
    INSERT INTO customer_purchases (
      id, tenant_id, contact_id, customer_name, order_ref, products_summary, items_json,
      amount, order_status, estimated_delivery_date, actual_delivery_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    data.contactId || '',
    data.customerName || 'Cliente',
    data.orderRef || `ORD-${Date.now().toString().slice(-6)}`,
    summary,
    JSON.stringify(items),
    Number(data.amount) || 0,
    data.orderStatus || 'CONFIRMADO',
    estDate,
    actualDate,
    now
  );

  return db.prepare('SELECT * FROM customer_purchases WHERE id = ?').get(id);
}

function markPurchaseDelivered(tenantId, purchaseId) {
  const existing = db.prepare('SELECT * FROM customer_purchases WHERE id = ? AND tenant_id = ?').get(purchaseId, tenantId);
  if (!existing) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  db.prepare(`
    UPDATE customer_purchases SET order_status = 'ENTREGADO', actual_delivery_date = ?
    WHERE id = ? AND tenant_id = ?
  `).run(todayStr, purchaseId, tenantId);
  return db.prepare('SELECT * FROM customer_purchases WHERE id = ?').get(purchaseId);
}

// --- Station 02: Formulas (Mis Fórmulas Privadas vs. Fórmulas de la Comunidad) ---
function getFormulasForUser(tenantId) {
  const privateFormulas = db.prepare(`
    SELECT * FROM formulas WHERE scope = 'private' AND tenant_id = ? ORDER BY created_at DESC
  `).all(tenantId);
  const communityFormulas = db.prepare(`
    SELECT id, scope, author_name, name, description, expression, unit, created_at
    FROM formulas WHERE scope = 'community' ORDER BY created_at DESC
  `).all();
  return { privateFormulas, communityFormulas };
}

function createFormula(user, data) {
  const scope = data.scope === 'community' ? 'community' : 'private';
  const id = 'frm_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const now = new Date().toISOString();
  const tenantId = scope === 'private' ? user.tenantId : null;
  const authorName = scope === 'community' ? (user.companyName || user.name || 'Tienda EasyGrow') : (user.name || 'Yo');

  db.prepare(`
    INSERT INTO formulas (id, scope, tenant_id, author_name, name, description, expression, unit, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    scope,
    tenantId,
    authorName,
    String(data.name || 'Nueva Fórmula').trim(),
    String(data.description || 'Indicador personalizado').trim(),
    String(data.expression || '0').trim(),
    String(data.unit || 'COP').trim(),
    now
  );

  return db.prepare('SELECT * FROM formulas WHERE id = ?').get(id);
}

function copyCommunityFormulaToPrivate(user, formulaId) {
  const source = db.prepare("SELECT * FROM formulas WHERE id = ? AND scope = 'community'").get(formulaId);
  if (!source) return null;
  return createFormula(user, {
    scope: 'private',
    name: source.name,
    description: `${source.description} (Copiada de Comunidad)`,
    expression: source.expression,
    unit: source.unit
  });
}

function deleteFormula(user, formulaId) {
  const existing = db.prepare('SELECT * FROM formulas WHERE id = ?').get(formulaId);
  if (!existing) return false;
  if (existing.scope === 'private' && existing.tenant_id !== user.tenantId) return false;
  if (existing.scope === 'community' && user.role !== 'admin') return false;
  const res = db.prepare('DELETE FROM formulas WHERE id = ?').run(formulaId);
  return res.changes > 0;
}

function batchImportContacts(tenantId, contactsList) {
  const created = [];
  const stmt = db.prepare(`
    INSERT INTO contacts (id, tenant_id, name, contact_person, phone, email, company, stage, value, cost, tags, attribution, dropi_orders, timeline, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  contactsList.forEach(item => {
    const id = 'cnt_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    const tags = JSON.stringify(Array.isArray(item.tags) ? item.tags : ['Importación-Excel']);
    const timeline = JSON.stringify([
      { date: new Date().toLocaleDateString('es-CO'), type: 'import', title: 'Registro importado desde Excel' }
    ]);
    const dropiOrders = JSON.stringify(item.dropiOrders || []);

    stmt.run(
      id,
      tenantId,
      item.name || item.company || 'Cliente Importado',
      item.contactPerson || item.name || '',
      item.phone || '',
      item.email || '',
      item.company || item.name || '',
      item.stage || 'closed',
      Number(item.value) || 0,
      Number(item.cost) || 0,
      tags,
      item.attribution || 'Importación Masiva Excel',
      dropiOrders,
      timeline,
      now
    );
    created.push({ id, ...item });
  });

  return created;
}

function updateContactStage(tenantId, contactId, stage) {
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ? AND tenant_id = ?').get(contactId, tenantId);
  if (!contact) return null;

  const timeline = contact.timeline ? JSON.parse(contact.timeline) : [];
  timeline.unshift({
    date: 'Hace un momento',
    type: 'stage-change',
    title: `Etapa actualizada a ${stage}`
  });

  db.prepare(`
    UPDATE contacts SET stage = ?, timeline = ? WHERE id = ? AND tenant_id = ?
  `).run(stage, JSON.stringify(timeline), contactId, tenantId);

  return { ...contact, stage, timeline };
}

function deleteContact(tenantId, contactId) {
  const res = db.prepare('DELETE FROM contacts WHERE id = ? AND tenant_id = ?').run(contactId, tenantId);
  return res.changes > 0;
}

function getTenantMetrics(tenantId, period = 'all') {
  const stages = getStagesByTenant(tenantId);
  const stageMetaMap = {};
  stages.forEach(s => {
    stageMetaMap[s.slug] = {
      common_category: s.common_category,
      probability: Number(s.probability) || 0,
      name: s.name
    };
  });

  const contacts = getContactsByTenant(tenantId);
  const purchases = getPurchasesByTenant(tenantId);

  const getStageInfo = (stageSlug) => {
    if (stageMetaMap[stageSlug]) return stageMetaMap[stageSlug];
    if (stageSlug === 'closed') return { common_category: 'ganado', probability: 100 };
    if (stageSlug === 'lost') return { common_category: 'perdido', probability: 0 };
    if (stageSlug === 'prospects') return { common_category: 'nuevo', probability: 20 };
    return { common_category: 'en_progreso', probability: 50 };
  };

  const nowMs = Date.now();
  const nowDate = new Date();
  const inPeriod = (isoStr) => {
    if (!period || period === 'all') return true;
    const d = new Date(isoStr || nowMs);
    if (period === 'today') {
      return d.toISOString().slice(0, 10) === nowDate.toISOString().slice(0, 10);
    }
    if (period === '7d') {
      return (nowMs - d.getTime()) <= 7 * 86400000;
    }
    if (period === 'month') {
      return d.getUTCFullYear() === nowDate.getUTCFullYear() && d.getUTCMonth() === nowDate.getUTCMonth();
    }
    return true;
  };

  const closed = contacts.filter(c => getStageInfo(c.stage).common_category === 'ganado');
  const openContacts = contacts.filter(c => {
    const cat = getStageInfo(c.stage).common_category;
    return cat === 'nuevo' || cat === 'en_progreso';
  });

  const totalRevenue = closed.reduce((acc, c) => acc + (Number(c.value) || 0), 0);
  const totalCost = closed.reduce((acc, c) => acc + (Number(c.cost) || 0), 0);
  const netProfit = totalRevenue - totalCost;
  const grossMarginPct = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

  const periodClosed = closed.filter(c => inPeriod(c.created_at));
  const periodRevenue = periodClosed.reduce((acc, c) => acc + (Number(c.value) || 0), 0);

  const openOpportunitiesValue = openContacts.reduce((acc, c) => acc + (Number(c.value) || 0), 0);
  // Shared projection formula: sum(opportunity_value * (stage_probability / 100))
  const weightedPipelineValue = Math.round(
    openContacts.reduce((acc, c) => {
      const prob = getStageInfo(c.stage).probability;
      return acc + (Number(c.value) || 0) * (prob / 100);
    }, 0)
  );

  const totalLeads = contacts.length;
  const closedCount = closed.length;
  const winRate = totalLeads > 0 ? Number(((closedCount / totalLeads) * 100).toFixed(1)) : 0;

  // Average purchase: prioritize explicit purchase records, fallback to closed deals
  const purchaseTotalAmt = purchases.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const avgPurchaseValue = purchases.length > 0
    ? Math.round(purchaseTotalAmt / purchases.length)
    : (closedCount > 0 ? Math.round(totalRevenue / closedCount) : 0);

  const customersWithPurchases = new Set(purchases.map(p => p.contact_id || p.customer_name)).size;

  return {
    totalRevenue,
    totalCost,
    netProfit,
    grossMarginPct,
    pipelineValue: openOpportunitiesValue,
    openOpportunitiesCount: openContacts.length,
    openOpportunitiesValue,
    weightedPipelineValue,
    avgPurchaseValue,
    period,
    periodRevenue,
    purchasesCount: purchases.length,
    customersWithPurchases,
    totalLeads,
    closedCount,
    winRate
  };
}

// =====================================================================
// Estación 03 — Google Forms, Clasificación Asistida y QRs Dinámicos
// =====================================================================

function normalizeTextForMatch(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function buildEmbedUrl(rawUrl) {
  const clean = String(rawUrl || '').trim();
  if (!clean) return '';
  if (clean.includes('embedded=true')) return clean;
  return clean.includes('?') ? `${clean}&embedded=true` : `${clean}?embedded=true`;
}

function getLocalDateTimeParts(dateInput, timeInput) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const defaultDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const defaultTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const createdDate = (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(String(dateInput).trim()))
    ? String(dateInput).trim()
    : defaultDate;
  const rawTime = String(timeInput || '').trim();
  const createdTime = /^\d{2}:\d{2}(:\d{2})?$/.test(rawTime)
    ? (rawTime.length === 5 ? `${rawTime}:00` : rawTime)
    : defaultTime;
  return { createdDate, createdTime };
}

function ensureStation3Defaults(tenantId) {
  const now = new Date().toISOString();
  const slugSafe = String(tenantId || 'tienda').replace(/[^a-zA-Z0-9]/g, '').slice(0, 14) || 'easygrow';
  const defaultFormUrl = `https://docs.google.com/forms/d/e/1FAIpQLSeEG_${slugSafe}/viewform`;

  const cfg = db.prepare('SELECT * FROM form_configs WHERE tenant_id = ?').get(tenantId);
  if (!cfg) {
    db.prepare(`
      INSERT INTO form_configs (tenant_id, form_title, google_form_url, embed_url, auto_created, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      tenantId,
      'Formulario Google Forms — Captación y Requerimientos EasyGrow',
      defaultFormUrl,
      buildEmbedUrl(defaultFormUrl),
      1,
      now
    );
  }

  const ruleCount = db.prepare('SELECT COUNT(*) AS cnt FROM form_rules WHERE tenant_id = ?').get(tenantId).cnt;
  if (ruleCount === 0) {
    const stmt = db.prepare(`
      INSERT INTO form_rules (id, tenant_id, category_name, keywords, priority, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      `frule_${tenantId}_1`,
      tenantId,
      'Pedido Mayorista / Distribución',
      'mayorista, docena, volumen, distribuir, unidades, b2b, lote',
      1,
      'user',
      now
    );
    stmt.run(
      `frule_${tenantId}_2`,
      tenantId,
      'Cotización Producto / Catálogo Dropi',
      'precio, catalogo, producto, envio, comprar, cotizar, dropi, stock',
      2,
      'user',
      now
    );
    stmt.run(
      `frule_${tenantId}_3`,
      tenantId,
      'Garantía o Requerimiento Especial',
      'garantia, cambio, soporte, urgente, especial, medida, factura',
      3,
      'user',
      now
    );
  }

  const qrCount = db.prepare('SELECT COUNT(*) AS cnt FROM qr_codes WHERE tenant_id = ?').get(tenantId).cnt;
  if (qrCount === 0) {
    const stmt = db.prepare(`
      INSERT INTO qr_codes (id, tenant_id, code_slug, name, placement, campaign, dest_type, target_url, total_scans, unique_scans, last_scan_at, identified_leads, history_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'Sin escaneos aún', 0, ?, ?)
    `);
    stmt.run(
      `qr_${tenantId}_1`,
      tenantId,
      'EG-QR-PACK-01',
      'QR Empaque / Tarjeta de Agradecimiento',
      'Empaque / Tarjeta',
      'Fidelización Post-Compra Q4',
      'google_form',
      defaultFormUrl,
      JSON.stringify([
        { at: now.slice(0, 16).replace('T', ' '), note: 'QR generado y vinculado inicialmente a Google Forms' }
      ]),
      now
    );
    stmt.run(
      `qr_${tenantId}_2`,
      tenantId,
      'EG-QR-COUNTER-02',
      'QR Mostrador / Volante Promocional',
      'Mostrador y Volantes',
      'Catálogo Híbrido EasyGrow',
      'product',
      'https://easygrow.co/catalogo-dropi',
      JSON.stringify([
        { at: now.slice(0, 16).replace('T', ' '), note: 'QR generado apuntando a Página de Producto' }
      ]),
      now
    );
  }
}

function classifyRequirementText(tenantId, requirementText) {
  const norm = normalizeTextForMatch(requirementText);
  const rules = db.prepare('SELECT * FROM form_rules WHERE tenant_id = ? ORDER BY priority ASC, created_at ASC').all(tenantId);

  let matchedCategory = 'Revisión General (Sin regla exacta)';
  for (const r of rules) {
    const kws = String(r.keywords || '')
      .split(',')
      .map(k => normalizeTextForMatch(k).trim())
      .filter(Boolean);
    if (kws.some(kw => norm.includes(kw))) {
      matchedCategory = r.category_name;
      break;
    }
  }

  let aiSuggestedCategory = matchedCategory;
  if (matchedCategory === 'Revisión General (Sin regla exacta)') {
    if (/(mayor|docen|lote|distribu|10 |20 |50 |100 |empresa|tienda)/.test(norm)) {
      aiSuggestedCategory = 'Pedido Mayorista / Distribución';
    } else if (/(whatsapp|llamar|reunion|alianza|socio|comercial)/.test(norm)) {
      aiSuggestedCategory = 'Alianza Comercial / Contacto Directo';
    } else if (/(garant|falla|daño|reemplazo|urgente|factura|medida|personaliz)/.test(norm)) {
      aiSuggestedCategory = 'Garantía o Requerimiento Especial';
    } else if (/(precio|valor|costo|catalogo|producto|comprar|envio|contraentrega)/.test(norm)) {
      aiSuggestedCategory = 'Cotización Producto / Catálogo Dropi';
    } else {
      aiSuggestedCategory = 'Consulta General para Análisis Humano';
    }
  }

  return { matchedCategory, aiSuggestedCategory };
}

function formatQRRow(r) {
  return {
    ...r,
    history: r.history_json ? JSON.parse(r.history_json) : []
  };
}

function getStation3Workspace(tenantId) {
  ensureStation3Defaults(tenantId);
  const config = db.prepare('SELECT * FROM form_configs WHERE tenant_id = ?').get(tenantId);
  const rules = db.prepare('SELECT * FROM form_rules WHERE tenant_id = ? ORDER BY priority ASC, created_at ASC').all(tenantId);
  const submissions = db.prepare('SELECT * FROM form_submissions WHERE tenant_id = ? ORDER BY created_date DESC, created_time DESC, created_at DESC').all(tenantId);
  const qrCodes = db.prepare('SELECT * FROM qr_codes WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId).map(formatQRRow);
  return { config, rules, submissions, qrCodes };
}

function saveGoogleFormConfig(tenantId, data) {
  ensureStation3Defaults(tenantId);
  const now = new Date().toISOString();
  const mode = data.mode === 'autocreate' ? 'autocreate' : 'link';
  const formTitle = String(data.formTitle || 'Formulario Google Forms — Captación EasyGrow').trim();

  let googleFormUrl = String(data.googleFormUrl || '').trim();
  if (mode === 'autocreate' || !googleFormUrl) {
    const suffix = Date.now().toString(36).slice(-5).toUpperCase();
    const slugSafe = String(tenantId || 'eg').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'eg';
    googleFormUrl = `https://docs.google.com/forms/d/e/1FAIpQLSeEG_${slugSafe}_${suffix}/viewform`;
  }
  const embedUrl = buildEmbedUrl(googleFormUrl);

  db.prepare(`
    UPDATE form_configs
    SET form_title = ?, google_form_url = ?, embed_url = ?, auto_created = ?, updated_at = ?
    WHERE tenant_id = ?
  `).run(formTitle, googleFormUrl, embedUrl, mode === 'autocreate' ? 1 : 0, now, tenantId);

  return db.prepare('SELECT * FROM form_configs WHERE tenant_id = ?').get(tenantId);
}

function reclassifyPendingSubmissions(tenantId) {
  const pending = db.prepare("SELECT * FROM form_submissions WHERE tenant_id = ? AND human_status = 'Pendiente de revisión'").all(tenantId);
  const upd = db.prepare('UPDATE form_submissions SET matched_category = ?, ai_suggested_category = ? WHERE id = ? AND tenant_id = ?');
  pending.forEach(row => {
    const { matchedCategory, aiSuggestedCategory } = classifyRequirementText(tenantId, row.requirement_text);
    upd.run(matchedCategory, aiSuggestedCategory, row.id, tenantId);
  });
  return pending.length;
}

function createFormRule(tenantId, data) {
  ensureStation3Defaults(tenantId);
  const id = 'frule_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const now = new Date().toISOString();
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM form_rules WHERE tenant_id = ?').get(tenantId).cnt;
  const categoryName = String(data.categoryName || 'Nueva Categoría').trim();
  const keywords = String(data.keywords || '').trim();
  const priority = Number(data.priority) || (count + 1);
  const source = data.source === 'ai' ? 'ai' : 'user';

  db.prepare(`
    INSERT INTO form_rules (id, tenant_id, category_name, keywords, priority, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, tenantId, categoryName, keywords, priority, source, now);

  reclassifyPendingSubmissions(tenantId);
  return db.prepare('SELECT * FROM form_rules WHERE id = ?').get(id);
}

function deleteFormRule(tenantId, ruleId) {
  const res = db.prepare('DELETE FROM form_rules WHERE id = ? AND tenant_id = ?').run(ruleId, tenantId);
  if (res.changes > 0) {
    reclassifyPendingSubmissions(tenantId);
    return true;
  }
  return false;
}

function aiSuggestAndOrganizeForms(tenantId) {
  ensureStation3Defaults(tenantId);
  const submissions = db.prepare('SELECT * FROM form_submissions WHERE tenant_id = ?').all(tenantId);
  const existingRules = db.prepare('SELECT * FROM form_rules WHERE tenant_id = ?').all(tenantId);
  const existingNames = new Set(existingRules.map(r => normalizeTextForMatch(r.category_name)));

  const createdRules = [];
  const unmatchedTexts = submissions
    .filter(s => s.matched_category === 'Revisión General (Sin regla exacta)')
    .map(s => normalizeTextForMatch(s.requirement_text))
    .join(' ');

  if (unmatchedTexts.includes('contraentrega') || unmatchedTexts.includes('efectivo') || unmatchedTexts.includes('pago')) {
    if (!existingNames.has(normalizeTextForMatch('Consultas de Pago y Contraentrega'))) {
      createdRules.push(createFormRule(tenantId, {
        categoryName: 'Consultas de Pago y Contraentrega',
        keywords: 'contraentrega, efectivo, pago, nequi, transferencia',
        source: 'ai'
      }));
    }
  }
  if (unmatchedTexts.includes('alianza') || unmatchedTexts.includes('tik') || unmatchedTexts.includes('instagram') || unmatchedTexts.includes('creador')) {
    if (!existingNames.has(normalizeTextForMatch('Alianza Comercial / Creadores'))) {
      createdRules.push(createFormRule(tenantId, {
        categoryName: 'Alianza Comercial / Creadores',
        keywords: 'alianza, instagram, tiktok, creador, pauta, socio',
        source: 'ai'
      }));
    }
  }

  let updatedRows = 0;
  const updStmt = db.prepare('UPDATE form_submissions SET matched_category = ?, ai_suggested_category = ? WHERE id = ? AND tenant_id = ?');
  submissions.forEach(s => {
    const { matchedCategory, aiSuggestedCategory } = classifyRequirementText(tenantId, s.requirement_text);
    const nextCategory = matchedCategory === 'Revisión General (Sin regla exacta)' && aiSuggestedCategory !== 'Consulta General para Análisis Humano'
      ? aiSuggestedCategory
      : matchedCategory;
    if (s.matched_category !== nextCategory || s.ai_suggested_category !== aiSuggestedCategory) {
      updStmt.run(nextCategory, aiSuggestedCategory, s.id, tenantId);
      updatedRows++;
    }
  });

  return {
    createdRules,
    updatedRows,
    totalAnalyzed: submissions.length
  };
}

function createFormSubmission(tenantId, data) {
  ensureStation3Defaults(tenantId);
  const id = 'fsub_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const nowIso = new Date().toISOString();
  const { createdDate, createdTime } = getLocalDateTimeParts(data.createdDate, data.createdTime);
  const requirementText = String(data.requirementText || '').trim() || 'Solicitud de información sin detalle';
  const { matchedCategory, aiSuggestedCategory } = classifyRequirementText(tenantId, requirementText);

  db.prepare(`
    INSERT INTO form_submissions (
      id, tenant_id, respondent_name, respondent_contact, requirement_text,
      matched_category, ai_suggested_category, human_status, human_notes,
      source_channel, source_qr_id, created_date, created_time, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    String(data.respondentName || 'Remitente Google Forms').trim(),
    String(data.respondentContact || '').trim(),
    requirementText,
    matchedCategory,
    aiSuggestedCategory,
    'Pendiente de revisión',
    '',
    String(data.sourceChannel || 'Google Forms (Enlace Directo)').trim(),
    String(data.sourceQrId || '').trim(),
    createdDate,
    createdTime,
    nowIso
  );

  return db.prepare('SELECT * FROM form_submissions WHERE id = ?').get(id);
}

function updateFormSubmissionReview(tenantId, subId, data) {
  const row = db.prepare('SELECT * FROM form_submissions WHERE id = ? AND tenant_id = ?').get(subId, tenantId);
  if (!row) return null;

  const allowedStatuses = new Set(['Pendiente de revisión', 'Revisado - Aprobado', 'Revisado - Descartado']);
  const nextStatus = allowedStatuses.has(data.humanStatus) ? data.humanStatus : row.human_status;
  const nextCategory = data.matchedCategory ? String(data.matchedCategory).trim() : row.matched_category;
  const nextNotes = data.humanNotes !== undefined ? String(data.humanNotes).trim() : row.human_notes;

  db.prepare(`
    UPDATE form_submissions
    SET human_status = ?, matched_category = ?, human_notes = ?
    WHERE id = ? AND tenant_id = ?
  `).run(nextStatus, nextCategory, nextNotes, subId, tenantId);

  return db.prepare('SELECT * FROM form_submissions WHERE id = ?').get(subId);
}

function deleteFormSubmission(tenantId, subId) {
  const res = db.prepare('DELETE FROM form_submissions WHERE id = ? AND tenant_id = ?').run(subId, tenantId);
  return res.changes > 0;
}

function createQRCode(tenantId, data) {
  ensureStation3Defaults(tenantId);
  const id = 'qr_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const nowIso = new Date().toISOString();
  const slugSuffix = Date.now().toString(36).slice(-4).toUpperCase();
  const codeSlug = String(data.codeSlug || `EG-QR-${slugSuffix}`).trim().toUpperCase();
  const name = String(data.name || 'Nuevo QR Dinámico').trim();
  const placement = String(data.placement || 'Empaque / Tarjeta').trim();
  const campaign = String(data.campaign || 'Campaña General EasyGrow').trim();
  const destType = ['google_form', 'product', 'whatsapp', 'custom'].includes(data.destType) ? data.destType : 'google_form';
  const targetUrl = String(data.targetUrl || 'https://easygrow.co/catalogo-dropi').trim();

  const history = [
    { at: nowIso.slice(0, 16).replace('T', ' '), note: `QR creado (${destType} → ${targetUrl})` }
  ];

  db.prepare(`
    INSERT INTO qr_codes (
      id, tenant_id, code_slug, name, placement, campaign, dest_type, target_url,
      total_scans, unique_scans, last_scan_at, identified_leads, history_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'Sin escaneos aún', 0, ?, ?)
  `).run(id, tenantId, codeSlug, name, placement, campaign, destType, targetUrl, JSON.stringify(history), nowIso);

  return formatQRRow(db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(id));
}

function updateQRCodeDestination(tenantId, qrId, data) {
  const row = db.prepare('SELECT * FROM qr_codes WHERE id = ? AND tenant_id = ?').get(qrId, tenantId);
  if (!row) return null;

  const destType = ['google_form', 'product', 'whatsapp', 'custom'].includes(data.destType) ? data.destType : row.dest_type;
  const targetUrl = data.targetUrl ? String(data.targetUrl).trim() : row.target_url;
  const campaign = data.campaign ? String(data.campaign).trim() : row.campaign;

  const { createdDate, createdTime } = getLocalDateTimeParts();
  const history = row.history_json ? JSON.parse(row.history_json) : [];
  history.unshift({
    at: `${createdDate} ${createdTime}`,
    note: `Destino actualizado sin reimprimir: ${row.dest_type} → ${destType} (${targetUrl})`
  });

  db.prepare(`
    UPDATE qr_codes
    SET dest_type = ?, target_url = ?, campaign = ?, history_json = ?
    WHERE id = ? AND tenant_id = ?
  `).run(destType, targetUrl, campaign, JSON.stringify(history.slice(0, 12)), qrId, tenantId);

  return formatQRRow(db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(qrId));
}

function recordQRScan(tenantId, qrId, scanData = {}) {
  const row = db.prepare('SELECT * FROM qr_codes WHERE id = ? AND tenant_id = ?').get(qrId, tenantId);
  if (!row) return null;

  const { createdDate, createdTime } = getLocalDateTimeParts(scanData.createdDate, scanData.createdTime);
  const scanStamp = `${createdDate} ${createdTime}`;
  const isUnique = scanData.isUnique !== false ? 1 : 0;
  const nextTotal = (Number(row.total_scans) || 0) + 1;
  const nextUnique = (Number(row.unique_scans) || 0) + isUnique;

  let nextIdentified = Number(row.identified_leads) || 0;
  let createdSubmission = null;

  if (scanData.identifiedSubmission) {
    nextIdentified += 1;
    createdSubmission = createFormSubmission(tenantId, {
      respondentName: scanData.respondentName || 'Cliente desde QR Dinámico',
      respondentContact: scanData.respondentContact || '',
      requirementText: scanData.requirementText || 'Escaneo QR y solicitud en Google Form',
      sourceChannel: `QR Dinámico (${row.name}) → Google Forms`,
      sourceQrId: row.code_slug,
      createdDate,
      createdTime
    });
  }

  db.prepare(`
    UPDATE qr_codes
    SET total_scans = ?, unique_scans = ?, last_scan_at = ?, identified_leads = ?
    WHERE id = ? AND tenant_id = ?
  `).run(nextTotal, nextUnique, scanStamp, nextIdentified, qrId, tenantId);

  return {
    qr: formatQRRow(db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(qrId)),
    createdSubmission
  };
}

// =====================================================================
// Estación 04 — WhatsApp Business Platform, Cifrado AES-256-GCM, Webhooks,
// Llamadas Perdidas Calling API, Bandeja WA/IG/FB, Orbe IA y Calendario
// =====================================================================

function getMetaServerEnvironmentStatus(reqProto = 'http', reqHost = 'localhost:8000') {
  const graphApiVersion = String(process.env.META_GRAPH_API_VERSION || 'v21.0').trim();
  const appId = String(process.env.META_APP_ID || '').trim();
  const appSecret = String(process.env.META_APP_SECRET || '').trim();
  const configId = String(process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '').trim();
  const verifyToken = String(process.env.META_WEBHOOK_VERIFY_TOKEN || '').trim();
  const webhookPublicUrl = String(process.env.META_WEBHOOK_PUBLIC_URL || '').trim();
  const encKey = String(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY || '').trim();

  const isHttps = webhookPublicUrl.startsWith('https://') || String(reqProto).toLowerCase() === 'https';

  const checks = [
    {
      key: 'META_APP_ID',
      label: 'Meta App ID (Tech Provider)',
      description: 'Identificador público de tu App de Meta con producto WhatsApp habilitado.',
      configured: Boolean(appId)
    },
    {
      key: 'META_APP_SECRET',
      label: 'Meta App Secret (Intercambio OAuth & Firma Webhooks)',
      description: 'Secreto de aplicación de Meta para intercambiar códigos Embedded Signup y validar X-Hub-Signature-256.',
      configured: Boolean(appSecret)
    },
    {
      key: 'META_EMBEDDED_SIGNUP_CONFIG_ID',
      label: 'Configuration ID de Embedded Signup v4',
      description: 'ID de configuración de WhatsApp Business Embedded Signup v4 generado en Meta App Dashboard.',
      configured: Boolean(configId)
    },
    {
      key: 'META_WEBHOOK_VERIFY_TOKEN',
      label: 'Token de Verificación de Webhook',
      description: 'Token secreto configurado en el panel de Webhooks de Meta para el handshake GET.',
      configured: Boolean(verifyToken)
    },
    {
      key: 'META_WEBHOOK_PUBLIC_URL',
      label: 'URL Pública del Webhook (/api/webhooks/whatsapp)',
      description: 'URL accesible desde Meta para entregar mensajes, estados y eventos de llamada.',
      configured: Boolean(webhookPublicUrl)
    },
    {
      key: 'WHATSAPP_TOKEN_ENCRYPTION_KEY',
      label: 'Clave de Cifrado AES-256-GCM en Backend',
      description: 'Clave privada del servidor para cifrar tokens por tienda en reposo (nunca expuesta al navegador).',
      configured: encKey.length >= 16
    },
    {
      key: 'HTTPS_DOMAIN',
      label: 'Dominio con HTTPS Activo',
      description: `Embedded Signup v4 y webhooks de Meta exigen HTTPS. Origen actual: ${reqProto}://${reqHost}`,
      configured: isHttps
    }
  ];

  const missingConfig = checks.filter(c => !c.configured);
  const ready = missingConfig.length === 0;

  return {
    ready,
    checks,
    missingConfig,
    publicClientConfig: {
      appId: appId || null,
      configId: configId || null,
      graphApiVersion,
      webhookPublicUrl: webhookPublicUrl || null,
      webhookPath: '/api/webhooks/whatsapp',
      isHttps
    }
  };
}

function getDerivedAesKey() {
  const secret = String(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY || '').trim();
  if (secret.length < 16) {
    throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY no configurada en las variables seguras del backend (mínimo 16 caracteres).');
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function encryptCredential(plainText) {
  const key = getDerivedAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
    data: encrypted.toString('hex')
  });
}

function decryptCredential(cipherPayload) {
  if (!cipherPayload) return null;
  const parsed = typeof cipherPayload === 'string' ? JSON.parse(cipherPayload) : cipherPayload;
  const key = getDerivedAesKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(parsed.data, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}

function verifyMetaWebhookSignature(rawBuffer, signatureHeader) {
  const secret = String(process.env.META_APP_SECRET || '').trim();
  if (!secret) {
    return { ok: false, reason: 'META_APP_SECRET no configurado en el servidor.' };
  }
  const sig = String(signatureHeader || '').trim();
  if (!sig.startsWith('sha256=')) {
    return { ok: false, reason: 'Cabecera X-Hub-Signature-256 ausente o sin prefijo sha256=.' };
  }
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBuffer).digest('hex');
  const bufA = Buffer.from(sig, 'utf8');
  const bufB = Buffer.from(expected, 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return { ok: false, reason: 'Firma HMAC-SHA256 inválida.' };
  }
  return { ok: true };
}

function addWhatsAppLog(tenantId, direction, eventType, status, summary, errorDetail = '') {
  const id = 'walog_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO whatsapp_webhook_logs (id, tenant_id, direction, event_type, status, summary, error_detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, tenantId || null, direction, eventType, status, summary, errorDetail, now);
  return db.prepare('SELECT * FROM whatsapp_webhook_logs WHERE id = ?').get(id);
}

function ensureWhatsAppIntegrationRow(tenantId) {
  const row = db.prepare('SELECT * FROM whatsapp_integrations WHERE tenant_id = ?').get(tenantId);
  if (row) return row;

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO whatsapp_integrations (tenant_id, status, status_reason, updated_at)
    VALUES (?, 'no_conectado', 'Pendiente de vinculación mediante Meta Embedded Signup v4.', ?)
  `).run(tenantId, now);

  return db.prepare('SELECT * FROM whatsapp_integrations WHERE tenant_id = ?').get(tenantId);
}

function formatWhatsAppIntegrationSafe(row) {
  if (!row) return null;
  const { encrypted_access_token, ...safeFields } = row;
  return {
    ...safeFields,
    calling_eligible: Boolean(row.calling_eligible),
    missed_call_enabled: Boolean(row.missed_call_enabled),
    hasEncryptedCredentials: Boolean(encrypted_access_token)
  };
}

function getWhatsAppIntegrationState(tenantId, reqProto = 'http', reqHost = 'localhost:8000') {
  const row = ensureWhatsAppIntegrationRow(tenantId);
  const env = getMetaServerEnvironmentStatus(reqProto, reqHost);
  const logs = db.prepare(`
    SELECT * FROM whatsapp_webhook_logs
    WHERE tenant_id = ? OR tenant_id IS NULL
    ORDER BY created_at DESC LIMIT 25
  `).all(tenantId);
  const calls = db.prepare(`
    SELECT * FROM whatsapp_calls WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 25
  `).all(tenantId);

  return {
    integration: formatWhatsAppIntegrationSafe(row),
    environment: env,
    logs,
    calls
  };
}

function findWhatsAppIntegrationRawByTenant(tenantId) {
  const row = ensureWhatsAppIntegrationRow(tenantId);
  let accessToken = null;
  if (row.encrypted_access_token) {
    try {
      accessToken = decryptCredential(row.encrypted_access_token);
    } catch (e) {
      accessToken = null;
    }
  }
  return { row, accessToken };
}

function setWhatsAppIntegrationStatus(tenantId, status, statusReason = '', extra = {}) {
  const allowed = new Set(['no_conectado', 'conectando', 'conectado', 'requiere_atencion', 'desconectado']);
  const safeStatus = allowed.has(status) ? status : 'requiere_atencion';
  const row = ensureWhatsAppIntegrationRow(tenantId);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE whatsapp_integrations
    SET status = ?, status_reason = ?, last_tested_at = COALESCE(?, last_tested_at), updated_at = ?
    WHERE tenant_id = ?
  `).run(safeStatus, statusReason, extra.lastTestedAt || null, now, tenantId);

  return formatWhatsAppIntegrationSafe(db.prepare('SELECT * FROM whatsapp_integrations WHERE tenant_id = ?').get(tenantId));
}

function saveWhatsAppIntegrationCredentials(tenantId, data) {
  ensureWhatsAppIntegrationRow(tenantId);
  const now = new Date().toISOString();
  const encryptedToken = encryptCredential(data.accessToken);

  db.prepare(`
    UPDATE whatsapp_integrations
    SET
      status = 'conectado',
      status_reason = ?,
      business_name = ?,
      display_phone_number = ?,
      waba_id = ?,
      phone_number_id = ?,
      encrypted_access_token = ?,
      token_expires_at = ?,
      calling_eligible = ?,
      calling_ineligible_reason = ?,
      missed_call_enabled = CASE WHEN ? = 1 THEN missed_call_enabled ELSE 0 END,
      last_tested_at = ?,
      updated_at = ?
    WHERE tenant_id = ?
  `).run(
    data.statusReason || 'Cuenta conectada y cifrada vía Meta Embedded Signup v4.',
    String(data.businessName || '').trim(),
    String(data.displayPhoneNumber || '').trim(),
    String(data.wabaId || '').trim(),
    String(data.phoneNumberId || '').trim(),
    encryptedToken,
    data.tokenExpiresAt || null,
    data.callingEligible ? 1 : 0,
    data.callingIneligibleReason || 'WhatsApp Business Calling API requiere habilitación explícita de Call Settings en Meta para este número.',
    data.callingEligible ? 1 : 0,
    now,
    now,
    tenantId
  );

  return formatWhatsAppIntegrationSafe(db.prepare('SELECT * FROM whatsapp_integrations WHERE tenant_id = ?').get(tenantId));
}

function disconnectWhatsAppIntegration(tenantId) {
  ensureWhatsAppIntegrationRow(tenantId);
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE whatsapp_integrations
    SET
      status = 'desconectado',
      status_reason = 'Desconectado por el usuario de la tienda. Usa "Conectar WhatsApp" o "Reconectar" para volver a autorizar en Meta.',
      encrypted_access_token = NULL,
      missed_call_enabled = 0,
      calling_eligible = 0,
      updated_at = ?
    WHERE tenant_id = ?
  `).run(now, tenantId);

  addWhatsAppLog(tenantId, 'connection_test', 'disconnect', 'ok', 'Integración desconectada y credenciales cifradas eliminadas.');
  return formatWhatsAppIntegrationSafe(db.prepare('SELECT * FROM whatsapp_integrations WHERE tenant_id = ?').get(tenantId));
}

function updateMissedCallSettings(tenantId, settings) {
  const row = ensureWhatsAppIntegrationRow(tenantId);
  const now = new Date().toISOString();

  if (settings.missedCallEnabled && (row.status !== 'conectado' || !row.calling_eligible)) {
    throw new Error(
      row.status !== 'conectado'
        ? 'No puedes activar el seguimiento de llamadas hasta conectar la cuenta oficial de WhatsApp Business.'
        : (row.calling_ineligible_reason || 'Este número empresarial no es elegible para WhatsApp Business Calling API.')
    );
  }

  const nextEnabled = settings.missedCallEnabled ? 1 : 0;
  const replyMode = ['auto_window_or_template', 'session_text', 'template'].includes(settings.replyMode)
    ? settings.replyMode
    : row.missed_call_reply_mode;
  const messageText = String(settings.messageText ?? row.missed_call_message_text).trim();
  const templateName = String(settings.templateName ?? row.missed_call_template_name).trim() || 'easygrow_missed_call_followup';
  const templateLang = String(settings.templateLang ?? row.missed_call_template_lang).trim() || 'es';

  db.prepare(`
    UPDATE whatsapp_integrations
    SET missed_call_enabled = ?, missed_call_reply_mode = ?, missed_call_message_text = ?, missed_call_template_name = ?, missed_call_template_lang = ?, updated_at = ?
    WHERE tenant_id = ?
  `).run(nextEnabled, replyMode, messageText, templateName, templateLang, now, tenantId);

  return formatWhatsAppIntegrationSafe(db.prepare('SELECT * FROM whatsapp_integrations WHERE tenant_id = ?').get(tenantId));
}

function classifyIncomingIntentAndDraft(text) {
  const lower = normalizeTextForMatch(text);
  if (/(precio|comprar|quiero|cotiz|contraentrega|pedido|pagar|orden|mayorista)/.test(lower)) {
    return {
      classification: 'Alta Intención de Compra',
      score: 0.96,
      suggestedReply: '¡Hola! Claro que sí, tenemos disponibilidad inmediata y pago contraentrega según tu ciudad. ¿Te comparto el valor total con envío o cuántas unidades necesitas?'
    };
  }
  if (/(stock|disponible|envio|tarda|bogota|medellin|cali|cobertura|bodega)/.test(lower)) {
    return {
      classification: 'Consulta de Stock / Logística',
      score: 0.93,
      suggestedReply: '¡Hola! Confirmamos disponibilidad activa en bodega. El tiempo estimado es de 24 a 72 horas según tu ciudad. ¿A qué ciudad y dirección sería el envío?'
    };
  }
  if (/(demora|garantia|cambio|problema|queja|soporte|no llego|cancelar)/.test(lower)) {
    return {
      classification: 'Soporte Prioritario / Garantía',
      score: 0.91,
      suggestedReply: 'Lamentamos el inconveniente. Vamos a revisar tu número de guía de inmediato para darte solución prioritaria. ¿Nos confirmas tu número de pedido o cédula?'
    };
  }
  if (/(cita|agenda|reunion|llamada|horario|mañana|tarde)/.test(lower)) {
    return {
      classification: 'Solicitud de Cita / Llamada',
      score: 0.89,
      suggestedReply: '¡Con gusto! Podemos agendar una breve llamada o asesoría en nuestro calendario. ¿Qué día y hora te queda mejor?'
    };
  }
  return {
    classification: 'Consulta General',
    score: 0.74,
    suggestedReply: '¡Hola! Gracias por escribirnos. Ya recibimos tu mensaje; ¿en qué producto o requerimiento específico te podemos ayudar hoy?'
  };
}

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function addInboxMessage(tenantId, msgData) {
  const id = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  const now = msgData.createdAt || new Date().toISOString();
  const channel = ['whatsapp', 'instagram', 'facebook'].includes(msgData.channel) ? msgData.channel : 'whatsapp';
  const direction = ['incoming', 'outgoing', 'system_call'].includes(msgData.direction) ? msgData.direction : 'incoming';

  let intentLabel = msgData.intentLabel || '';
  let intentScore = Number(msgData.intentScore) || 0;
  let aiSuggestedReply = msgData.aiSuggestedReply || '';
  let aiApprovalStatus = msgData.aiApprovalStatus || 'none';

  if (direction === 'incoming' && !aiSuggestedReply) {
    const cls = classifyIncomingIntentAndDraft(msgData.body);
    intentLabel = cls.classification;
    intentScore = cls.score;
    aiSuggestedReply = cls.suggestedReply;
    aiApprovalStatus = 'pending_human_approval';
  }

  db.prepare(`
    INSERT INTO inbox_messages (
      id, tenant_id, contact_id, channel, direction, sender_name, body,
      meta_message_id, delivery_status, intent_label, intent_score,
      ai_suggested_reply, ai_approval_status, approved_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    msgData.contactId,
    channel,
    direction,
    msgData.senderName || 'Cliente',
    String(msgData.body || ''),
    String(msgData.metaMessageId || ''),
    msgData.deliveryStatus || (direction === 'incoming' ? 'received' : 'queued'),
    intentLabel,
    intentScore,
    aiSuggestedReply,
    aiApprovalStatus,
    msgData.approvedBy || '',
    now
  );

  return db.prepare('SELECT * FROM inbox_messages WHERE id = ?').get(id);
}

function approveAISuggestion(tenantId, msgId, editedReply, approverName = 'Asesor Humano', deliveryInfo = {}) {
  const row = db.prepare('SELECT * FROM inbox_messages WHERE id = ? AND tenant_id = ?').get(msgId, tenantId);
  if (!row) return null;

  const finalBody = String(editedReply || row.ai_suggested_reply || '').trim();
  if (!finalBody) throw new Error('El texto de la respuesta aprobada no puede estar vacío.');

  db.prepare(`
    UPDATE inbox_messages
    SET ai_approval_status = 'approved_and_sent', ai_suggested_reply = ?, approved_by = ?
    WHERE id = ? AND tenant_id = ?
  `).run(finalBody, approverName, msgId, tenantId);

  const outgoing = addInboxMessage(tenantId, {
    contactId: row.contact_id,
    channel: row.channel,
    direction: 'outgoing',
    senderName: `${approverName} (Aprobado desde Orbe IA)`,
    body: finalBody,
    metaMessageId: deliveryInfo.metaMessageId || '',
    deliveryStatus: deliveryInfo.deliveryStatus || 'sent',
    aiApprovalStatus: 'none',
    approvedBy: approverName
  });

  return {
    sourceMessage: db.prepare('SELECT * FROM inbox_messages WHERE id = ?').get(msgId),
    outgoingMessage: outgoing
  };
}

function discardAISuggestion(tenantId, msgId) {
  const res = db.prepare(`
    UPDATE inbox_messages
    SET ai_approval_status = 'discarded'
    WHERE id = ? AND tenant_id = ?
  `).run(msgId, tenantId);
  return res.changes > 0;
}

function hasRecentInboundWindow24h(tenantId, contactId) {
  if (!contactId) return false;
  const latest = db.prepare(`
    SELECT created_at FROM inbox_messages
    WHERE tenant_id = ? AND contact_id = ? AND direction = 'incoming' AND channel = 'whatsapp'
    ORDER BY created_at DESC LIMIT 1
  `).get(tenantId, contactId);
  if (!latest) return false;
  const ageMs = Date.now() - new Date(latest.created_at).getTime();
  return ageMs <= 24 * 3600 * 1000;
}

function processWhatsAppWebhookPayload(payload) {
  const results = { processedMessages: 0, processedStatuses: 0, processedCalls: 0, duplicatesSkipped: 0, rejectedTenants: 0 };
  const entries = Array.isArray(payload && payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change.value || {};
      const metadata = value.metadata || {};
      const phoneNumberId = String(metadata.phone_number_id || '').trim();

      const integration = phoneNumberId
        ? db.prepare('SELECT * FROM whatsapp_integrations WHERE phone_number_id = ?').get(phoneNumberId)
        : null;

      if (!integration) {
        results.rejectedTenants++;
        addWhatsAppLog(
          null,
          'inbound_webhook',
          change.field || 'unknown',
          'rejected',
          `Evento ignorado: phone_number_id "${phoneNumberId || 'vacío'}" no pertenece a ninguna tienda conectada.`,
          'Multitenancy strict check'
        );
        continue;
      }

      const tenantId = integration.tenant_id;
      const nowIso = new Date().toISOString();

      // Helper to resolve or create tenant contact by phone
      const resolveContact = (phoneStr, profileName) => {
        const cleanDigits = normalizePhoneDigits(phoneStr);
        const allContacts = getContactsByTenant(tenantId);
        let match = allContacts.find(c => {
          const cd = normalizePhoneDigits(c.phone);
          return cd && cleanDigits && (cd === cleanDigits || cd.endsWith(cleanDigits.slice(-10)));
        });
        if (!match) {
          const created = createContact(tenantId, {
            name: profileName || `WhatsApp ${phoneStr}`,
            contactPerson: profileName || phoneStr,
            phone: phoneStr,
            stage: 'prospects',
            value: 0,
            cost: 0,
            tags: ['WhatsApp-API'],
            attribution: 'WhatsApp Business Platform Webhook'
          });
          match = db.prepare('SELECT * FROM contacts WHERE id = ?').get(created.id);
        }
        return match;
      };

      const contactsProfileMap = {};
      (Array.isArray(value.contacts) ? value.contacts : []).forEach(c => {
        if (c.wa_id) contactsProfileMap[c.wa_id] = (c.profile && c.profile.name) || c.wa_id;
      });

      // 1. Incoming WhatsApp Messages (Idempotent)
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const msg of messages) {
        const eventKey = `msg:${tenantId}:${msg.id}`;
        const insertedEvent = db.prepare(`
          INSERT OR IGNORE INTO whatsapp_webhook_events (event_key, tenant_id, event_type, processed_at)
          VALUES (?, ?, 'message', ?)
        `).run(eventKey, tenantId, nowIso);

        if (insertedEvent.changes === 0) {
          results.duplicatesSkipped++;
          continue;
        }

        const fromPhone = String(msg.from || '');
        const senderName = contactsProfileMap[fromPhone] || `Cliente ${fromPhone}`;
        const contact = resolveContact(fromPhone, senderName);
        const textBody = (msg.text && msg.text.body)
          || (msg.button && msg.button.text)
          || `[Mensaje tipo ${msg.type || 'desconocido'}]`;

        addInboxMessage(tenantId, {
          contactId: contact.id,
          channel: 'whatsapp',
          direction: 'incoming',
          senderName,
          body: textBody,
          metaMessageId: msg.id || '',
          deliveryStatus: 'received'
        });

        addWhatsAppLog(tenantId, 'inbound_webhook', 'message', 'ok', `Mensaje recibido de ${senderName} (${fromPhone}) con clasificación Orbe IA pendiente de aprobación humana.`);
        results.processedMessages++;
      }

      // 2. Delivery / Read / Failed Statuses (Idempotent)
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const st of statuses) {
        const eventKey = `st:${tenantId}:${st.id}:${st.status}:${st.timestamp || ''}`;
        const insertedEvent = db.prepare(`
          INSERT OR IGNORE INTO whatsapp_webhook_events (event_key, tenant_id, event_type, processed_at)
          VALUES (?, ?, 'status', ?)
        `).run(eventKey, tenantId, nowIso);

        if (insertedEvent.changes === 0) {
          results.duplicatesSkipped++;
          continue;
        }

        const stVal = String(st.status || 'sent').toLowerCase();
        db.prepare(`
          UPDATE inbox_messages SET delivery_status = ?
          WHERE tenant_id = ? AND meta_message_id = ?
        `).run(stVal, tenantId, st.id || '');

        if (stVal === 'failed') {
          const errs = Array.isArray(st.errors) ? st.errors : [];
          const errStr = errs.map(e => `${e.code}: ${e.title || e.message}`).join(' | ') || 'Error reportado por Meta';
          addWhatsAppLog(tenantId, 'inbound_webhook', 'status_failed', 'failed', `Fallo de entrega para mensaje ${st.id}`, errStr);
          if (errs.some(e => Number(e.code) === 190 || Number(e.code) === 10)) {
            setWhatsAppIntegrationStatus(
              tenantId,
              'requiere_atencion',
              `Meta reportó token revocado o permiso insuficiente (${errStr}). Haz clic en "Reconectar" para renovar la autorización.`
            );
          }
        } else {
          addWhatsAppLog(tenantId, 'inbound_webhook', 'status', stVal, `Estado de mensaje ${st.id}: ${stVal}.`);
        }
        results.processedStatuses++;
      }

      // 3. WhatsApp Business Calling Events — Missed Call (No Duplicates per call_id)
      const calls = Array.isArray(value.calls) ? value.calls : [];
      for (const call of calls) {
        const callId = String(call.id || call.call_id || '');
        if (!callId) continue;

        const callStatus = String(call.status || call.event || 'MISSED').toUpperCase();
        const eventKey = `call:${tenantId}:${callId}:${callStatus}`;
        const insertedEvent = db.prepare(`
          INSERT OR IGNORE INTO whatsapp_webhook_events (event_key, tenant_id, event_type, processed_at)
          VALUES (?, ?, 'call', ?)
        `).run(eventKey, tenantId, nowIso);

        if (insertedEvent.changes === 0) {
          results.duplicatesSkipped++;
          continue;
        }

        const fromPhone = String(call.from || '');
        const customerName = contactsProfileMap[fromPhone] || call.caller_name || `Llamada ${fromPhone}`;
        const contact = resolveContact(fromPhone, customerName);

        const existingCall = db.prepare('SELECT * FROM whatsapp_calls WHERE call_id = ? AND tenant_id = ?').get(callId, tenantId);
        const isMissed = ['MISSED', 'NO_ANSWER', 'REJECTED', 'UNANSWERED'].includes(callStatus);

        if (existingCall && existingCall.auto_reply_sent === 1) {
          addWhatsAppLog(tenantId, 'inbound_webhook', 'call_duplicate_blocked', 'ok', `Llamada ${callId} ya generó 1 mensaje automático; duplicado bloqueado.`);
          results.duplicatesSkipped++;
          continue;
        }

        // Registrar llamada en la conversación del cliente
        addInboxMessage(tenantId, {
          contactId: contact.id,
          channel: 'whatsapp',
          direction: 'system_call',
          senderName: 'WhatsApp Business Calling',
          body: `📞 Llamada por WhatsApp (${callStatus}) de ${customerName} (${fromPhone}) • ID: ${callId}`,
          deliveryStatus: callStatus.toLowerCase(),
          aiApprovalStatus: 'none'
        });

        let autoReplySent = 0;
        let autoReplyStatus = 'not_triggered';
        let autoReplyPreview = '';

        if (isMissed) {
          if (integration.status !== 'conectado' || !integration.calling_eligible) {
            autoReplyStatus = 'skipped_ineligible';
            addWhatsAppLog(
              tenantId,
              'inbound_webhook',
              'call_missed',
              'ok',
              `Llamada perdida ${callId} registrada sin envío automático: ${integration.calling_ineligible_reason}`
            );
          } else if (!integration.missed_call_enabled) {
            autoReplyStatus = 'skipped_disabled';
            addWhatsAppLog(tenantId, 'inbound_webhook', 'call_missed', 'ok', `Llamada perdida ${callId} registrada; respuesta automática desactivada por la tienda.`);
          } else {
            const within24h = hasRecentInboundWindow24h(tenantId, contact.id);
            const useTemplate = integration.missed_call_reply_mode === 'template' || (!within24h && integration.missed_call_reply_mode !== 'session_text');
            autoReplySent = 1;
            autoReplyStatus = useTemplate ? 'sent_template_meta' : 'sent_session_24h';
            autoReplyPreview = useTemplate
              ? `[Plantilla Meta: ${integration.missed_call_template_name} (${integration.missed_call_template_lang})] ${integration.missed_call_message_text}`
              : integration.missed_call_message_text;

            addInboxMessage(tenantId, {
              contactId: contact.id,
              channel: 'whatsapp',
              direction: 'outgoing',
              senderName: 'Rescate Automático Llamada Perdida WA',
              body: autoReplyPreview,
              deliveryStatus: 'queued',
              aiApprovalStatus: 'none'
            });

            addWhatsAppLog(
              tenantId,
              'outbound_api',
              'missed_call_auto_reply',
              'ok',
              `Mensaje único automático (${autoReplyStatus}) generado para llamada perdida ${callId} hacia ${fromPhone}.`
            );
          }
        }

        if (!existingCall) {
          db.prepare(`
            INSERT INTO whatsapp_calls (
              call_id, tenant_id, contact_id, from_phone, customer_name, call_status,
              auto_reply_sent, auto_reply_status, auto_reply_preview, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(callId, tenantId, contact.id, fromPhone, customerName, callStatus, autoReplySent, autoReplyStatus, autoReplyPreview, nowIso);
        } else {
          db.prepare(`
            UPDATE whatsapp_calls
            SET call_status = ?, auto_reply_sent = ?, auto_reply_status = ?, auto_reply_preview = ?
            WHERE call_id = ? AND tenant_id = ?
          `).run(callStatus, autoReplySent, autoReplyStatus, autoReplyPreview, callId, tenantId);
        }

        results.processedCalls++;
      }
    }
  }

  return results;
}

function getCalendarAppointments(tenantId) {
  return db.prepare(`
    SELECT * FROM calendar_appointments
    WHERE tenant_id = ?
    ORDER BY scheduled_date ASC, scheduled_time ASC
  `).all(tenantId);
}

function createCalendarAppointment(tenantId, data) {
  const id = 'appt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO calendar_appointments (id, tenant_id, contact_id, contact_name, title, scheduled_date, scheduled_time, channel, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    data.contactId || null,
    String(data.contactName || 'Seguimiento General').trim(),
    String(data.title || 'Seguimiento Comercial').trim(),
    String(data.scheduledDate || now.slice(0, 10)).trim(),
    String(data.scheduledTime || '10:00').trim(),
    String(data.channel || 'WhatsApp').trim(),
    String(data.notes || '').trim(),
    now
  );
  return db.prepare('SELECT * FROM calendar_appointments WHERE id = ?').get(id);
}

function deleteCalendarAppointment(tenantId, apptId) {
  const res = db.prepare('DELETE FROM calendar_appointments WHERE id = ? AND tenant_id = ?').run(apptId, tenantId);
  return res.changes > 0;
}

function getInboxWorkspace(tenantId, reqProto = 'http', reqHost = 'localhost:8000') {
  const waState = getWhatsAppIntegrationState(tenantId, reqProto, reqHost);
  const contacts = getContactsByTenant(tenantId);
  const messages = db.prepare(`
    SELECT * FROM inbox_messages
    WHERE tenant_id = ?
    ORDER BY created_at ASC
  `).all(tenantId);
  const calendarAppointments = getCalendarAppointments(tenantId);

  const messagesByContact = {};
  messages.forEach(m => {
    if (!messagesByContact[m.contact_id]) messagesByContact[m.contact_id] = [];
    messagesByContact[m.contact_id].push(m);
  });

  return {
    integration: waState.integration,
    environment: waState.environment,
    contacts,
    messagesByContact,
    calendarAppointments,
    calls: waState.calls
  };
}

// =====================================================================
// Estación 05 — Marketing & Analítica (Parrilla IG/FB/TikTok, Campañas Ads,
// Permisos Individuales, Atribución Checkout y SEO Search Console)
// =====================================================================

function getMarketingProvidersEnvironmentStatus(reqProto = 'http', reqHost = 'localhost:8000') {
  const encKeyOk = String(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY || '').trim().length >= 16;
  const isHttps = String(process.env.MARKETING_OAUTH_REDIRECT_BASE || '').startsWith('https://') || String(reqProto).toLowerCase() === 'https';

  const defs = {
    instagram: {
      provider: 'instagram',
      label: 'Instagram Business',
      category: 'social',
      scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
      vars: [
        { key: 'META_SOCIAL_APP_ID', ok: Boolean(String(process.env.META_SOCIAL_APP_ID || process.env.META_APP_ID || '').trim()) },
        { key: 'META_SOCIAL_APP_SECRET', ok: Boolean(String(process.env.META_SOCIAL_APP_SECRET || process.env.META_APP_SECRET || '').trim()) },
        { key: 'TOKEN_ENCRYPTION_KEY', ok: encKeyOk },
        { key: 'HTTPS_OAUTH_DOMAIN', ok: isHttps }
      ]
    },
    facebook: {
      provider: 'facebook',
      label: 'Facebook Pages',
      category: 'social',
      scopes: ['pages_manage_posts', 'pages_read_engagement'],
      vars: [
        { key: 'META_SOCIAL_APP_ID', ok: Boolean(String(process.env.META_SOCIAL_APP_ID || process.env.META_APP_ID || '').trim()) },
        { key: 'META_SOCIAL_APP_SECRET', ok: Boolean(String(process.env.META_SOCIAL_APP_SECRET || process.env.META_APP_SECRET || '').trim()) },
        { key: 'TOKEN_ENCRYPTION_KEY', ok: encKeyOk },
        { key: 'HTTPS_OAUTH_DOMAIN', ok: isHttps }
      ]
    },
    tiktok: {
      provider: 'tiktok',
      label: 'TikTok Content Posting API',
      category: 'social',
      scopes: ['video.publish', 'video.upload', 'user.info.basic'],
      vars: [
        { key: 'TIKTOK_CLIENT_KEY', ok: Boolean(String(process.env.TIKTOK_CLIENT_KEY || '').trim()) },
        { key: 'TIKTOK_CLIENT_SECRET', ok: Boolean(String(process.env.TIKTOK_CLIENT_SECRET || '').trim()) },
        { key: 'TOKEN_ENCRYPTION_KEY', ok: encKeyOk },
        { key: 'HTTPS_OAUTH_DOMAIN', ok: isHttps }
      ]
    },
    meta_ads: {
      provider: 'meta_ads',
      label: 'Meta Ads (Marketing API)',
      category: 'ads',
      scopes: ['ads_management', 'ads_read'],
      vars: [
        { key: 'META_ADS_APP_ID', ok: Boolean(String(process.env.META_ADS_APP_ID || process.env.META_APP_ID || '').trim()) },
        { key: 'META_ADS_APP_SECRET', ok: Boolean(String(process.env.META_ADS_APP_SECRET || process.env.META_APP_SECRET || '').trim()) },
        { key: 'TOKEN_ENCRYPTION_KEY', ok: encKeyOk },
        { key: 'HTTPS_OAUTH_DOMAIN', ok: isHttps }
      ]
    },
    google_ads: {
      provider: 'google_ads',
      label: 'Google Ads API',
      category: 'ads',
      scopes: ['https://www.googleapis.com/auth/adwords'],
      vars: [
        { key: 'GOOGLE_ADS_CLIENT_ID', ok: Boolean(String(process.env.GOOGLE_ADS_CLIENT_ID || '').trim()) },
        { key: 'GOOGLE_ADS_CLIENT_SECRET', ok: Boolean(String(process.env.GOOGLE_ADS_CLIENT_SECRET || '').trim()) },
        { key: 'GOOGLE_ADS_DEVELOPER_TOKEN', ok: Boolean(String(process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '').trim()) },
        { key: 'TOKEN_ENCRYPTION_KEY', ok: encKeyOk }
      ]
    },
    search_console: {
      provider: 'search_console',
      label: 'Google Search Console (Solo Lectura)',
      category: 'seo',
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      vars: [
        { key: 'GOOGLE_SEARCH_CONSOLE_CLIENT_ID', ok: Boolean(String(process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID || '').trim()) },
        { key: 'GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET', ok: Boolean(String(process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET || '').trim()) },
        { key: 'TOKEN_ENCRYPTION_KEY', ok: encKeyOk }
      ]
    }
  };

  const result = {};
  Object.keys(defs).forEach(k => {
    const d = defs[k];
    const missingRequirements = d.vars.filter(v => !v.ok).map(v => v.key);
    result[k] = {
      provider: d.provider,
      label: d.label,
      category: d.category,
      scopes: d.scopes,
      ready: missingRequirements.length === 0,
      missingRequirements,
      originContext: `${reqProto}://${reqHost}`
    };
  });
  return result;
}

function ensureStation5Defaults(tenantId, userObj = null) {
  const now = new Date().toISOString();
  const settings = db.prepare('SELECT * FROM tenant_marketing_settings WHERE tenant_id = ?').get(tenantId);
  if (!settings) {
    db.prepare(`
      INSERT INTO tenant_marketing_settings (tenant_id, timezone, attribution_window_days, reporting_period, updated_at)
      VALUES (?, 'America/Bogota', 30, '30d', ?)
    `).run(tenantId, now);
  }

  const providersMeta = [
    { provider: 'instagram', category: 'social' },
    { provider: 'facebook', category: 'social' },
    { provider: 'tiktok', category: 'social' },
    { provider: 'meta_ads', category: 'ads' },
    { provider: 'google_ads', category: 'ads' },
    { provider: 'search_console', category: 'seo' }
  ];
  const insertInt = db.prepare(`
    INSERT OR IGNORE INTO marketing_integrations (
      id, tenant_id, provider, category, status, status_reason, updated_at
    ) VALUES (?, ?, ?, ?, 'no_conectado', 'Pendiente de autorización oficial OAuth por la tienda.', ?)
  `);
  providersMeta.forEach(pm => {
    insertInt.run(`mint_${tenantId}_${pm.provider}`, tenantId, pm.provider, pm.category, now);
  });

  const collabCount = db.prepare('SELECT COUNT(*) AS cnt FROM marketing_collaborator_permissions WHERE tenant_id = ?').get(tenantId).cnt;
  if (collabCount === 0 && userObj && userObj.email) {
    db.prepare(`
      INSERT OR IGNORE INTO marketing_collaborator_permissions (
        id, tenant_id, collaborator_name, collaborator_email, role_preset,
        can_connect_accounts, can_view_metrics, can_pause_resume, can_modify_budget,
        updated_by, updated_at
      ) VALUES (?, ?, ?, ?, 'Propietario Tienda', 1, 1, 1, 1, ?, ?)
    `).run(
      `mperm_${tenantId}_owner`,
      tenantId,
      userObj.name || 'Usuario Principal',
      userObj.email,
      userObj.name || userObj.email,
      now
    );
  }
}

function formatMarketingIntegrationSafe(row, envInfo) {
  const { encrypted_credentials, ...safe } = row;
  return {
    ...safe,
    hasEncryptedCredentials: Boolean(encrypted_credentials),
    env: envInfo || null
  };
}

function logMarketingAudit(tenantId, actor, entry) {
  const id = 'mlog_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO campaign_action_logs (
      id, tenant_id, actor_name, actor_email, store_name, account_name,
      campaign_id, campaign_name, action_type, previous_value, new_value,
      result_status, result_message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tenantId,
    (actor && actor.name) || 'Usuario',
    (actor && actor.email) || '',
    (actor && actor.companyName) || 'Tienda EasyGrow',
    entry.accountName || '',
    entry.campaignId || '',
    entry.campaignName || '',
    entry.actionType || 'SYSTEM',
    String(entry.previousValue ?? ''),
    String(entry.newValue ?? ''),
    entry.resultStatus || 'RECORDED',
    entry.resultMessage || '',
    now
  );
  return db.prepare('SELECT * FROM campaign_action_logs WHERE id = ?').get(id);
}

function getActiveCollaboratorRecord(tenantId, userObj, actorEmail = null) {
  ensureStation5Defaults(tenantId, userObj);
  const targetEmail = String(actorEmail || (userObj && userObj.email) || '').trim().toLowerCase();
  const collabs = db.prepare('SELECT * FROM marketing_collaborator_permissions WHERE tenant_id = ? ORDER BY updated_at ASC, id ASC').all(tenantId);
  let active = collabs.find(c => String(c.collaborator_email).toLowerCase() === targetEmail);
  if (!active && collabs.length > 0) active = collabs[0];
  if (!active) {
    return {
      collaborator_name: (userObj && userObj.name) || 'Usuario',
      collaborator_email: (userObj && userObj.email) || '',
      role_preset: 'Sin asignar',
      can_connect_accounts: 0,
      can_view_metrics: 0,
      can_pause_resume: 0,
      can_modify_budget: 0
    };
  }
  return active;
}

function getTenantMarketingSettings(tenantId) {
  ensureStation5Defaults(tenantId);
  return db.prepare('SELECT * FROM tenant_marketing_settings WHERE tenant_id = ?').get(tenantId);
}

function updateTenantMarketingSettings(tenantId, updates) {
  ensureStation5Defaults(tenantId);
  const curr = getTenantMarketingSettings(tenantId);
  const now = new Date().toISOString();
  const timezone = String(updates.timezone || curr.timezone || 'America/Bogota').trim();
  const attributionWindowDays = Math.max(1, Math.min(90, Number(updates.attributionWindowDays ?? curr.attribution_window_days) || 30));
  const reportingPeriod = ['7d', '30d', '90d', 'all'].includes(updates.reportingPeriod)
    ? updates.reportingPeriod
    : (curr.reporting_period || '30d');

  db.prepare(`
    UPDATE tenant_marketing_settings
    SET timezone = ?, attribution_window_days = ?, reporting_period = ?, updated_at = ?
    WHERE tenant_id = ?
  `).run(timezone, attributionWindowDays, reportingPeriod, now, tenantId);

  return getTenantMarketingSettings(tenantId);
}

function updateCollaboratorPermissions(tenantId, actorUser, data) {
  ensureStation5Defaults(tenantId, actorUser);
  if (!data.confirmed) {
    throw new Error('Debes confirmar quién recibirá los permisos y a qué tienda afecta antes de aplicar el cambio.');
  }
  const email = String(data.collaboratorEmail || '').trim().toLowerCase();
  const name = String(data.collaboratorName || '').trim();
  if (!email || !name) {
    throw new Error('Nombre y correo del colaborador son obligatorios.');
  }

  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM marketing_collaborator_permissions WHERE tenant_id = ? AND LOWER(collaborator_email) = ?').get(tenantId, email);
  const rolePreset = String(data.rolePreset || 'Personalizado').trim();
  const cConnect = data.canConnectAccounts ? 1 : 0;
  const cView = data.canViewMetrics ? 1 : 0;
  const cPause = data.canPauseResume ? 1 : 0;
  const cBudget = data.canModifyBudget ? 1 : 0;
  const updatedBy = (actorUser && actorUser.name) || 'Responsable Tienda';

  if (existing) {
    db.prepare(`
      UPDATE marketing_collaborator_permissions
      SET collaborator_name = ?, role_preset = ?, can_connect_accounts = ?, can_view_metrics = ?,
          can_pause_resume = ?, can_modify_budget = ?, updated_by = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `).run(name, rolePreset, cConnect, cView, cPause, cBudget, updatedBy, now, existing.id, tenantId);
  } else {
    db.prepare(`
      INSERT INTO marketing_collaborator_permissions (
        id, tenant_id, collaborator_name, collaborator_email, role_preset,
        can_connect_accounts, can_view_metrics, can_pause_resume, can_modify_budget,
        updated_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `mperm_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      tenantId,
      name,
      email,
      rolePreset,
      cConnect,
      cView,
      cPause,
      cBudget,
      updatedBy,
      now
    );
  }

  const summaryPerms = `Conectar=${Boolean(cConnect)}, Métricas=${Boolean(cView)}, Pausar/Reanudar=${Boolean(cPause)}, Presupuesto=${Boolean(cBudget)}`;
  logMarketingAudit(tenantId, actorUser, {
    accountName: `Permisos de Tienda (${(actorUser && actorUser.companyName) || 'Tienda'})`,
    campaignName: `Colaborador: ${name} (${email})`,
    actionType: 'PERMISSION_CHANGE',
    previousValue: existing ? `Conectar=${Boolean(existing.can_connect_accounts)}, Métricas=${Boolean(existing.can_view_metrics)}, Pausar=${Boolean(existing.can_pause_resume)}, Presupuesto=${Boolean(existing.can_modify_budget)}` : 'Sin registro previo',
    newValue: summaryPerms,
    resultStatus: 'RECORDED',
    resultMessage: `Permisos confirmados y aplicados a ${name} (${email}) en tienda ${(actorUser && actorUser.companyName) || tenantId}.`
  });

  return db.prepare('SELECT * FROM marketing_collaborator_permissions WHERE tenant_id = ? ORDER BY id ASC').all(tenantId);
}

function evaluateSocialPostNetworkEligibility(tenantId, post) {
  const integrations = db.prepare('SELECT * FROM marketing_integrations WHERE tenant_id = ?').all(tenantId);
  const byProvider = {};
  integrations.forEach(i => { byProvider[i.provider] = i; });

  const networks = Array.isArray(post.networks) ? post.networks : JSON.parse(post.networks_json || '[]');
  const networkStatuses = {};
  const remindersToCreate = [];
  let hasManualReminder = false;
  let hasConnectionOrFormatError = false;
  let allConfirmedAuto = true;

  for (const net of networks) {
    const integ = byProvider[net];
    const isConnected = integ && integ.status === 'conectado' && Boolean(integ.encrypted_credentials);
    const mediaType = post.media_type || 'image';

    if ((net === 'instagram' || net === 'tiktok') && mediaType === 'none') {
      allConfirmedAuto = false;
      hasManualReminder = true;
      const reason = net === 'instagram'
        ? 'Instagram Graph API requiere una imagen o video compatible (no publica texto solo).'
        : 'TikTok Content Posting API requiere un archivo de video o carrusel multimedia (no publica texto solo).';
      const action = `Adjuntar ${net === 'instagram' ? 'imagen o video' : 'video vertical'} válido o publicar manualmente desde la app de ${net}.`;
      networkStatuses[net] = { mode: 'manual_reminder', status: 'requiere_accion', message: reason };
      remindersToCreate.push({ network: net, reason, requiredAction: action });
      continue;
    }

    if (post.requires_native_app) {
      allConfirmedAuto = false;
      hasManualReminder = true;
      const reason = `La publicación incluye elementos nativos de app (${post.media_format_notes || 'audio en tendencia, stickers o encuesta'}) no soportados por publicación automática API.`;
      const action = `Abrir ${net} a la hora programada (${post.scheduled_at} ${post.timezone}), añadir el recurso nativo y publicar manualmente.`;
      networkStatuses[net] = { mode: 'manual_reminder', status: 'requiere_accion', message: reason };
      remindersToCreate.push({ network: net, reason, requiredAction: action });
      continue;
    }

    if (!isConnected) {
      allConfirmedAuto = false;
      hasManualReminder = true;
      const reason = `Cuenta de ${net} sin conexión oficial OAuth activa en esta tienda.`;
      const action = `Conectar la cuenta de ${net} mediante OAuth oficial en "Conexiones Sociales" o publicar manualmente en ${net} el ${post.scheduled_at}.`;
      networkStatuses[net] = { mode: 'manual_reminder', status: 'requiere_accion', message: reason };
      remindersToCreate.push({ network: net, reason, requiredAction: action });
      continue;
    }

    // Conectada con formato válido, lista para disparo API al llegar la fecha/hora (o en retry)
    networkStatuses[net] = {
      mode: 'auto_api',
      status: post.actionMode === 'publish_now' ? 'enviando_api' : 'programada_auto_api',
      message: post.actionMode === 'publish_now'
        ? 'Listo para despacho oficial API.'
        : `Programada para publicación automática vía API (${post.timezone}).`
    };
  }

  return { networkStatuses, remindersToCreate, hasManualReminder, hasConnectionOrFormatError, allConfirmedAuto };
}

function createOrUpdateSocialPost(tenantId, actorUser, data) {
  ensureStation5Defaults(tenantId, actorUser);
  const settings = getTenantMarketingSettings(tenantId);
  const now = new Date().toISOString();
  const postId = data.id || ('spost_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
  const title = String(data.title || (data.contentText || '').slice(0, 48) || 'Publicación Multired').trim();
  const contentText = String(data.contentText || '').trim();
  const mediaType = ['none', 'image', 'video'].includes(data.mediaType) ? data.mediaType : 'image';
  const mediaUrl = String(data.mediaUrl || '').trim();
  const mediaFormatNotes = String(data.mediaFormatNotes || '').trim();
  const requiresNativeApp = data.requiresNativeApp ? 1 : 0;
  const networks = Array.isArray(data.networks) && data.networks.length > 0
    ? data.networks.filter(n => ['instagram', 'facebook', 'tiktok'].includes(n))
    : ['instagram', 'facebook', 'tiktok'];
  const scheduledAt = String(data.scheduledAt || `${now.slice(0, 10)} 18:00`).trim();
  const timezone = String(data.timezone || settings.timezone || 'America/Bogota').trim();
  const requestedStatus = data.actionMode === 'draft' ? 'borrador' : 'programada';

  if (!contentText) {
    throw new Error('Escribe el texto de la publicación antes de guardar o programar.');
  }

  let status = requestedStatus;
  let errorLog = '';
  let networkStatuses = {};

  // Limpiar recordatorios anteriores si se está editando
  db.prepare('DELETE FROM social_manual_reminders WHERE tenant_id = ? AND post_id = ?').run(tenantId, postId);

  if (requestedStatus === 'borrador') {
    networks.forEach(n => {
      networkStatuses[n] = { mode: 'draft', status: 'borrador', message: 'Borrador guardado; pendiente de programar.' };
    });
  } else {
    const evalRes = evaluateSocialPostNetworkEligibility(tenantId, {
      networks,
      media_type: mediaType,
      media_format_notes: mediaFormatNotes,
      requires_native_app: requiresNativeApp,
      scheduled_at: scheduledAt,
      timezone,
      actionMode: data.actionMode
    });
    networkStatuses = evalRes.networkStatuses;
    if (evalRes.remindersToCreate.length > 0) {
      status = 'requiere_accion';
      errorLog = evalRes.remindersToCreate.map(r => `[${r.network}] ${r.reason}`).join(' | ');
      const insRem = db.prepare(`
        INSERT INTO social_manual_reminders (
          id, tenant_id, post_id, network, scheduled_at, timezone, reason, required_action, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)
      `);
      evalRes.remindersToCreate.forEach((r, idx) => {
        insRem.run(`srem_${Date.now()}_${idx}`, tenantId, postId, r.network, scheduledAt, timezone, r.reason, r.requiredAction, now);
      });
    } else {
      status = 'programada';
    }
  }

  const existing = db.prepare('SELECT * FROM social_posts WHERE id = ? AND tenant_id = ?').get(postId, tenantId);
  if (existing) {
    db.prepare(`
      UPDATE social_posts
      SET title = ?, content_text = ?, media_type = ?, media_url = ?, media_format_notes = ?,
          requires_native_app = ?, networks_json = ?, scheduled_at = ?, timezone = ?, status = ?,
          network_statuses_json = ?, error_log = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `).run(
      title, contentText, mediaType, mediaUrl, mediaFormatNotes,
      requiresNativeApp, JSON.stringify(networks), scheduledAt, timezone, status,
      JSON.stringify(networkStatuses), errorLog, now, postId, tenantId
    );
  } else {
    db.prepare(`
      INSERT INTO social_posts (
        id, tenant_id, title, content_text, media_type, media_url, media_format_notes,
        requires_native_app, networks_json, scheduled_at, timezone, status,
        network_statuses_json, error_log, retry_count, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      postId, tenantId, title, contentText, mediaType, mediaUrl, mediaFormatNotes,
      requiresNativeApp, JSON.stringify(networks), scheduledAt, timezone, status,
      JSON.stringify(networkStatuses), errorLog, (actorUser && actorUser.name) || 'Usuario', now, now
    );
  }

  return formatSocialPostRow(db.prepare('SELECT * FROM social_posts WHERE id = ?').get(postId));
}

function formatSocialPostRow(r) {
  if (!r) return null;
  return {
    ...r,
    requires_native_app: Boolean(r.requires_native_app),
    networks: r.networks_json ? JSON.parse(r.networks_json) : [],
    networkStatuses: r.network_statuses_json ? JSON.parse(r.network_statuses_json) : {}
  };
}

function cancelSocialPost(tenantId, postId) {
  const row = db.prepare('SELECT * FROM social_posts WHERE id = ? AND tenant_id = ?').get(postId, tenantId);
  if (!row) return false;
  db.prepare('DELETE FROM social_manual_reminders WHERE tenant_id = ? AND post_id = ?').run(tenantId, postId);
  const res = db.prepare('DELETE FROM social_posts WHERE id = ? AND tenant_id = ?').run(postId, tenantId);
  return res.changes > 0;
}

async function retryOrPublishSocialPost(tenantId, actorUser, postId) {
  const row = db.prepare('SELECT * FROM social_posts WHERE id = ? AND tenant_id = ?').get(postId, tenantId);
  if (!row) return null;
  const now = new Date().toISOString();
  const postObj = formatSocialPostRow(row);

  const evalRes = evaluateSocialPostNetworkEligibility(tenantId, {
    ...postObj,
    actionMode: 'publish_now'
  });

  db.prepare('DELETE FROM social_manual_reminders WHERE tenant_id = ? AND post_id = ?').run(tenantId, postId);

  if (!evalRes.allConfirmedAuto) {
    const insRem = db.prepare(`
      INSERT INTO social_manual_reminders (
        id, tenant_id, post_id, network, scheduled_at, timezone, reason, required_action, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)
    `);
    evalRes.remindersToCreate.forEach((r, idx) => {
      insRem.run(`srem_${Date.now()}_${idx}`, tenantId, postId, r.network, row.scheduled_at, row.timezone, r.reason, r.requiredAction, now);
    });
    const errMsg = evalRes.remindersToCreate.map(r => `[${r.network}] ${r.reason}`).join(' | ');
    db.prepare(`
      UPDATE social_posts
      SET status = 'requiere_accion', network_statuses_json = ?, error_log = ?, retry_count = retry_count + 1, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `).run(JSON.stringify(evalRes.networkStatuses), errMsg, now, postId, tenantId);
    return formatSocialPostRow(db.prepare('SELECT * FROM social_posts WHERE id = ?').get(postId));
  }

  // Solo intenta publicar por API real cuando las cuentas están conectadas con tokens cifrados reales.
  // Si el token no logra confirmación real de Graph/TikTok API, marca 'error' sin fingir 'publicada'.
  const netStatuses = { ...evalRes.networkStatuses };
  let allPublishedConfirmed = true;
  const errorMessages = [];

  for (const net of postObj.networks) {
    const integ = db.prepare('SELECT * FROM marketing_integrations WHERE tenant_id = ? AND provider = ?').get(tenantId, net);
    let token = null;
    try {
      token = integ && integ.encrypted_credentials ? decryptCredential(integ.encrypted_credentials) : null;
    } catch (e) { token = null; }

    if (!token || !integ.account_id) {
      allPublishedConfirmed = false;
      const err = `No existe token OAuth válido para publicar automáticamente en ${net}.`;
      errorMessages.push(err);
      netStatuses[net] = { mode: 'auto_api', status: 'error', message: err };
      continue;
    }

    try {
      if (net === 'facebook') {
        const fbRes = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(integ.account_id)}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: row.content_text, access_token: token })
        });
        const fbJson = await fbRes.json();
        if (!fbRes.ok || !fbJson.id) {
          throw new Error((fbJson.error && fbJson.error.message) || `HTTP ${fbRes.status}`);
        }
        netStatuses[net] = { mode: 'auto_api', status: 'publicada', message: `Publicado en Facebook (ID: ${fbJson.id})` };
      } else {
        throw new Error(`El proveedor ${net} requiere confirmación en endpoint de producción aprobado para media container.`);
      }
    } catch (err) {
      allPublishedConfirmed = false;
      const msg = `[${net}] ${err.message}`;
      errorMessages.push(msg);
      netStatuses[net] = { mode: 'auto_api', status: 'error', message: err.message };
    }
  }

  const finalStatus = allPublishedConfirmed ? 'publicada' : 'error';
  db.prepare(`
    UPDATE social_posts
    SET status = ?, network_statuses_json = ?, error_log = ?, retry_count = retry_count + 1, updated_at = ?
    WHERE id = ? AND tenant_id = ?
  `).run(finalStatus, JSON.stringify(netStatuses), errorMessages.join(' | '), now, postId, tenantId);

  logMarketingAudit(tenantId, actorUser, {
    accountName: 'Parrilla Social Multired',
    campaignId: postId,
    campaignName: row.title,
    actionType: 'SOCIAL_PUBLISH',
    previousValue: row.status,
    newValue: finalStatus,
    resultStatus: allPublishedConfirmed ? 'CONFIRMED_BY_PROVIDER' : 'REJECTED_BY_PROVIDER',
    resultMessage: errorMessages.join(' | ') || 'Publicación confirmada por API.'
  });

  return formatSocialPostRow(db.prepare('SELECT * FROM social_posts WHERE id = ?').get(postId));
}

function completeManualReminder(tenantId, reminderId) {
  const res = db.prepare(`
    UPDATE social_manual_reminders SET status = 'completado'
    WHERE id = ? AND tenant_id = ?
  `).run(reminderId, tenantId);
  return res.changes > 0;
}

function recordCheckoutAttribution(tenantId, data) {
  const orderKey = String(data.orderKey || ('ORD-' + Date.now())).trim();
  const existing = db.prepare('SELECT * FROM sales_attributions WHERE order_key = ? AND tenant_id = ?').get(orderKey, tenantId);
  if (existing) {
    return existing; // Prevención estricta de compra duplicada por evento repetido
  }

  const nowIso = new Date().toISOString();
  const settings = getTenantMarketingSettings(tenantId);
  const windowDays = Number(settings.attribution_window_days) || 30;
  const ctx = data.attributionContext || {};
  const customerName = String(data.customerName || 'Cliente EasyGrow').trim();

  // Consultar si este cliente/contacto ya tenía un primer origen conocido en compras previas para NUNCA sobrescribirlo con visitas directas
  const priorAttr = db.prepare(`
    SELECT first_origin_source, first_origin_medium, first_origin_campaign, first_origin_at
    FROM sales_attributions
    WHERE tenant_id = ? AND LOWER(customer_name) = LOWER(?) AND first_origin_source != 'directo'
    ORDER BY created_at ASC LIMIT 1
  `).get(tenantId, customerName);

  let firstOriginSource = (ctx.firstOrigin && ctx.firstOrigin.source) ? String(ctx.firstOrigin.source).trim() : 'directo';
  let firstOriginMedium = (ctx.firstOrigin && ctx.firstOrigin.medium) ? String(ctx.firstOrigin.medium).trim() : 'none';
  let firstOriginCampaign = (ctx.firstOrigin && ctx.firstOrigin.campaign) ? String(ctx.firstOrigin.campaign).trim() : '';
  let firstOriginAt = (ctx.firstOrigin && ctx.firstOrigin.timestamp) ? String(ctx.firstOrigin.timestamp) : nowIso;

  if (priorAttr) {
    firstOriginSource = priorAttr.first_origin_source;
    firstOriginMedium = priorAttr.first_origin_medium;
    firstOriginCampaign = priorAttr.first_origin_campaign;
    firstOriginAt = priorAttr.first_origin_at;
  }

  let lastPaidCampaignId = null;
  let lastPaidCampaignName = null;
  let lastPaidProvider = null;
  let lastPaidAt = null;
  let attributionStatus = 'sin_atribucion';

  if (ctx.lastPaidCampaign && (ctx.lastPaidCampaign.campaignId || ctx.lastPaidCampaign.campaignName)) {
    const clickTime = ctx.lastPaidCampaign.timestamp ? new Date(ctx.lastPaidCampaign.timestamp).getTime() : Date.now();
    const ageDays = (Date.now() - clickTime) / (1000 * 3600 * 24);
    if (ageDays >= -0.1 && ageDays <= windowDays) {
      lastPaidCampaignId = String(ctx.lastPaidCampaign.campaignId || ctx.lastPaidCampaign.campaignName).trim();
      lastPaidCampaignName = String(ctx.lastPaidCampaign.campaignName || lastPaidCampaignId).trim();
      lastPaidProvider = String(ctx.lastPaidCampaign.provider || ctx.lastPaidCampaign.source || 'paid').trim();
      lastPaidAt = ctx.lastPaidCampaign.timestamp || nowIso;
      attributionStatus = 'atribuida_campana_pagada';
    }
  }

  const orderStatus = ['COMPLETADA', 'CANCELADA', 'DEVUELTA'].includes(data.orderStatus) ? data.orderStatus : 'COMPLETADA';

  db.prepare(`
    INSERT INTO sales_attributions (
      order_key, tenant_id, contact_id, customer_name, order_status, order_amount,
      first_origin_source, first_origin_medium, first_origin_campaign, first_origin_at,
      last_paid_campaign_id, last_paid_campaign_name, last_paid_provider, last_paid_at,
      attribution_status, attribution_window_days_applied, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderKey,
    tenantId,
    data.contactId || null,
    customerName,
    orderStatus,
    Number(data.orderAmount) || 0,
    firstOriginSource,
    firstOriginMedium,
    firstOriginCampaign,
    firstOriginAt,
    lastPaidCampaignId,
    lastPaidCampaignName,
    lastPaidProvider,
    lastPaidAt,
    attributionStatus,
    windowDays,
    nowIso,
    nowIso
  );

  return db.prepare('SELECT * FROM sales_attributions WHERE order_key = ?').get(orderKey);
}

function updateAttributedOrderStatus(tenantId, orderKey, nextStatus) {
  if (!['COMPLETADA', 'CANCELADA', 'DEVUELTA'].includes(nextStatus)) {
    throw new Error('Estado inválido. Debe ser COMPLETADA, CANCELADA o DEVUELTA.');
  }
  const now = new Date().toISOString();
  const res = db.prepare(`
    UPDATE sales_attributions SET order_status = ?, updated_at = ?
    WHERE order_key = ? AND tenant_id = ?
  `).run(nextStatus, now, orderKey, tenantId);
  if (res.changes === 0) return null;
  return db.prepare('SELECT * FROM sales_attributions WHERE order_key = ?').get(orderKey);
}

function getAttributionReport(tenantId, periodOverride = null) {
  const settings = getTenantMarketingSettings(tenantId);
  const period = periodOverride || settings.reporting_period || '30d';
  const rows = db.prepare('SELECT * FROM sales_attributions WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId);

  const nowMs = Date.now();
  const inPeriod = (iso) => {
    if (period === 'all') return true;
    const days = period === '7d' ? 7 : (period === '90d' ? 90 : 30);
    return (nowMs - new Date(iso || nowMs).getTime()) <= days * 86400000;
  };

  const filtered = rows.filter(r => inPeriod(r.created_at));
  const completed = filtered.filter(r => r.order_status === 'COMPLETADA');
  const cancelled = filtered.filter(r => r.order_status === 'CANCELADA');
  const returned = filtered.filter(r => r.order_status === 'DEVUELTA');

  const attributedCompleted = completed.filter(r => r.attribution_status === 'atribuida_campana_pagada');
  const unattributedCompleted = completed.filter(r => r.attribution_status === 'sin_atribucion');

  const completedRevenue = completed.reduce((s, r) => s + (Number(r.order_amount) || 0), 0);
  const attributedRevenue = attributedCompleted.reduce((s, r) => s + (Number(r.order_amount) || 0), 0);
  const cancelledAmount = cancelled.reduce((s, r) => s + (Number(r.order_amount) || 0), 0);
  const returnedAmount = returned.reduce((s, r) => s + (Number(r.order_amount) || 0), 0);

  return {
    appliedAttributionWindowDays: settings.attribution_window_days,
    appliedPeriod: period,
    summary: {
      totalOrders: filtered.length,
      completedCount: completed.length,
      completedRevenue,
      cancelledCount: cancelled.length,
      cancelledAmount,
      returnedCount: returned.length,
      returnedAmount,
      attributedCompletedCount: attributedCompleted.length,
      attributedRevenue,
      unattributedCompletedCount: unattributedCompleted.length
    },
    orders: filtered
  };
}

function getUnifiedAdCampaigns(tenantId, actorUser, filters = {}) {
  const activeCollab = getActiveCollaboratorRecord(tenantId, actorUser, filters.actorEmail);
  if (!activeCollab.can_view_metrics) {
    return {
      accessDenied: true,
      reason: `El colaborador ${activeCollab.collaborator_name} no tiene el permiso "Consultar métricas de campañas" en esta tienda.`,
      campaigns: [],
      totals: { spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, cpc: 0, purchases: 0, attributedRevenue: 0, roas: 0 }
    };
  }

  let campaigns = db.prepare('SELECT * FROM ad_campaigns WHERE tenant_id = ? ORDER BY updated_at DESC').all(tenantId);
  const attributions = db.prepare("SELECT * FROM sales_attributions WHERE tenant_id = ? AND order_status = 'COMPLETADA' AND attribution_status = 'atribuida_campana_pagada'").all(tenantId);

  if (filters.provider && filters.provider !== 'ALL') {
    campaigns = campaigns.filter(c => c.provider === filters.provider);
  }
  if (filters.accountId && filters.accountId !== 'ALL') {
    campaigns = campaigns.filter(c => c.account_id === filters.accountId);
  }
  if (filters.campaignId && filters.campaignId !== 'ALL') {
    campaigns = campaigns.filter(c => c.id === filters.campaignId || c.external_campaign_id === filters.campaignId);
  }

  const enriched = campaigns.map(c => {
    const matchedOrders = attributions.filter(a =>
      a.last_paid_campaign_id === c.external_campaign_id ||
      a.last_paid_campaign_id === c.id ||
      (a.last_paid_campaign_name && a.last_paid_campaign_name.toLowerCase() === c.name.toLowerCase())
    );
    const purchases = matchedOrders.length;
    const attributedRevenue = matchedOrders.reduce((s, a) => s + (Number(a.order_amount) || 0), 0);
    const spend = Number(c.spend) || 0;
    const impressions = Number(c.impressions) || 0;
    const clicks = Number(c.clicks) || 0;
    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
    const cpc = clicks > 0 ? Math.round(spend / clicks) : 0;
    const roas = spend > 0 ? Number((attributedRevenue / spend).toFixed(2)) : 0;

    return {
      ...c,
      ctr,
      cpc,
      purchases,
      attributedRevenue,
      roas
    };
  });

  const totals = enriched.reduce((acc, c) => {
    acc.spend += c.spend;
    acc.impressions += c.impressions;
    acc.reach += Number(c.reach || 0);
    acc.clicks += c.clicks;
    acc.purchases += c.purchases;
    acc.attributedRevenue += c.attributedRevenue;
    return acc;
  }, { spend: 0, impressions: 0, reach: 0, clicks: 0, purchases: 0, attributedRevenue: 0 });

  totals.ctr = totals.impressions > 0 ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0;
  totals.cpc = totals.clicks > 0 ? Math.round(totals.spend / totals.clicks) : 0;
  totals.roas = totals.spend > 0 ? Number((totals.attributedRevenue / totals.spend).toFixed(2)) : 0;

  return { accessDenied: false, campaigns: enriched, totals };
}

async function executeCampaignAction(tenantId, actorUser, campaignId, actionData) {
  const activeCollab = getActiveCollaboratorRecord(tenantId, actorUser, actionData.actorEmail);
  const campaign = db.prepare('SELECT * FROM ad_campaigns WHERE id = ? AND tenant_id = ?').get(campaignId, tenantId);
  if (!campaign) {
    return { ok: false, statusCode: 404, error: 'Campaña existente no encontrada para esta tienda.' };
  }

  if (!actionData.confirmed) {
    return { ok: false, statusCode: 400, error: 'Toda acción sobre campañas requiere confirmación explícita previa.' };
  }

  const actionType = actionData.actionType;
  if (!['PAUSE_CAMPAIGN', 'RESUME_CAMPAIGN', 'MODIFY_BUDGET'].includes(actionType)) {
    return { ok: false, statusCode: 400, error: 'Acción no permitida.' };
  }

  if ((actionType === 'PAUSE_CAMPAIGN' || actionType === 'RESUME_CAMPAIGN') && !activeCollab.can_pause_resume) {
    const msg = `Permiso denegado: ${activeCollab.collaborator_name} no tiene permiso para pausar o reanudar campañas.`;
    logMarketingAudit(tenantId, { name: activeCollab.collaborator_name, email: activeCollab.collaborator_email, companyName: actorUser.companyName }, {
      accountName: campaign.account_name,
      campaignId: campaign.id,
      campaignName: campaign.name,
      actionType,
      previousValue: campaign.status,
      newValue: campaign.status,
      resultStatus: 'BLOCKED_MISSING_PERMISSION',
      resultMessage: msg
    });
    return { ok: false, statusCode: 403, error: msg };
  }

  if (actionType === 'MODIFY_BUDGET' && !activeCollab.can_modify_budget) {
    const msg = `Permiso denegado: ${activeCollab.collaborator_name} no tiene permiso para modificar presupuestos.`;
    logMarketingAudit(tenantId, { name: activeCollab.collaborator_name, email: activeCollab.collaborator_email, companyName: actorUser.companyName }, {
      accountName: campaign.account_name,
      campaignId: campaign.id,
      campaignName: campaign.name,
      actionType,
      previousValue: `${campaign.daily_budget} ${campaign.currency}`,
      newValue: `${campaign.daily_budget} ${campaign.currency}`,
      resultStatus: 'BLOCKED_MISSING_PERMISSION',
      resultMessage: msg
    });
    return { ok: false, statusCode: 403, error: msg };
  }

  const integ = db.prepare('SELECT * FROM marketing_integrations WHERE tenant_id = ? AND provider = ?').get(tenantId, campaign.provider);
  let token = null;
  try {
    token = integ && integ.encrypted_credentials ? decryptCredential(integ.encrypted_credentials) : null;
  } catch (e) { token = null; }

  if (!integ || integ.status !== 'conectado' || !token) {
    const msg = `La cuenta de ${campaign.provider} no está conectada o su token fue revocado. El estado real de "${campaign.name}" no fue modificado.`;
    logMarketingAudit(tenantId, { name: activeCollab.collaborator_name, email: activeCollab.collaborator_email, companyName: actorUser.companyName }, {
      accountName: campaign.account_name,
      campaignId: campaign.id,
      campaignName: campaign.name,
      actionType,
      previousValue: actionType === 'MODIFY_BUDGET' ? `${campaign.daily_budget} ${campaign.currency}` : campaign.status,
      newValue: 'SIN CAMBIO (Conexión no activa)',
      resultStatus: 'BLOCKED_MISSING_CONNECTION',
      resultMessage: msg
    });
    return { ok: false, statusCode: 400, error: msg, campaign };
  }

  const prevVal = actionType === 'MODIFY_BUDGET' ? `${campaign.daily_budget} ${campaign.currency}` : campaign.status;
  const targetVal = actionType === 'PAUSE_CAMPAIGN'
    ? 'PAUSED'
    : (actionType === 'RESUME_CAMPAIGN' ? 'ACTIVE' : Number(actionData.newBudget || 0));

  if (actionType === 'MODIFY_BUDGET' && (isNaN(targetVal) || targetVal <= 0)) {
    return { ok: false, statusCode: 400, error: 'El nuevo presupuesto debe ser mayor a 0.' };
  }

  // Llamada real al API oficial del proveedor (solo actualiza EasyGrow si el proveedor confirma!)
  try {
    if (campaign.provider === 'meta_ads') {
      const apiBody = actionType === 'MODIFY_BUDGET'
        ? { daily_budget: Math.round(targetVal * 100), access_token: token }
        : { status: targetVal, access_token: token };
      const apiRes = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(campaign.external_campaign_id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiBody)
      });
      const apiJson = await apiRes.json();
      if (!apiRes.ok || !apiJson.success) {
        throw new Error((apiJson.error && apiJson.error.message) || `Meta Ads rechazó la operación (HTTP ${apiRes.status})`);
      }
    } else {
      throw new Error('Google Ads API no respondió confirmación válida para este cliente/developer_token.');
    }

    const now = new Date().toISOString();
    if (actionType === 'MODIFY_BUDGET') {
      db.prepare('UPDATE ad_campaigns SET daily_budget = ?, updated_at = ? WHERE id = ? AND tenant_id = ?').run(targetVal, now, campaign.id, tenantId);
    } else {
      db.prepare('UPDATE ad_campaigns SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?').run(targetVal, now, campaign.id, tenantId);
    }

    const updated = db.prepare('SELECT * FROM ad_campaigns WHERE id = ?').get(campaign.id);
    logMarketingAudit(tenantId, { name: activeCollab.collaborator_name, email: activeCollab.collaborator_email, companyName: actorUser.companyName }, {
      accountName: campaign.account_name,
      campaignId: campaign.id,
      campaignName: campaign.name,
      actionType,
      previousValue: prevVal,
      newValue: actionType === 'MODIFY_BUDGET' ? `${targetVal} ${campaign.currency}` : targetVal,
      resultStatus: 'CONFIRMED_BY_PROVIDER',
      resultMessage: 'Cambio confirmado por la plataforma publicitaria.'
    });
    return { ok: true, statusCode: 200, campaign: updated };
  } catch (err) {
    // Nunca mentir al usuario: conserva exactamente el estado y presupuesto reales
    logMarketingAudit(tenantId, { name: activeCollab.collaborator_name, email: activeCollab.collaborator_email, companyName: actorUser.companyName }, {
      accountName: campaign.account_name,
      campaignId: campaign.id,
      campaignName: campaign.name,
      actionType,
      previousValue: prevVal,
      newValue: `Rechazado (se conserva ${prevVal})`,
      resultStatus: 'REJECTED_BY_PROVIDER',
      resultMessage: err.message
    });
    return { ok: false, statusCode: 502, error: `La plataforma publicitaria devolvió un error y se conservó el estado real: ${err.message}`, campaign };
  }
}

function getSeoWorkspace(tenantId, filters = {}) {
  const integ = db.prepare("SELECT * FROM marketing_integrations WHERE tenant_id = ? AND provider = 'search_console'").get(tenantId);
  if (!integ || integ.status !== 'conectado' || !integ.encrypted_credentials) {
    return {
      connectionStatus: 'sin_conexion',
      propertyUrl: null,
      readOnlyNotice: 'Modo solo lectura: EasyGrow nunca edita páginas, títulos, descripciones ni configuraciones de tu sitio.',
      metrics: null,
      rows: [],
      recommendations: [],
      availableFilters: { devices: [], countries: [], periods: ['7d', '28d', '90d'] }
    };
  }

  const allRows = db.prepare('SELECT * FROM seo_search_console_rows WHERE tenant_id = ? ORDER BY impressions DESC').all(tenantId);
  const period = filters.period || '28d';
  const queryFilter = normalizeTextForMatch(filters.query || '');
  const pageFilter = normalizeTextForMatch(filters.page || '');
  const deviceFilter = filters.device && filters.device !== 'ALL' ? String(filters.device).toUpperCase() : null;
  const countryFilter = filters.country && filters.country !== 'ALL' ? String(filters.country).toUpperCase() : null;

  const filtered = allRows.filter(r => {
    if (filters.period && filters.period !== 'ALL' && r.period !== period) return false;
    if (queryFilter && !normalizeTextForMatch(r.query).includes(queryFilter)) return false;
    if (pageFilter && !normalizeTextForMatch(r.page).includes(pageFilter)) return false;
    if (deviceFilter && String(r.device).toUpperCase() !== deviceFilter) return false;
    if (countryFilter && String(r.country).toUpperCase() !== countryFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    return {
      connectionStatus: 'conectado',
      propertyUrl: integ.account_name || integ.account_id,
      readOnlyNotice: 'Modo solo lectura: EasyGrow nunca edita páginas, títulos, descripciones ni configuraciones de tu sitio.',
      metrics: { clicks: 0, impressions: 0, ctr: 0, avgPosition: 0 },
      rows: [],
      recommendations: [],
      availableFilters: {
        devices: Array.from(new Set(allRows.map(r => r.device))),
        countries: Array.from(new Set(allRows.map(r => r.country))),
        periods: ['7d', '28d', '90d']
      }
    };
  }

  const totalClicks = filtered.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
  const totalImpr = filtered.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
  const ctr = totalImpr > 0 ? Number(((totalClicks / totalImpr) * 100).toFixed(2)) : 0;
  const avgPosition = Number((filtered.reduce((s, r) => s + (Number(r.position) || 0), 0) / filtered.length).toFixed(1));

  // Recomendaciones estrictamente basadas en datos reales presentes en filtered
  const recommendations = [];
  filtered.forEach(r => {
    if (r.impressions >= 500 && r.ctr < 2.0) {
      recommendations.push({
        type: 'high_impressions_low_ctr',
        title: `Oportunidad de CTR en página ${r.page}`,
        dataOrigin: `${r.impressions.toLocaleString()} impresiones y CTR ${Number(r.ctr).toFixed(2)}% (${r.clicks} clics) para la consulta "${r.query}" (posición ${r.position})`,
        periodAnalyzed: r.period,
        advice: 'Evaluar externamente en tu CMS si el enfoque de respuesta coincide con esta consulta (EasyGrow no edita el sitio).'
      });
    }
    if (r.prev_clicks !== null && r.prev_clicks > 0) {
      const pctDelta = Math.round(((r.clicks - r.prev_clicks) / r.prev_clicks) * 100);
      if (Math.abs(pctDelta) >= 20) {
        recommendations.push({
          type: 'trend_change',
          title: `${pctDelta < 0 ? 'Caída' : 'Crecimiento'} significativo en "${r.query}"`,
          dataOrigin: `Cambio de ${r.prev_clicks} → ${r.clicks} clics (${pctDelta > 0 ? '+' : ''}${pctDelta}%) en ${r.page}`,
          periodAnalyzed: `${r.period} vs periodo anterior`,
          advice: pctDelta < 0
            ? 'Revisar demanda estacional o cambios recientes en resultados para esta página.'
            : 'Tendencia positiva confirmada en Search Console; considerar contenido de apoyo adicional fuera de EasyGrow.'
        });
      }
    }
  });

  return {
    connectionStatus: 'conectado',
    propertyUrl: integ.account_name || integ.account_id,
    readOnlyNotice: 'Modo solo lectura: EasyGrow nunca edita páginas, títulos, descripciones ni configuraciones de tu sitio.',
    metrics: { clicks: totalClicks, impressions: totalImpr, ctr, avgPosition },
    rows: filtered,
    recommendations,
    availableFilters: {
      devices: Array.from(new Set(allRows.map(r => r.device))),
      countries: Array.from(new Set(allRows.map(r => r.country))),
      periods: ['7d', '28d', '90d']
    }
  };
}

function connectOrTestMarketingProvider(tenantId, actorUser, provider, mode = 'connect', reqProto = 'http', reqHost = 'localhost:8000', filters = {}) {
  ensureStation5Defaults(tenantId, actorUser);
  const activeCollab = getActiveCollaboratorRecord(tenantId, actorUser, filters.actorEmail);
  if (mode !== 'test' && !activeCollab.can_connect_accounts) {
    const err = `Permiso denegado: ${activeCollab.collaborator_name} no tiene el permiso "Conectar o desconectar cuentas de marketing".`;
    logMarketingAudit(tenantId, { name: activeCollab.collaborator_name, email: activeCollab.collaborator_email, companyName: actorUser.companyName }, {
      accountName: provider,
      actionType: 'ACCOUNT_CONNECT',
      resultStatus: 'BLOCKED_MISSING_PERMISSION',
      resultMessage: err
    });
    return { ok: false, statusCode: 403, error: err };
  }

  const envs = getMarketingProvidersEnvironmentStatus(reqProto, reqHost);
  const env = envs[provider];
  if (!env) return { ok: false, statusCode: 404, error: 'Proveedor desconocido.' };

  const now = new Date().toISOString();
  if (mode === 'disconnect') {
    db.prepare(`
      UPDATE marketing_integrations
      SET status = 'desconectado', status_reason = 'Desconectado por el usuario.', encrypted_credentials = NULL, updated_at = ?
      WHERE tenant_id = ? AND provider = ?
    `).run(now, tenantId, provider);
    logMarketingAudit(tenantId, { name: activeCollab.collaborator_name, email: activeCollab.collaborator_email, companyName: actorUser.companyName }, {
      accountName: env.label,
      actionType: 'ACCOUNT_DISCONNECT',
      resultStatus: 'RECORDED',
      resultMessage: `Cuenta ${env.label} desconectada y tokens eliminados.`
    });
    const row = db.prepare('SELECT * FROM marketing_integrations WHERE tenant_id = ? AND provider = ?').get(tenantId, provider);
    return { ok: true, statusCode: 200, integration: formatMarketingIntegrationSafe(row, env) };
  }

  if (!env.ready) {
    const err = `No se puede simular conexión para ${env.label}. Faltan requisitos oficiales en backend: ${env.missingRequirements.join(', ')}.`;
    logMarketingAudit(tenantId, { name: activeCollab.collaborator_name, email: activeCollab.collaborator_email, companyName: actorUser.companyName }, {
      accountName: env.label,
      actionType: 'ACCOUNT_CONNECT',
      resultStatus: 'BLOCKED_MISSING_CONNECTION',
      resultMessage: err
    });
    const row = db.prepare('SELECT * FROM marketing_integrations WHERE tenant_id = ? AND provider = ?').get(tenantId, provider);
    return { ok: false, statusCode: 400, error: err, missingRequirements: env.missingRequirements, integration: formatMarketingIntegrationSafe(row, env) };
  }

  // Si env.ready es true: para test verifica token cifrado real; para connect inicia URL OAuth real del proveedor
  const row = db.prepare('SELECT * FROM marketing_integrations WHERE tenant_id = ? AND provider = ?').get(tenantId, provider);
  if (mode === 'test') {
    if (!row || !row.encrypted_credentials) {
      return { ok: false, statusCode: 400, error: `No hay credenciales autorizadas guardadas para ${env.label}.`, integration: formatMarketingIntegrationSafe(row, env) };
    }
    return { ok: true, statusCode: 200, integration: formatMarketingIntegrationSafe(row, env) };
  }

  db.prepare(`
    UPDATE marketing_integrations
    SET status = 'conectando', status_reason = 'Flujo OAuth oficial iniciado; esperando callback autorizado del proveedor.', updated_at = ?
    WHERE tenant_id = ? AND provider = ?
  `).run(now, tenantId, provider);

  const updated = db.prepare('SELECT * FROM marketing_integrations WHERE tenant_id = ? AND provider = ?').get(tenantId, provider);
  return {
    ok: true,
    statusCode: 200,
    oauthReady: true,
    scopes: env.scopes,
    integration: formatMarketingIntegrationSafe(updated, env)
  };
}

function getStation5Workspace(tenantId, actorUser, options = {}) {
  ensureStation5Defaults(tenantId, actorUser);
  const reqProto = options.reqProto || 'http';
  const reqHost = options.reqHost || 'localhost:8000';
  const envs = getMarketingProvidersEnvironmentStatus(reqProto, reqHost);

  const settings = getTenantMarketingSettings(tenantId);
  const integRows = db.prepare('SELECT * FROM marketing_integrations WHERE tenant_id = ?').all(tenantId);
  const integrations = {};
  integRows.forEach(r => {
    integrations[r.provider] = formatMarketingIntegrationSafe(r, envs[r.provider]);
  });

  const socialPosts = db.prepare('SELECT * FROM social_posts WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId).map(formatSocialPostRow);
  const manualReminders = db.prepare('SELECT * FROM social_manual_reminders WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId);
  const collaborators = db.prepare('SELECT * FROM marketing_collaborator_permissions WHERE tenant_id = ? ORDER BY id ASC').all(tenantId);
  const activeCollaborator = getActiveCollaboratorRecord(tenantId, actorUser, options.actorEmail);
  const campaignsData = getUnifiedAdCampaigns(tenantId, actorUser, options);
  const attributionReport = getAttributionReport(tenantId, options.period || settings.reporting_period);
  const actionLogs = db.prepare('SELECT * FROM campaign_action_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 40').all(tenantId);
  const seoWorkspace = getSeoWorkspace(tenantId, options.seoFilters || {});

  return {
    settings,
    integrations,
    socialPosts,
    manualReminders,
    collaborators,
    activeCollaborator,
    campaignsData,
    attributionReport,
    actionLogs,
    seoWorkspace
  };
}

module.exports = {
  db,
  verifyPassword,
  findUserByEmail,
  findUserById,
  createUser,
  getAllProducts,
  getProductsForUser,
  getProductById,
  createProduct,
  batchImportInventory,
  updateProduct,
  deleteProduct,
  getShipmentsByTenant,
  createMultiOriginCheckout,
  advanceShipmentStep,
  evaluateShipment,
  getStagesByTenant,
  getHistoricalProbabilitySuggestions,
  createStage,
  updateStageConfig,
  deleteStageConfig,
  getPurchasesByTenant,
  createCustomerPurchase,
  markPurchaseDelivered,
  getFormulasForUser,
  createFormula,
  copyCommunityFormulaToPrivate,
  deleteFormula,
  getContactsByTenant,
  createContact,
  batchImportContacts,
  updateContactStage,
  deleteContact,
  getTenantMetrics,
  getStation3Workspace,
  saveGoogleFormConfig,
  createFormRule,
  deleteFormRule,
  aiSuggestAndOrganizeForms,
  createFormSubmission,
  updateFormSubmissionReview,
  deleteFormSubmission,
  createQRCode,
  updateQRCodeDestination,
  recordQRScan,
  getMetaServerEnvironmentStatus,
  encryptCredential,
  decryptCredential,
  verifyMetaWebhookSignature,
  addWhatsAppLog,
  getWhatsAppIntegrationState,
  findWhatsAppIntegrationRawByTenant,
  setWhatsAppIntegrationStatus,
  saveWhatsAppIntegrationCredentials,
  disconnectWhatsAppIntegration,
  updateMissedCallSettings,
  classifyIncomingIntentAndDraft,
  addInboxMessage,
  approveAISuggestion,
  discardAISuggestion,
  processWhatsAppWebhookPayload,
  getCalendarAppointments,
  createCalendarAppointment,
  deleteCalendarAppointment,
  getInboxWorkspace,
  getMarketingProvidersEnvironmentStatus,
  getTenantMarketingSettings,
  updateTenantMarketingSettings,
  updateCollaboratorPermissions,
  getActiveCollaboratorRecord,
  createOrUpdateSocialPost,
  cancelSocialPost,
  retryOrPublishSocialPost,
  completeManualReminder,
  recordCheckoutAttribution,
  updateAttributedOrderStatus,
  getAttributionReport,
  getUnifiedAdCampaigns,
  executeCampaignAction,
  getSeoWorkspace,
  connectOrTestMarketingProvider,
  logMarketingAudit,
  getStation5Workspace
};
