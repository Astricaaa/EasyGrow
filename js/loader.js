/**
 * EasyGrow Editorial Loading Screen & Real-Time Asset Preloader
 * 100% Original Implementation
 */

class EasyGrowLoader {
  constructor(options = {}) {
    this.storageKey = 'easygrow_intro_v2_seen';
    this.container = null;
    this.progressTrack = null;
    this.progressFill = null;
    this.percentText = null;
    this.statusText = null;
    this.stepNumText = null;

    this.progress = 0;
    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.startTime = Date.now();
    this.durationMs = options.durationMs || 3200; // Smooth editorial pacing on each page load
    this.assetsLoaded = false;

    this.stages = [
      { threshold: 0, step: '/ 01', text: 'Preparando tu experiencia...' },
      { threshold: 26, step: '/ 02', text: 'Sincronizando catálogo y rutas de envío...' },
      { threshold: 56, step: '/ 03', text: 'Cargando motor de fidelización y CRM...' },
      { threshold: 86, step: '/ 04', text: 'Finalizando detalles de tu espacio...' },
      { threshold: 100, step: '/ 04', text: 'Plataforma lista. Entrando...' }
    ];

    this.animFrameId = null;
    this.reducedTimerId = null;
  }

  shouldShow() {
    // Show on every page load/refresh outside the console
    return !window.location.pathname.toLowerCase().includes('console');
  }

  init() {
    if (!this.shouldShow()) {
      return false;
    }

    this.startTime = Date.now();
    this.buildDOM();
    this.preloadAssets();
    this.startProgressTimeline();
    return true;
  }

  buildDOM() {
    const overlay = document.createElement('div');
    overlay.id = 'easygrow-loader-overlay';
    overlay.className = 'loader-overlay';
    overlay.setAttribute('aria-live', 'polite');

    overlay.innerHTML = `
      <div class="loading-screen">
        <header class="topbar">
          <img
            class="brand"
            src="easygrow-logo-con-lema.svg"
            alt="EasyGrow. Fideliza clientes. Rastrea envíos."
          />
          <span class="topbar-note">UNA NUEVA FORMA DE CRECER</span>
        </header>

        <main class="loading-layout">
          <section class="loading-copy">
            <p class="eyebrow">INICIALIZANDO TU EXPERIENCIA <strong id="loader-step-num">/ 01</strong></p>

            <h1>Tu próximo<br />paso empieza<br />aquí.</h1>

            <p class="description">
              Estamos preparando un espacio para que tu<br class="desktop-break" />
              dinero trabaje con intención.
            </p>

            <div class="progress-heading">
              <span>CARGANDO PLATAFORMA</span>
              <strong id="progress-value">0%</strong>
            </div>

            <div
              class="progress-track"
              id="loader-progress-track"
              role="progressbar"
              aria-label="Carga de la plataforma"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="0"
            >
              <div class="progress-fill" id="loader-progress-fill" style="width: 0%"></div>
            </div>

            <p class="loading-status" id="loader-status-text">Preparando tu experiencia...</p>
          </section>

          <figure class="loading-image">
            <img
              src="easygrow-shipping-photo.png"
              alt="Paquete preparado para su envío junto a un computador"
            />
            <figcaption>Fideliza clientes. Rastrea envíos.</figcaption>
          </figure>
        </main>

        <footer class="footer">
          <span>EASYGROW CORE ENGINE</span>
          <span>UN MOMENTO. YA CASI.</span>
        </footer>
      </div>
    `;

    document.body.appendChild(overlay);
    this.container = overlay;
    this.progressTrack = overlay.querySelector('#loader-progress-track');
    this.progressFill = overlay.querySelector('#loader-progress-fill');
    this.percentText = overlay.querySelector('#progress-value');
    this.statusText = overlay.querySelector('#loader-status-text');
    this.stepNumText = overlay.querySelector('#loader-step-num');
  }

  preloadAssets() {
    const loadImage = (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = src;
      });

    const loadRegistry = fetch('modules/modules.registry.json')
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);

    Promise.all([
      loadImage('easygrow-shipping-photo.png'),
      loadImage('easygrow-logo-con-lema.svg'),
      loadRegistry
    ]).then(() => {
      this.assetsLoaded = true;
    });
  }

  updateUI(value) {
    const clamped = Math.max(0, Math.min(100, value));
    const displayVal = Math.floor(clamped);

    if (this.percentText) {
      this.percentText.textContent = `${displayVal}%`;
    }
    if (this.progressFill) {
      this.progressFill.style.width = `${clamped.toFixed(2)}%`;
    }
    if (this.progressTrack) {
      this.progressTrack.setAttribute('aria-valuenow', String(displayVal));
    }

    for (let i = this.stages.length - 1; i >= 0; i--) {
      if (displayVal >= this.stages[i].threshold) {
        if (this.statusText && this.statusText.textContent !== this.stages[i].text) {
          this.statusText.textContent = this.stages[i].text;
        }
        if (this.stepNumText && this.stepNumText.textContent !== this.stages[i].step) {
          this.stepNumText.textContent = this.stages[i].step;
        }
        break;
      }
    }
  }

  startProgressTimeline() {
    if (this.isReducedMotion) {
      // Static stepped increments without continuous animation for reduced motion
      const steps = [0, 26, 56, 86, 100];
      let idx = 0;
      const stepMs = Math.floor(this.durationMs / (steps.length - 1));
      this.updateUI(steps[0]);

      this.reducedTimerId = setInterval(() => {
        idx += 1;
        if (idx < steps.length) {
          this.progress = steps[idx];
          this.updateUI(this.progress);
        }
        if (idx >= steps.length - 1) {
          clearInterval(this.reducedTimerId);
          setTimeout(() => this.complete(), 300);
        }
      }, stepMs);
      return;
    }

    const tick = () => {
      const elapsed = Date.now() - this.startTime;
      const rawRatio = Math.min(1, elapsed / this.durationMs);
      // Ease-out cubic pacing for a natural editorial feel
      const easedRatio = 1 - Math.pow(1 - rawRatio, 2.2);
      let target = easedRatio * 100;

      // Wait briefly near 96% if assets are still loading (safety cap at +2s)
      if (!this.assetsLoaded && target > 96 && elapsed < this.durationMs + 2000) {
        target = 96;
      }

      this.progress += (target - this.progress) * 0.16;
      if (rawRatio >= 1 && (this.assetsLoaded || elapsed >= this.durationMs + 2000)) {
        if (this.progress > 99.4) {
          this.progress = 100;
        }
      }

      this.updateUI(this.progress);

      if (this.progress >= 100) {
        setTimeout(() => this.complete(), 280);
      } else {
        this.animFrameId = requestAnimationFrame(tick);
      }
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  complete() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.reducedTimerId) {
      clearInterval(this.reducedTimerId);
      this.reducedTimerId = null;
    }

    this.updateUI(100);
    sessionStorage.setItem(this.storageKey, 'true');

    if (this.container) {
      this.container.classList.add('loader-fade-out');
      setTimeout(() => {
        if (this.container && this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
        if (window.EasyGrowEvents) {
          window.EasyGrowEvents.emit('loader:completed');
        }
      }, 600);
    }
  }
}

window.EasyGrowLoader = EasyGrowLoader;
