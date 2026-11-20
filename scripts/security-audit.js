/**
 * EasyGrow Security & Anti-Trojan Audit Runner (ECC Methodology)
 */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const uploadSecurity = require('../server/upload-security');

const ROOT = path.resolve(__dirname, '..');

function run() {
  console.log('=== EasyGrow Security Audit (ECC Standards) ===');

  // 1. Verificar eliminación de código muerto inseguro
  assert.strictEqual(fs.existsSync(path.join(ROOT, 'server', 'auth.js')), false, 'server/auth.js debe estar eliminado');
  assert.strictEqual(fs.existsSync(path.join(ROOT, 'js', 'dropi-adapter.js')), false, 'js/dropi-adapter.js debe estar eliminado');

  // 2. Verificar que no existan secretos JWT hardcodeados en server/
  const cryptoAuth = fs.readFileSync(path.join(ROOT, 'server', 'crypto-auth.js'), 'utf8');
  assert.strictEqual(/easygrow_futuristic_super_secret/.test(cryptoAuth), false, 'Secreto JWT hardcodeado detectado');

  // 3. Verificar allowlist de archivos estáticos y endpoint anti-troyano en server.js
  const serverCode = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(serverCode.includes('/api/security/inspect-upload'), 'Falta endpoint /api/security/inspect-upload');
  assert.ok(serverCode.includes('Content-Security-Policy'), 'Falta cabecera Content-Security-Policy');
  assert.ok(serverCode.includes('isPublicRootAsset'), 'Falta allowlist de archivos estáticos');

  // 4. Pruebas Anti-Troyanos en server/upload-security.js
  // 4a. Bloquear ejecutable Windows MZ renombrado a .xlsx
  const fakeExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
  const r1 = uploadSecurity.inspectUploadedBuffer({ fileName: 'catalogo.xlsx', buffer: fakeExe, size: fakeExe.length });
  assert.strictEqual(r1.safe, false, 'Debe bloquear ejecutable MZ disfrazado de .xlsx');

  // 4b. Bloquear doble extensión peligrosa (.exe.csv)
  const r2 = uploadSecurity.inspectUploadedBuffer({ fileName: 'clientes.exe.csv', buffer: Buffer.from('a,b\n1,2'), size: 7 });
  assert.strictEqual(r2.safe, false, 'Debe bloquear doble extensión .exe.csv');

  // 4c. Bloquear .xlsx con macros VBA embebidas (vbaProject.bin)
  const fakeZipMacro = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('xl/vbaProject.bin')]);
  const r3 = uploadSecurity.inspectUploadedBuffer({ fileName: 'ventas.xlsx', buffer: fakeZipMacro, size: fakeZipMacro.length });
  assert.strictEqual(r3.safe, false, 'Debe bloquear .xlsx con vbaProject.bin');

  // 4d. Bloquear CSV con payload XSS <script>
  const r4 = uploadSecurity.inspectUploadedBuffer({ fileName: 'leads.csv', buffer: Buffer.from('nombre\n<script>alert(1)</script>'), size: 32 });
  assert.strictEqual(r4.safe, false, 'Debe bloquear CSV con <script>');

  // 4e. Neutralizar Formula Injection (DDE)
  const cleanCell = uploadSecurity.neutralizeFormulaAndXss("=cmd|'/C calc'!A0");
  assert.ok(cleanCell.startsWith("'="), 'Debe neutralizar fórmula DDE peligrosa');

  // 4f. Permitir CSV limpio legítimo
  const r5 = uploadSecurity.inspectUploadedBuffer({ fileName: 'leads_limpio.csv', buffer: Buffer.from('nombre,valor\nAna,120000'), size: 23 });
  assert.strictEqual(r5.safe, true, 'Debe permitir CSV legítimo');

  console.log('ALL SECURITY CHECKS PASSED (6/6 anti-trojan & hardening assertions)');
}

run();
