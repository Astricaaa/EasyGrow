/**
 * EasyGrow Master Server
 * Cybersecurity Banking Standard • Node.js Native SQLite & Crypto • Real-Time SSE
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const db = require('./server/db');
const auth = require('./server/crypto-auth');
const realtime = require('./server/realtime');
const uploadSecurity = require('./server/upload-security');

const PORT = process.env.PORT || 8000;
const BASE_DIR = path.resolve(__dirname);
const AUDIT_LOG_FILE = path.join(BASE_DIR, 'data', 'security-audit.log');

function logSecurityEvent(kind, detail) {
  const line = `${new Date().toISOString()} [${kind}] ${detail}\n`;
  console.warn(line.trim());
  try {
    fs.mkdirSync(path.dirname(AUDIT_LOG_FILE), { recursive: true });
    fs.appendFileSync(AUDIT_LOG_FILE, line, 'utf8');
  } catch (e) {}
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json'
};

function sendJSON(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > 5 * 1024 * 1024) {
        reject(new Error('Body payload too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Body payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

function getClientIP(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
}

function authenticateRequest(req) {
  const cookies = auth.parseCookies(req);
  const token = cookies[auth.TOKEN_COOKIE_NAME];
  if (!token) return null;
  return auth.verifyJWT(token);
}

const server = http.createServer(async (req, res) => {
  try {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  const clientIP = getClientIP(req);

  // Security Headers (OWASP Defense in Depth)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://cdn.sheetjs.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' blob: data: https://graph.facebook.com https://www.facebook.com; frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
  if (pathname.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }

  // --- 1. Real-Time SSE Stream ---
  if (pathname === '/api/realtime/events' && method === 'GET') {
    const user = authenticateRequest(req);
    return realtime.handleSSEConnection(req, res, user);
  }

  // --- 2. API Routes ---

  // Auth: Login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const rateCheck = auth.checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      return sendJSON(res, 429, { success: false, error: rateCheck.error });
    }

    const { email, password } = await parseBody(req);
    if (!email || !password) {
      return sendJSON(res, 400, { success: false, error: 'Correo y contraseña requeridos.' });
    }

    const user = db.findUserByEmail(email);
    if (!user || !db.verifyPassword(password, user.password_hash, user.salt)) {
      auth.recordFailedLogin(clientIP);
      return sendJSON(res, 401, { success: false, error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
    }

    auth.clearRateLimit(clientIP);
    const token = auth.signJWT({
      userId: user.id,
      email: user.email,
      name: user.name,
      companyName: user.company_name,
      role: user.role,
      tenantId: user.id
    });

    const cookieHeader = auth.buildAuthCookie(token);
    return sendJSON(res, 200, {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyName: user.company_name,
        role: user.role
      }
    }, { 'Set-Cookie': cookieHeader });
  }

  // Auth: Register Tenant
  if (pathname === '/api/auth/register' && method === 'POST') {
    const rateCheck = auth.checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      return sendJSON(res, 429, { success: false, error: rateCheck.error });
    }
    const { email, password, name, companyName } = await parseBody(req);
    if (!email || !password || !name || !companyName) {
      return sendJSON(res, 400, { success: false, error: 'Todos los campos son obligatorios.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return sendJSON(res, 400, { success: false, error: 'Formato de correo electrónico inválido.' });
    }
    if (String(password).length < 8) {
      return sendJSON(res, 400, { success: false, error: 'La contraseña debe tener mínimo 8 caracteres.' });
    }

    try {
      const newUser = db.createUser({ email, password, name, companyName, role: 'tenant' });
      const token = auth.signJWT({
        userId: newUser.id,
        email: newUser.email,
        name: newUser.name,
        companyName: newUser.companyName,
        role: newUser.role,
        tenantId: newUser.id
      });
      const cookieHeader = auth.buildAuthCookie(token);
      return sendJSON(res, 201, { success: true, user: newUser }, { 'Set-Cookie': cookieHeader });
    } catch (err) {
      return sendJSON(res, 400, { success: false, error: err.message });
    }
  }

  // Auth: Logout
  if (pathname === '/api/auth/logout' && method === 'POST') {
    return sendJSON(res, 200, { success: true }, { 'Set-Cookie': auth.buildClearCookie() });
  }

  // Auth: Me (Session verification)
  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = authenticateRequest(req);
    if (!user) {
      return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    }
    return sendJSON(res, 200, { success: true, user });
  }

  // --- MARKETPLACE & INVENTARIO PROPIO API ---

  // Get Products visible to current user (Global Dropi + User's Own Inventory)
  if (pathname === '/api/marketplace/products' && method === 'GET') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'Inicia sesión para ver el catálogo.' });
    const products = db.getProductsForUser(user.tenantId);
    return sendJSON(res, 200, { success: true, products });
  }

  // Publish Product (Admin: Dropi or Propio; Emprendedor: Inventario Propio)
  if (pathname === '/api/marketplace/products' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    const reqOrigin = String(body.origin_type || (user.role === 'admin' ? 'dropi' : 'propio')).toLowerCase();
    if (user.role !== 'admin' && reqOrigin === 'dropi') {
      return sendJSON(res, 403, { success: false, error: 'Solo el Administrador Maestro puede publicar en el catálogo global Dropi. Selecciona Inventario Propio.' });
    }
    if (!body.name || !body.suggested_price) {
      return sendJSON(res, 400, { success: false, error: 'Nombre y precio sugerido son obligatorios.' });
    }
    const product = db.createProduct({ ...body, origin_type: reqOrigin }, user);
    if (product.origin_type === 'dropi') {
      realtime.broadcast('marketplace_updated', { action: 'create', product });
    }
    return sendJSON(res, 201, { success: true, product });
  }

  // Security Upload Inspection (Anti-Trojan / Magic Bytes / Macro / Formula Guard)
  if (pathname === '/api/security/inspect-upload' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    const fileName = String(body.fileName || '').trim();
    const size = Number(body.size || 0);
    const base64Data = String(body.base64Data || '');

    if (!fileName || !base64Data) {
      return sendJSON(res, 400, { success: false, blocked: true, error: 'Datos del archivo incompletos.' });
    }
    if (base64Data.length > 7 * 1024 * 1024) {
      logSecurityEvent('UPLOAD_BLOCKED', `tenant=${user.tenantId} ip=${clientIP} file="${fileName}" reason=PAYLOAD_TOO_LARGE`);
      return sendJSON(res, 400, { success: false, blocked: true, error: 'El archivo excede el límite permitido de 5 MB.' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const check = uploadSecurity.inspectUploadedBuffer({ fileName, buffer, size });
    if (!check.safe) {
      logSecurityEvent('UPLOAD_BLOCKED', `tenant=${user.tenantId} ip=${clientIP} file="${fileName}" code=${check.code}`);
      return sendJSON(res, 400, { success: false, blocked: true, code: check.code, error: check.reason });
    }
    return sendJSON(res, 200, { success: true, safe: true, sha256: check.sha256, ext: check.ext, bytes: check.bytes });
  }

  // Batch Import Inventory from AI Excel Assistant
  if (pathname === '/api/marketplace/batch-import' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const { items } = await parseBody(req);
    if (!Array.isArray(items) || items.length === 0) {
      return sendJSON(res, 400, { success: false, error: 'Se esperaba un arreglo con productos revisados para importar.' });
    }
    const cleanItems = uploadSecurity.sanitizeImportRows(items);
    const created = db.batchImportInventory(user.tenantId, user.role === 'admin', cleanItems, user);
    if (created.some(p => p.origin_type === 'dropi')) {
      realtime.broadcast('marketplace_updated', { action: 'batch_import', count: created.length });
    }
    return sendJSON(res, 201, { success: true, importedCount: created.length, products: created });
  }

  // Update Product (Admin any; Emprendedor own Inventario Propio)
  if (pathname.startsWith('/api/marketplace/products/') && method === 'PUT') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const id = pathname.replace('/api/marketplace/products/', '');
    const existing = db.getProductById(id);
    if (!existing) return sendJSON(res, 404, { success: false, error: 'Producto no encontrado.' });
    if (user.role !== 'admin' && (existing.origin_type !== 'propio' || existing.tenant_id !== user.tenantId)) {
      return sendJSON(res, 403, { success: false, error: 'No tienes permiso para modificar productos globales Dropi.' });
    }
    const body = await parseBody(req);
    const updated = db.updateProduct(id, body, user);
    if (!updated) {
      return sendJSON(res, 403, { success: false, error: 'No autorizado para editar este producto.' });
    }
    if (updated.origin_type === 'dropi') {
      realtime.broadcast('marketplace_updated', { action: 'update', product: updated });
    }
    return sendJSON(res, 200, { success: true, product: updated });
  }

  // Delete Product (Admin any; Emprendedor own Inventario Propio)
  if (pathname.startsWith('/api/marketplace/products/') && method === 'DELETE') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const id = pathname.replace('/api/marketplace/products/', '');
    const existing = db.getProductById(id);
    if (!existing) return sendJSON(res, 404, { success: false, error: 'Producto no encontrado.' });
    if (user.role !== 'admin' && (existing.origin_type !== 'propio' || existing.tenant_id !== user.tenantId)) {
      return sendJSON(res, 403, { success: false, error: 'No tienes permiso para eliminar productos globales Dropi.' });
    }
    const deleted = db.deleteProduct(id, user);
    if (!deleted) return sendJSON(res, 403, { success: false, error: 'No autorizado.' });
    if (existing.origin_type === 'dropi') {
      realtime.broadcast('marketplace_updated', { action: 'delete', id });
    }
    return sendJSON(res, 200, { success: true });
  }

  // --- MULTI-ORIGIN CHECKOUT, GUIDES, TRACKING & EVALUATIONS ---

  // Get Tenant Shipments & Guides
  if (pathname === '/api/shipping/shipments' && method === 'GET') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const shipments = db.getShipmentsByTenant(user.tenantId);
    return sendJSON(res, 200, { success: true, shipments });
  }

  // Multi-Origin Cart Checkout -> Generates 1 Guide per Origin Group
  if (pathname === '/api/shipping/checkout' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    try {
      const result = db.createMultiOriginCheckout(user.tenantId, body);
      return sendJSON(res, 201, { success: true, ...result });
    } catch (err) {
      return sendJSON(res, 400, { success: false, error: err.message });
    }
  }

  // Advance Shipment Tracking Step & Emit Notification
  if (pathname.startsWith('/api/shipping/shipments/') && pathname.endsWith('/advance') && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const shipmentId = pathname.replace('/api/shipping/shipments/', '').replace('/advance', '');
    const updated = db.advanceShipmentStep(user.tenantId, shipmentId);
    if (!updated) return sendJSON(res, 404, { success: false, error: 'Guía no encontrada.' });
    return sendJSON(res, 200, { success: true, shipment: updated });
  }

  // Evaluate Supplier (Punctuality & Condition) + Product Quality (Specifications)
  if (pathname.startsWith('/api/shipping/shipments/') && pathname.endsWith('/evaluate') && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const shipmentId = pathname.replace('/api/shipping/shipments/', '').replace('/evaluate', '');
    const body = await parseBody(req);
    const updated = db.evaluateShipment(user.tenantId, shipmentId, body);
    if (!updated) return sendJSON(res, 404, { success: false, error: 'Guía no encontrada.' });
    return sendJSON(res, 200, { success: true, shipment: updated });
  }

  // --- CRM & MULTI-TENANT API ---

  // Get Tenant Contacts
  if (pathname === '/api/crm/contacts' && method === 'GET') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const contacts = db.getContactsByTenant(user.tenantId);
    return sendJSON(res, 200, { success: true, contacts });
  }

  // Create Tenant Contact
  if (pathname === '/api/crm/contacts' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    const contact = db.createContact(user.tenantId, body);
    return sendJSON(res, 201, { success: true, contact });
  }

  // Update Contact Stage
  if (pathname.startsWith('/api/crm/contacts/') && pathname.endsWith('/stage') && method === 'PUT') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const contactId = pathname.replace('/api/crm/contacts/', '').replace('/stage', '');
    const { stage } = await parseBody(req);
    const updated = db.updateContactStage(user.tenantId, contactId, stage);
    if (!updated) return sendJSON(res, 404, { success: false, error: 'Contacto no encontrado en tu cuenta.' });
    return sendJSON(res, 200, { success: true, contact: updated });
  }

  // Delete Contact
  if (pathname.startsWith('/api/crm/contacts/') && method === 'DELETE') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const contactId = pathname.replace('/api/crm/contacts/', '');
    const deleted = db.deleteContact(user.tenantId, contactId);
    return sendJSON(res, 200, { success: deleted });
  }

  // Batch Import from Excel/CSV
  if (pathname === '/api/crm/batch-import' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const { contacts } = await parseBody(req);
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return sendJSON(res, 400, { success: false, error: 'Se esperaba un arreglo con registros para importar.' });
    }
    const cleanContacts = uploadSecurity.sanitizeImportRows(contacts);
    const imported = db.batchImportContacts(user.tenantId, cleanContacts);
    const metrics = db.getTenantMetrics(user.tenantId);
    return sendJSON(res, 201, { success: true, importedCount: imported.length, metrics });
  }

  // Get Tenant Dynamic Calculated Metrics (Supports ?period=today|7d|month|all)
  if (pathname === '/api/crm/metrics' && method === 'GET') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const period = (parsedUrl.query && parsedUrl.query.period) || 'all';
    const metrics = db.getTenantMetrics(user.tenantId, period);
    return sendJSON(res, 200, { success: true, metrics });
  }

  // --- STATION 02: KANBAN STAGES, LOYALTY PURCHASES & FORMULAS API ---

  // Get Tenant Kanban Stages & Historical Probability Suggestions
  if (pathname === '/api/crm/stages' && method === 'GET') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const stages = db.getStagesByTenant(user.tenantId);
    const historyAnalysis = db.getHistoricalProbabilitySuggestions(user.tenantId);
    return sendJSON(res, 200, { success: true, stages, historyAnalysis });
  }

  // Create New Custom Kanban Stage for Tenant Store
  if (pathname === '/api/crm/stages' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    const stage = db.createStage(user.tenantId, body);
    return sendJSON(res, 201, { success: true, stage });
  }

  // Update Kanban Stage Name, Common Category or Probability
  if (pathname.startsWith('/api/crm/stages/') && method === 'PUT') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const stageId = pathname.replace('/api/crm/stages/', '');
    const body = await parseBody(req);
    const updated = db.updateStageConfig(user.tenantId, stageId, body);
    if (!updated) return sendJSON(res, 404, { success: false, error: 'Etapa no encontrada.' });
    return sendJSON(res, 200, { success: true, stage: updated });
  }

  // Delete Custom Kanban Stage
  if (pathname.startsWith('/api/crm/stages/') && method === 'DELETE') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const stageId = pathname.replace('/api/crm/stages/', '');
    try {
      const deleted = db.deleteStageConfig(user.tenantId, stageId);
      return sendJSON(res, 200, { success: deleted });
    } catch (err) {
      return sendJSON(res, 400, { success: false, error: err.message });
    }
  }

  // Get Tenant Customer Associated Purchases History
  if (pathname === '/api/crm/purchases' && method === 'GET') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const purchases = db.getPurchasesByTenant(user.tenantId);
    return sendJSON(res, 200, { success: true, purchases });
  }

  // Record Associated Customer Purchase
  if (pathname === '/api/crm/purchases' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    const purchase = db.createCustomerPurchase(user.tenantId, body);
    return sendJSON(res, 201, { success: true, purchase });
  }

  // Mark Associated Purchase as Delivered (Sets Actual Delivery Date)
  if (pathname.startsWith('/api/crm/purchases/') && pathname.endsWith('/deliver') && method === 'PUT') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const purchaseId = pathname.replace('/api/crm/purchases/', '').replace('/deliver', '');
    const updated = db.markPurchaseDelivered(user.tenantId, purchaseId);
    if (!updated) return sendJSON(res, 404, { success: false, error: 'Compra no encontrada.' });
    return sendJSON(res, 200, { success: true, purchase: updated });
  }

  // Get Formulas (Mis Fórmulas Privadas + Fórmulas de la Comunidad)
  if (pathname === '/api/crm/formulas' && method === 'GET') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const { privateFormulas, communityFormulas } = db.getFormulasForUser(user.tenantId);
    return sendJSON(res, 200, { success: true, privateFormulas, communityFormulas });
  }

  // Create Formula (Private or Community Template without client/sales data)
  if (pathname === '/api/crm/formulas' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    const formula = db.createFormula(user, body);
    return sendJSON(res, 201, { success: true, formula });
  }

  // Copy Community Formula to Private Workspace ("Mis fórmulas")
  if (pathname.startsWith('/api/crm/formulas/') && pathname.endsWith('/copy') && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const formulaId = pathname.replace('/api/crm/formulas/', '').replace('/copy', '');
    const copied = db.copyCommunityFormulaToPrivate(user, formulaId);
    if (!copied) return sendJSON(res, 404, { success: false, error: 'Fórmula comunitaria no encontrada.' });
    return sendJSON(res, 201, { success: true, formula: copied });
  }

  // Delete Private Formula
  if (pathname.startsWith('/api/crm/formulas/') && method === 'DELETE') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const formulaId = pathname.replace('/api/crm/formulas/', '');
    const deleted = db.deleteFormula(user, formulaId);
    if (!deleted) return sendJSON(res, 403, { success: false, error: 'No autorizado o fórmula no encontrada.' });
    return sendJSON(res, 200, { success: true });
  }

  // --- Estación 03: Google Forms, Clasificación Asistida y QRs Dinámicos ---

  if (pathname === '/api/station3/workspace' && method === 'GET') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const workspace = db.getStation3Workspace(user.tenantId);
    return sendJSON(res, 200, { success: true, ...workspace });
  }

  if (pathname === '/api/station3/forms/config' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    const config = db.saveGoogleFormConfig(user.tenantId, body);
    return sendJSON(res, 200, { success: true, config });
  }

  if (pathname === '/api/station3/forms/rules' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    const rule = db.createFormRule(user.tenantId, body);
    return sendJSON(res, 201, { success: true, rule });
  }

  if (pathname.startsWith('/api/station3/forms/rules/') && method === 'DELETE') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const ruleId = pathname.replace('/api/station3/forms/rules/', '');
    const deleted = db.deleteFormRule(user.tenantId, ruleId);
    return sendJSON(res, 200, { success: deleted });
  }

  if (pathname === '/api/station3/forms/ai-organize' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const result = db.aiSuggestAndOrganizeForms(user.tenantId);
    return sendJSON(res, 200, { success: true, ...result });
  }

  if (pathname === '/api/station3/forms/submissions' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    const submission = db.createFormSubmission(user.tenantId, body);
    return sendJSON(res, 201, { success: true, submission });
  }

  if (pathname.startsWith('/api/station3/forms/submissions/') && pathname.endsWith('/review') && method === 'PUT') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const subId = pathname.replace('/api/station3/forms/submissions/', '').replace('/review', '');
    const body = await parseBody(req);
    const updated = db.updateFormSubmissionReview(user.tenantId, subId, body);
    if (!updated) return sendJSON(res, 404, { success: false, error: 'Respuesta no encontrada.' });
    return sendJSON(res, 200, { success: true, submission: updated });
  }

  if (pathname.startsWith('/api/station3/forms/submissions/') && method === 'DELETE') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const subId = pathname.replace('/api/station3/forms/submissions/', '');
    const deleted = db.deleteFormSubmission(user.tenantId, subId);
    return sendJSON(res, 200, { success: deleted });
  }

  if (pathname === '/api/station3/qrs' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    const qr = db.createQRCode(user.tenantId, body);
    return sendJSON(res, 201, { success: true, qr });
  }

  if (pathname.startsWith('/api/station3/qrs/') && pathname.endsWith('/scan') && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const qrId = pathname.replace('/api/station3/qrs/', '').replace('/scan', '');
    const body = await parseBody(req);
    const result = db.recordQRScan(user.tenantId, qrId, body);
    if (!result) return sendJSON(res, 404, { success: false, error: 'Código QR no encontrado.' });
    return sendJSON(res, 200, { success: true, ...result });
  }

  if (pathname.startsWith('/api/station3/qrs/') && method === 'PUT') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const qrId = pathname.replace('/api/station3/qrs/', '');
    const body = await parseBody(req);
    const updated = db.updateQRCodeDestination(user.tenantId, qrId, body);
    if (!updated) return sendJSON(res, 404, { success: false, error: 'Código QR no encontrado.' });
    return sendJSON(res, 200, { success: true, qr: updated });
  }

  // --- Estación 04: WhatsApp Business Platform, Meta Embedded Signup v4, Webhooks, Bandeja y Calendario ---

  const reqProto = (req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http')).split(',')[0].trim();
  const reqHost = req.headers.host || `localhost:${PORT}`;

  async function dispatchRealWhatsAppText(tenantId, toPhone, textBody) {
    const { row, accessToken } = db.findWhatsAppIntegrationRawByTenant(tenantId);
    const env = db.getMetaServerEnvironmentStatus(reqProto, reqHost);
    const version = env.publicClientConfig.graphApiVersion || 'v21.0';
    if (row.status !== 'conectado' || !accessToken || !row.phone_number_id) {
      return { sentLive: false, deliveryStatus: 'pending_whatsapp_connection', reason: 'La tienda no tiene una sesión activa de WhatsApp Business Platform.' };
    }
    const toDigits = String(toPhone || '').replace(/\D/g, '');
    if (!toDigits) {
      return { sentLive: false, deliveryStatus: 'failed', reason: 'El contacto no tiene un número de teléfono válido para WhatsApp.' };
    }

    try {
      const apiRes = await fetch(`https://graph.facebook.com/${version}/${row.phone_number_id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toDigits,
          type: 'text',
          text: { preview_url: false, body: textBody }
        })
      });
      const apiJson = await apiRes.json();
      if (!apiRes.ok) {
        const errMsg = (apiJson.error && apiJson.error.message) || `HTTP ${apiRes.status}`;
        if (apiJson.error && (apiJson.error.code === 190 || apiJson.error.code === 10)) {
          db.setWhatsAppIntegrationStatus(tenantId, 'requiere_atencion', `Token o permisos revocados en Meta (${errMsg}). Usa "Reconectar".`);
        }
        db.addWhatsAppLog(tenantId, 'outbound_api', 'send_message', 'failed', `Error enviando a ${toDigits}`, errMsg);
        return { sentLive: false, deliveryStatus: 'failed', reason: errMsg };
      }

      const metaMsgId = (apiJson.messages && apiJson.messages[0] && apiJson.messages[0].id) || '';
      db.addWhatsAppLog(tenantId, 'outbound_api', 'send_message', 'sent', `Mensaje enviado a Meta Graph API (${metaMsgId}) para ${toDigits}.`);
      return { sentLive: true, deliveryStatus: 'sent', metaMessageId: metaMsgId };
    } catch (err) {
      db.addWhatsAppLog(tenantId, 'outbound_api', 'send_message', 'failed', `Fallo de red hacia Meta Graph API`, err.message);
      return { sentLive: false, deliveryStatus: 'failed', reason: err.message };
    }
  }

  // Webhook Verification Handshake (Meta GET Challenge)
  if (pathname === '/api/webhooks/whatsapp' && method === 'GET') {
    const mode = parsedUrl.query['hub.mode'];
    const token = parsedUrl.query['hub.verify_token'];
    const challenge = parsedUrl.query['hub.challenge'];
    const expectedToken = String(process.env.META_WEBHOOK_VERIFY_TOKEN || '').trim();

    if (!expectedToken) {
      return sendJSON(res, 503, { success: false, error: 'META_WEBHOOK_VERIFY_TOKEN no configurado en el servidor.' });
    }
    if (mode === 'subscribe' && token === expectedToken) {
      db.addWhatsAppLog(null, 'inbound_webhook', 'verify_challenge', 'ok', 'Verificación de webhook GET aceptada por Meta.');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(String(challenge || ''));
    }
    db.addWhatsAppLog(null, 'signature_error', 'verify_challenge', 'rejected', 'Token de verificación GET inválido.');
    return sendJSON(res, 403, { success: false, error: 'Verify token inválido.' });
  }

  // Official WhatsApp Webhook Receiver (HMAC-SHA256 Verified + Idempotent)
  if (pathname === '/api/webhooks/whatsapp' && method === 'POST') {
    const rawBuffer = await readRawBody(req);
    const sigCheck = db.verifyMetaWebhookSignature(rawBuffer, req.headers['x-hub-signature-256']);
    if (!sigCheck.ok) {
      db.addWhatsAppLog(null, 'signature_error', 'webhook_post', 'rejected', 'Webhook rechazado por fallo en firma HMAC.', sigCheck.reason);
      return sendJSON(res, 401, { success: false, error: sigCheck.reason });
    }

    let payload = {};
    try {
      payload = JSON.parse(rawBuffer.toString('utf8') || '{}');
    } catch (e) {
      db.addWhatsAppLog(null, 'signature_error', 'webhook_json', 'rejected', 'JSON malformado en webhook.', e.message);
      return sendJSON(res, 400, { success: false, error: 'Payload JSON inválido.' });
    }

    const summary = db.processWhatsAppWebhookPayload(payload);
    realtime.broadcast('inbox_updated', summary);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('EVENT_RECEIVED');
  }

  // Configuración > Integraciones > WhatsApp (Real State + Missing Server Configs)
  if (pathname === '/api/whatsapp/config' && method === 'GET') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const state = db.getWhatsAppIntegrationState(user.tenantId, reqProto, reqHost);
    return sendJSON(res, 200, { success: true, ...state });
  }

  // Start Meta Embedded Signup v4 (Strictly validates backend env + HTTPS, never fakes connection)
  if (pathname === '/api/whatsapp/embedded-signup/start' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const env = db.getMetaServerEnvironmentStatus(reqProto, reqHost);
    if (!env.ready) {
      db.addWhatsAppLog(
        user.tenantId,
        'connection_test',
        'embedded_signup_start',
        'failed',
        'Intento de Embedded Signup v4 bloqueado: faltan variables seguras de Meta o HTTPS.',
        env.missingConfig.map(m => m.key).join(', ')
      );
      return sendJSON(res, 400, {
        success: false,
        status: 'no_conectado',
        missingConfig: env.missingConfig,
        error: 'No se puede iniciar ni simular la conexión porque falta configuración obligatoria de Meta en el backend.'
      });
    }

    const integration = db.setWhatsAppIntegrationStatus(
      user.tenantId,
      'conectando',
      'Flujo Meta Embedded Signup v4 iniciado. Esperando autorización oficial de la tienda en ventana de Meta...'
    );
    return sendJSON(res, 200, {
      success: true,
      integration,
      publicClientConfig: env.publicClientConfig
    });
  }

  // Complete Meta Embedded Signup v4 (Exchanges code server-side, checks Calling API, encrypts token)
  if (pathname === '/api/whatsapp/embedded-signup/complete' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const env = db.getMetaServerEnvironmentStatus(reqProto, reqHost);
    if (!env.ready) {
      return sendJSON(res, 400, {
        success: false,
        status: 'no_conectado',
        missingConfig: env.missingConfig,
        error: 'Configuración incompleta en servidor. No se puede simular una conexión exitosa.'
      });
    }

    const body = await parseBody(req);
    const code = String(body.code || '').trim();
    const wabaId = String(body.wabaId || '').trim();
    const phoneNumberId = String(body.phoneNumberId || '').trim();
    if (!code || !wabaId || !phoneNumberId) {
      db.setWhatsAppIntegrationStatus(user.tenantId, 'requiere_atencion', 'Autorización Embedded Signup v4 incompleta (faltó code, waba_id o phone_number_id).');
      return sendJSON(res, 400, { success: false, error: 'Faltan parámetros oficiales de Meta Embedded Signup v4 (code, wabaId, phoneNumberId).' });
    }

    const version = env.publicClientConfig.graphApiVersion || 'v21.0';
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    try {
      const tokenUrl = `https://graph.facebook.com/${version}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        const msg = (tokenData.error && tokenData.error.message) || 'Meta rechazó el intercambio de código OAuth.';
        db.setWhatsAppIntegrationStatus(user.tenantId, 'requiere_atencion', msg);
        db.addWhatsAppLog(user.tenantId, 'connection_test', 'oauth_exchange', 'failed', 'Error en intercambio Embedded Signup v4', msg);
        return sendJSON(res, 400, { success: false, error: msg });
      }

      const accessToken = tokenData.access_token;

      // Subscribe WABA to app webhooks
      await fetch(`https://graph.facebook.com/${version}/${wabaId}/subscribed_apps`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      // Fetch display phone number & verified business name
      const phoneRes = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const phoneJson = await phoneRes.json();

      // Query Call Settings to verify real WhatsApp Business Calling API eligibility
      let callingEligible = false;
      let callingIneligibleReason = 'WhatsApp Business Calling API no está habilitada de forma predeterminada en Meta para este número empresarial.';
      try {
        const settingsRes = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/settings`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (settingsRes.ok) {
          const settingsJson = await settingsRes.json();
          if (settingsJson && settingsJson.calling && settingsJson.calling.status === 'ENABLED') {
            callingEligible = true;
            callingIneligibleReason = '';
          } else {
            callingIneligibleReason = 'Meta confirmó que este número aún no tiene Call Settings habilitado (status != ENABLED). La mensajería normal sigue activa.';
          }
        }
      } catch (e) {}

      const integration = db.saveWhatsAppIntegrationCredentials(user.tenantId, {
        accessToken,
        businessName: phoneJson.verified_name || user.companyName,
        displayPhoneNumber: phoneJson.display_phone_number || phoneNumberId,
        wabaId,
        phoneNumberId,
        callingEligible,
        callingIneligibleReason
      });

      db.addWhatsAppLog(user.tenantId, 'connection_test', 'embedded_signup_complete', 'ok', `Tienda conectada por Embedded Signup v4: ${integration.business_name} (${integration.display_phone_number}).`);
      return sendJSON(res, 200, { success: true, integration });
    } catch (err) {
      db.setWhatsAppIntegrationStatus(user.tenantId, 'requiere_atencion', `Fallo de red con Meta Graph API: ${err.message}`);
      return sendJSON(res, 502, { success: false, error: err.message });
    }
  }

  // Test Connection (Verifies encrypted credentials against Graph API or reports exact missing requirements)
  if (pathname === '/api/whatsapp/test-connection' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const env = db.getMetaServerEnvironmentStatus(reqProto, reqHost);
    const { row, accessToken } = db.findWhatsAppIntegrationRawByTenant(user.tenantId);

    if (!env.ready || !accessToken || !row.phone_number_id) {
      const reason = !env.ready
        ? `Falta configuración del servidor de Meta: ${env.missingConfig.map(m => m.key).join(', ')}.`
        : 'Esta tienda aún no tiene credenciales cifradas de Meta Embedded Signup v4. Usa "Conectar WhatsApp".';
      db.addWhatsAppLog(user.tenantId, 'connection_test', 'test_connection', 'failed', 'Prueba fallida: conexión no configurada', reason);
      return sendJSON(res, 400, {
        success: false,
        status: row.status,
        missingConfig: env.missingConfig,
        error: reason
      });
    }

    try {
      const version = env.publicClientConfig.graphApiVersion || 'v21.0';
      const checkRes = await fetch(`https://graph.facebook.com/${version}/${row.phone_number_id}?fields=display_phone_number,verified_name,quality_rating`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const checkJson = await checkRes.json();
      if (!checkRes.ok) {
        const errMsg = (checkJson.error && checkJson.error.message) || `HTTP ${checkRes.status}`;
        const updated = db.setWhatsAppIntegrationStatus(
          user.tenantId,
          'requiere_atencion',
          `La prueba contra Meta falló (${errMsg}). Usa "Reconectar" para renovar permisos.`,
          { lastTestedAt: new Date().toISOString() }
        );
        db.addWhatsAppLog(user.tenantId, 'connection_test', 'test_connection', 'failed', 'Prueba de conexión fallida', errMsg);
        return sendJSON(res, 400, { success: false, integration: updated, error: errMsg });
      }

      const updated = db.setWhatsAppIntegrationStatus(
        user.tenantId,
        'conectado',
        `Conexión verificada en Meta para ${checkJson.verified_name || row.business_name} (${checkJson.display_phone_number || row.display_phone_number}).`,
        { lastTestedAt: new Date().toISOString() }
      );
      db.addWhatsAppLog(user.tenantId, 'connection_test', 'test_connection', 'ok', 'Prueba de conexión exitosa contra Meta Graph API.');
      return sendJSON(res, 200, { success: true, integration: updated });
    } catch (err) {
      db.addWhatsAppLog(user.tenantId, 'connection_test', 'test_connection', 'failed', 'Error de red probando conexión', err.message);
      return sendJSON(res, 502, { success: false, error: err.message });
    }
  }

  // Disconnect WhatsApp Integration
  if (pathname === '/api/whatsapp/disconnect' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const integration = db.disconnectWhatsAppIntegration(user.tenantId);
    return sendJSON(res, 200, { success: true, integration });
  }

  // Missed Call Settings (Only activatable when connected & eligible for WhatsApp Business Calling)
  if (pathname === '/api/whatsapp/missed-call-settings' && method === 'PUT') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    try {
      const integration = db.updateMissedCallSettings(user.tenantId, body);
      return sendJSON(res, 200, { success: true, integration });
    } catch (err) {
      return sendJSON(res, 400, { success: false, error: err.message });
    }
  }

  // Station 04 Omnichannel 3-Panel Inbox + AI Human Approval + Calendar
  if (pathname === '/api/inbox/workspace' && method === 'GET') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const workspace = db.getInboxWorkspace(user.tenantId, reqProto, reqHost);
    return sendJSON(res, 200, { success: true, ...workspace });
  }

  if (pathname === '/api/inbox/messages' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    const direction = body.direction === 'incoming' ? 'incoming' : 'outgoing';
    let contactId = body.contactId;
    const contacts = db.getContactsByTenant(user.tenantId);
    let contact = contacts.find(c => c.id === contactId);

    if (!contact && body.senderName) {
      const created = db.createContact(user.tenantId, {
        name: body.senderName,
        contactPerson: body.senderName,
        phone: body.senderPhone || '',
        stage: 'prospects',
        value: 0,
        cost: 0,
        tags: [String(body.channel || 'whatsapp').toUpperCase()],
        attribution: `Bandeja ${body.channel || 'whatsapp'}`
      });
      contactId = created.id;
      contact = created;
    }
    if (!contactId) {
      return sendJSON(res, 400, { success: false, error: 'Se requiere seleccionar o crear un contacto para el mensaje.' });
    }

    let deliveryResult = { deliveryStatus: direction === 'incoming' ? 'received' : 'sent_local', metaMessageId: '' };
    if (direction === 'outgoing' && (body.channel || 'whatsapp') === 'whatsapp') {
      deliveryResult = await dispatchRealWhatsAppText(user.tenantId, contact && contact.phone, body.body);
    }

    const msg = db.addInboxMessage(user.tenantId, {
      contactId,
      channel: body.channel || 'whatsapp',
      direction,
      senderName: direction === 'incoming' ? (body.senderName || (contact && contact.name) || 'Cliente') : (user.companyName || 'Asesor'),
      body: body.body,
      metaMessageId: deliveryResult.metaMessageId || '',
      deliveryStatus: deliveryResult.deliveryStatus
    });

    return sendJSON(res, 201, { success: true, message: msg, deliveryResult });
  }

  if (pathname.startsWith('/api/inbox/messages/') && pathname.endsWith('/approve-ai') && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const msgId = pathname.replace('/api/inbox/messages/', '').replace('/approve-ai', '');
    const body = await parseBody(req);

    const existingMsg = db.db.prepare('SELECT * FROM inbox_messages WHERE id = ? AND tenant_id = ?').get(msgId, user.tenantId);
    if (!existingMsg) return sendJSON(res, 404, { success: false, error: 'Mensaje no encontrado.' });
    const contact = db.db.prepare('SELECT * FROM contacts WHERE id = ? AND tenant_id = ?').get(existingMsg.contact_id, user.tenantId);

    const finalBody = String(body.editedReply || existingMsg.ai_suggested_reply || '').trim();
    let deliveryResult = { deliveryStatus: 'approved_channel_pending', metaMessageId: '' };
    if (existingMsg.channel === 'whatsapp') {
      deliveryResult = await dispatchRealWhatsAppText(user.tenantId, contact && contact.phone, finalBody);
    }

    try {
      const result = db.approveAISuggestion(user.tenantId, msgId, finalBody, user.name || 'Asesor', deliveryResult);
      return sendJSON(res, 200, { success: true, ...result, deliveryResult });
    } catch (err) {
      return sendJSON(res, 400, { success: false, error: err.message });
    }
  }

  if (pathname.startsWith('/api/inbox/messages/') && pathname.endsWith('/discard-ai') && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const msgId = pathname.replace('/api/inbox/messages/', '').replace('/discard-ai', '');
    const ok = db.discardAISuggestion(user.tenantId, msgId);
    return sendJSON(res, 200, { success: ok });
  }

  if (pathname === '/api/inbox/calendar' && method === 'GET') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const appointments = db.getCalendarAppointments(user.tenantId);
    return sendJSON(res, 200, { success: true, appointments });
  }

  if (pathname === '/api/inbox/calendar' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    const appointment = db.createCalendarAppointment(user.tenantId, body);
    return sendJSON(res, 201, { success: true, appointment });
  }

  if (pathname.startsWith('/api/inbox/calendar/') && method === 'DELETE') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const apptId = pathname.replace('/api/inbox/calendar/', '');
    const deleted = db.deleteCalendarAppointment(user.tenantId, apptId);
    return sendJSON(res, 200, { success: deleted });
  }

  // --- Estación 05: Marketing & Analítica (Parrilla IG/FB/TikTok, Campañas Ads, Permisos, Atribución Checkout y SEO) ---

  if (pathname === '/api/station5/workspace' && method === 'GET') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const q = parsedUrl.query || {};
    const workspace = db.getStation5Workspace(user.tenantId, user, {
      reqProto,
      reqHost,
      actorEmail: q.actorEmail || user.email,
      provider: q.provider || 'ALL',
      accountId: q.accountId || 'ALL',
      campaignId: q.campaignId || 'ALL',
      period: q.period || null,
      seoFilters: {
        period: q.seoPeriod || '28d',
        query: q.seoQuery || '',
        page: q.seoPage || '',
        device: q.seoDevice || 'ALL',
        country: q.seoCountry || 'ALL'
      }
    });
    return sendJSON(res, 200, { success: true, ...workspace });
  }

  if (pathname === '/api/station5/settings' && method === 'PUT') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    const settings = db.updateTenantMarketingSettings(user.tenantId, body);
    return sendJSON(res, 200, { success: true, settings });
  }

  if (pathname.startsWith('/api/station5/integrations/') && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const rest = pathname.replace('/api/station5/integrations/', '');
    const parts = rest.split('/');
    const provider = parts[0];
    const mode = parts[1]; // 'connect' | 'test' | 'disconnect'
    if (!provider || !['connect', 'test', 'disconnect'].includes(mode)) {
      return sendJSON(res, 400, { success: false, error: 'Operación de integración inválida.' });
    }
    const body = await parseBody(req);
    const resObj = db.connectOrTestMarketingProvider(user.tenantId, user, provider, mode, reqProto, reqHost, {
      actorEmail: body.actorEmail || user.email
    });
    return sendJSON(res, resObj.statusCode, { success: resObj.ok, ...resObj });
  }

  if (pathname === '/api/station5/social/posts' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    try {
      const post = db.createOrUpdateSocialPost(user.tenantId, user, body);
      return sendJSON(res, 201, { success: true, post });
    } catch (err) {
      return sendJSON(res, 400, { success: false, error: err.message });
    }
  }

  if (pathname.startsWith('/api/station5/social/posts/') && pathname.endsWith('/retry') && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const postId = pathname.replace('/api/station5/social/posts/', '').replace('/retry', '');
    const post = await db.retryOrPublishSocialPost(user.tenantId, user, postId);
    if (!post) return sendJSON(res, 404, { success: false, error: 'Publicación no encontrada.' });
    return sendJSON(res, 200, { success: post.status === 'publicada', post });
  }

  if (pathname.startsWith('/api/station5/social/posts/') && pathname.endsWith('/cancel') && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const postId = pathname.replace('/api/station5/social/posts/', '').replace('/cancel', '');
    const cancelled = db.cancelSocialPost(user.tenantId, postId);
    return sendJSON(res, 200, { success: cancelled });
  }

  if (pathname.startsWith('/api/station5/social/posts/') && method === 'PUT') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const postId = pathname.replace('/api/station5/social/posts/', '');
    const body = await parseBody(req);
    try {
      const post = db.createOrUpdateSocialPost(user.tenantId, user, { ...body, id: postId });
      return sendJSON(res, 200, { success: true, post });
    } catch (err) {
      return sendJSON(res, 400, { success: false, error: err.message });
    }
  }

  if (pathname.startsWith('/api/station5/social/reminders/') && method === 'PUT') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const remId = pathname.replace('/api/station5/social/reminders/', '');
    const ok = db.completeManualReminder(user.tenantId, remId);
    return sendJSON(res, 200, { success: ok });
  }

  if (pathname === '/api/station5/permissions' && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const body = await parseBody(req);
    try {
      const collaborators = db.updateCollaboratorPermissions(user.tenantId, user, body);
      return sendJSON(res, 200, { success: true, collaborators });
    } catch (err) {
      return sendJSON(res, 400, { success: false, error: err.message });
    }
  }

  if (pathname.startsWith('/api/station5/campaigns/') && pathname.endsWith('/action') && method === 'POST') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const campaignId = pathname.replace('/api/station5/campaigns/', '').replace('/action', '');
    const body = await parseBody(req);
    const result = await db.executeCampaignAction(user.tenantId, user, campaignId, body);
    return sendJSON(res, result.statusCode, { success: result.ok, ...result });
  }

  if (pathname.startsWith('/api/station5/orders/') && pathname.endsWith('/status') && method === 'PUT') {
    const user = authenticateRequest(req);
    if (!user) return sendJSON(res, 401, { success: false, error: 'No autenticado.' });
    const orderKey = pathname.replace('/api/station5/orders/', '').replace('/status', '');
    const body = await parseBody(req);
    try {
      const order = db.updateAttributedOrderStatus(user.tenantId, decodeURIComponent(orderKey), body.orderStatus);
      if (!order) return sendJSON(res, 404, { success: false, error: 'Orden atribuida no encontrada.' });
      return sendJSON(res, 200, { success: true, order });
    } catch (err) {
      return sendJSON(res, 400, { success: false, error: err.message });
    }
  }

  // --- 3. Page Access Gate & Static Files ---

  // Console Protection Gate
  if (pathname === '/console.html' || pathname === '/console') {
    const user = authenticateRequest(req);
    if (!user) {
      res.writeHead(302, { Location: '/login.html' });
      return res.end();
    }
  }

  // Login Redirection Gate
  if (pathname === '/login.html' || pathname === '/login') {
    const user = authenticateRequest(req);
    if (user) {
      res.writeHead(302, { Location: '/console.html' });
      return res.end();
    }
  }

  // Root mapping con Allowlist estricta (nunca exponer server/, data/, ECC/, scripts/, .db, .git)
  const rawRelPath = (pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  const normalizedRel = path.posix.normalize(rawRelPath);
  const isPublicRootAsset = ['index.html', 'login.html', 'console.html', 'easygrow-laptop.glb', 'easygrow-logo-badge.png', 'easygrow-logo-con-lema.svg', 'easygrow-logo-light.png', 'easygrow-shipping-photo.png'].includes(normalizedRel);
  const isPublicDir = normalizedRel.startsWith('css/') || normalizedRel.startsWith('js/') || normalizedRel === 'modules/modules.registry.json';

  if (normalizedRel.includes('..') || normalizedRel.startsWith('.') || (!isPublicRootAsset && !isPublicDir)) {
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<h1>403 - Acceso restringido</h1>');
  }

  const filePath = path.resolve(BASE_DIR, normalizedRel);
  if (!filePath.startsWith(BASE_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<h1>403 - Acceso restringido</h1>');
  }

  if (normalizedRel === 'console.html') {
    res.setHeader('Cache-Control', 'no-store');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404 - Archivo no encontrado en EasyGrow</h1>');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
  } catch (err) {
    logSecurityEvent('UNHANDLED_SERVER_ERROR', String(err && err.message ? err.message : 'Error interno'));
    if (!res.headersSent) {
      sendJSON(res, 500, { success: false, error: 'Error interno al procesar la solicitud.' });
    }
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 EasyGrow Server en línea en http://localhost:${PORT}`);
  console.log(`🛡️ Ciberseguridad Bancaria • SQLite WAL • WebSockets/SSE`);
  console.log(`👑 Admin inicial: admin@easygrow.co / Admin123*!`);
  console.log(`=======================================================`);
});
