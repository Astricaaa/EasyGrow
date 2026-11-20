const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
const registryPath = path.join(baseDir, 'modules', 'modules.registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

registry.forEach(mod => {
  const dir = path.join(baseDir, 'modules', mod.slug);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const cssContent = `/* Scoped CSS for Module: ${mod.slug} */
[data-module="${mod.slug}"] {
  --mod-accent: ${mod.modAccent || '#34C77B'};
}

[data-module="${mod.slug}"] .module-accent-border {
  border-left: 3px solid var(--mod-accent);
}
`;

  const jsContent = `/**
 * Module Controller: ${mod.slug}
 * EasyGrow Modular Architecture
 */
(function() {
  const moduleId = '${mod.slug}';
  
  function init() {
    if (window.EasyGrowEvents) {
      window.EasyGrowEvents.on('module:activated', function(activeId) {
        if (activeId === moduleId) {
          console.log('[Module ' + moduleId + '] Activado y en foco.');
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;

  const htmlContent = `<!-- Module Template: ${mod.slug} -->
<div class="module-content-wrapper" data-module="${mod.slug}">
  <div class="module-accent-border" style="padding-left: 1rem; margin-bottom: 1.5rem;">
    <h3 style="color: var(--mod-accent);">${mod.fullName || mod.name}</h3>
    <p style="color: var(--text-muted); font-size: 0.95rem;">${mod.summary}</p>
  </div>
</div>
`;

  fs.writeFileSync(path.join(dir, 'style.css'), cssContent, 'utf8');
  fs.writeFileSync(path.join(dir, 'module.js'), jsContent, 'utf8');
  fs.writeFileSync(path.join(dir, 'module.html'), htmlContent, 'utf8');
});

console.log('Successfully generated modular files for all 14 modules.');
