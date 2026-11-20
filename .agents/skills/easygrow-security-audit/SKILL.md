---
name: easygrow-security-audit
description: Use when auditing EasyGrow code, hardening server endpoints, validating Excel/CSV uploads against trojans/macros/DDE formula injection, or cleaning unused legacy modules using ECC security standards.
---

# EasyGrow Security Audit & Upload Protection

Skill generada tras la auditoría del proyecto **EasyGrow** con base en los estándares de seguridad de [ECC/skills/security-review](../../ECC/skills/security-review/SKILL.md) y [ECC/agents/refactor-cleaner.md](../../ECC/agents/refactor-cleaner.md).

## Checklist de Seguridad del Proyecto

1. **Secretos y Criptografía ([server/crypto-auth.js](../../server/crypto-auth.js))**:
   - Nunca incluir secretos JWT ni claves literales en código fuente; resolver desde `process.env.JWT_SECRET` o archivo local protegido `data/.jwt_secret`.
   - Verificar longitud antes de `crypto.timingSafeEqual` para evitar excepciones por tamaño distinto.
   - Mantener cookies `HttpOnly`, `SameSite=Lax` y `Secure` en producción.

2. **Perímetro HTTP y Archivos Estáticos ([server.js](../../server.js))**:
   - Responder siempre con `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy` y `Cache-Control: no-store` en `/api/`.
   - Servir archivos estáticos exclusivamente mediante **allowlist explícita** (`index.html`, `login.html`, `console.html`, `css/`, `js/`, `modules/modules.registry.json`, assets públicos); bloquear acceso directo a `server/`, `data/`, `ECC/`, `scripts/`, `.db` y dotfiles.
   - Aplicar `checkRateLimit` en `/api/auth/login` y `/api/auth/register`.

3. **Filtro Anti-Troyanos y Sanitización de Cargas ([server/upload-security.js](../../server/upload-security.js))**:
   - Toda carga en `onInventoryFileSelected` y `onExcelFileSelected` ([js/console.js](../../js/console.js)) debe validarse antes vía `POST /api/security/inspect-upload`.
   - Reglas obligatorias del inspector:
     - Allowlist de extensiones (`.xlsx`, `.xls`, `.csv`), máx. 5 MB, bloqueo de dobles extensiones ejecutables (`.exe`, `.bat`, `.ps1`, `.vbs`, `.js`, `.xlsm`, etc.).
     - Verificación de **Magic Bytes** reales (`PK` para `.xlsx`, `OLE2` para `.xls`) y bloqueo de firmas ejecutables (`MZ`, `ELF`, `Mach-O`, `#!`).
     - Escaneo contra macros ocultas (`vbaProject.bin`, `_VBA_PROJECT`), objetos OLE (`xl/embeddings/`) y scripts (`<script>`, `<?php`, `WScript.Shell`).
     - Neutralización de Formula Injection (`=`, `+`, `@`) y sanitización de filas con `sanitizeImportRows` antes de guardar en SQLite.

4. **Higiene y Código Muerto**:
   - Verificar periódicamente con `Select-String` que no existan scripts o adaptadores huérfanos en `js/`, `server/` o `package.json`.

## Validación Automática

Ejecutar después de cualquier cambio en seguridad, rutas o carga de archivos:

```bash
npm run audit:security
```
