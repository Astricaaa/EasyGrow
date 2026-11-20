/**
 * EasyGrow Upload Security & Anti-Trojan Inspector
 * Basado en ECC Security Review Checklist + OWASP File Upload Defense
 * - Allowlist estricta de extensiones (.xlsx, .xls, .csv)
 * - Inspección binaria de Magic Bytes y firmas de ejecutables/macros/OLE
 * - Protección contra CSV/Excel Formula Injection (DDE) y XSS
 */
const crypto = require('node:crypto');

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv']);
const DANGEROUS_EXT_REGEX = /\.(exe|dll|bat|cmd|ps1|vbs|vbe|js|jse|wsf|wsh|msi|msp|scr|pif|com|hta|cpl|jar|sh|bash|php|py|pl|rb|xlsm|xlsb|docm|pptm)$/i;

const MALICIOUS_BYTE_SIGNATURES = [
  { name: 'Ejecutable Windows PE/MZ', bytes: Buffer.from([0x4d, 0x5a]) },
  { name: 'Ejecutable Linux ELF', bytes: Buffer.from([0x7f, 0x45, 0x4c, 0x46]) },
  { name: 'Binario Mach-O', bytes: Buffer.from([0xfe, 0xed, 0xfa, 0xce]) },
  { name: 'Binario Mach-O 64', bytes: Buffer.from([0xfe, 0xed, 0xfa, 0xcf]) },
  { name: 'Binario Mach-O Universal', bytes: Buffer.from([0xca, 0xfe, 0xba, 0xbe]) },
  { name: 'Script Shebang (#!)', bytes: Buffer.from('#!', 'utf8') }
];

const SUSPICIOUS_ASCII_PATTERNS = [
  /vbaProject\.bin/i,
  /xl\/embeddings\//i,
  /xl\/activeX\//i,
  /_VBA_PROJECT/i,
  /<script[\s>]/i,
  /<\?php/i,
  /WScript\.Shell/i,
  /ActiveXObject/i,
  /powershell(\.exe)?\s+-/i,
  /cmd\.exe\s*\/c/i,
  /javascript:/i
];

function getFileExtension(fileName) {
  const clean = String(fileName || '').trim();
  const lastDot = clean.lastIndexOf('.');
  if (lastDot <= 0) return '';
  return clean.slice(lastDot).toLowerCase();
}

function inspectUploadedBuffer({ fileName, buffer, size }) {
  const cleanName = String(fileName || '').trim();
  if (!cleanName || cleanName.length > 200) {
    return { safe: false, code: 'INVALID_NAME', reason: 'Nombre de archivo inválido.' };
  }

  // Bloquear path traversal o dobles extensiones ejecutables (ej. reporte.exe.csv)
  if (cleanName.includes('..') || cleanName.includes('/') || cleanName.includes('\\')) {
    return { safe: false, code: 'PATH_TRAVERSAL', reason: 'El nombre del archivo contiene caracteres de ruta no permitidos.' };
  }
  const baseWithoutFinalExt = cleanName.replace(/\.[^.]+$/, '');
  if (DANGEROUS_EXT_REGEX.test(cleanName) || DANGEROUS_EXT_REGEX.test(baseWithoutFinalExt)) {
    return { safe: false, code: 'DANGEROUS_EXTENSION', reason: 'Archivo bloqueado por filtro anti-troyanos: extensión ejecutable o con macros no permitida.' };
  }

  const ext = getFileExtension(cleanName);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { safe: false, code: 'UNSUPPORTED_EXTENSION', reason: `Solo se permiten archivos ${Array.from(ALLOWED_EXTENSIONS).join(', ')}.` };
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { safe: false, code: 'EMPTY_FILE', reason: 'El archivo está vacío o no pudo leerse.' };
  }

  const actualSize = Number(size) || buffer.length;
  if (actualSize > MAX_UPLOAD_BYTES || buffer.length > MAX_UPLOAD_BYTES) {
    return { safe: false, code: 'FILE_TOO_LARGE', reason: 'El archivo supera el límite máximo permitido de 5 MB.' };
  }

  // 1. Verificar firmas de ejecutables al inicio del archivo
  for (const sig of MALICIOUS_BYTE_SIGNATURES) {
    if (buffer.length >= sig.bytes.length && buffer.subarray(0, sig.bytes.length).equals(sig.bytes)) {
      return { safe: false, code: 'EXECUTABLE_SIGNATURE', reason: `Archivo bloqueado: se detectó firma binaria de ${sig.name} disfrazada como ${ext}.` };
    }
  }

  // 2. Validar Magic Bytes reales según extensión
  if (ext === '.xlsx') {
    const pkHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    if (buffer.length < 4 || !buffer.subarray(0, 4).equals(pkHeader)) {
      return { safe: false, code: 'INVALID_MAGIC_BYTES', reason: 'El archivo .xlsx no posee una firma ZIP/OpenXML válida.' };
    }
  } else if (ext === '.xls') {
    const oleHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(oleHeader)) {
      return { safe: false, code: 'INVALID_MAGIC_BYTES', reason: 'El archivo .xls no posee una firma OLE2 válida.' };
    }
  } else if (ext === '.csv') {
    if (buffer.includes(0x00)) {
      return { safe: false, code: 'BINARY_IN_CSV', reason: 'Archivo .csv bloqueado: contiene bytes binarios nulos.' };
    }
  }

  // 3. Escanear contenido por macros VBA, OLE embebidos o scripts maliciosos
  const latin1View = buffer.toString('latin1');
  for (const pat of SUSPICIOUS_ASCII_PATTERNS) {
    if (pat.test(latin1View)) {
      return { safe: false, code: 'MALICIOUS_PAYLOAD', reason: `Archivo bloqueado por filtro anti-troyanos: se detectó contenido potencialmente malicioso (${pat.source}).` };
    }
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  return { safe: true, sha256, ext, bytes: buffer.length };
}

function neutralizeFormulaAndXss(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  let str = String(val)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script>/gi, '')
    .replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
    .trim();

  // Proteger contra CSV/Excel Formula Injection (DDE) si inicia con =, +, @ (excepto números negativos válidos)
  if (/^[=@\t\r]/.test(str) || (/^[+\-]/.test(str) && !/^[+\-]?\d+([.,]\d+)?$/.test(str))) {
    str = `'${str}`;
  }
  return str.slice(0, 1000);
}

function sanitizeImportRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 2000).map(row => {
    if (!row || typeof row !== 'object') return {};
    const clean = {};
    for (const [k, v] of Object.entries(row)) {
      const cleanKey = neutralizeFormulaAndXss(k).slice(0, 120);
      clean[cleanKey] = typeof v === 'number' ? v : neutralizeFormulaAndXss(v);
    }
    return clean;
  });
}

function isSafeHttpUrl(rawUrl, allowRelative = false) {
  const s = String(rawUrl || '').trim();
  if (!s) return true;
  if (allowRelative && s.startsWith('/') && !s.startsWith('//')) return true;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch (e) {
    return false;
  }
}

module.exports = {
  MAX_UPLOAD_BYTES,
  ALLOWED_EXTENSIONS,
  inspectUploadedBuffer,
  neutralizeFormulaAndXss,
  sanitizeImportRows,
  isSafeHttpUrl
};
