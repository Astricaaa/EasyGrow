/**
 * Module Controller: forms-surveys
 * EasyGrow Modular Architecture
 */
(function() {
  const moduleId = 'forms-surveys';
  
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
