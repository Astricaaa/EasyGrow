/**
 * EasyGrow 3D Interactive Studio Laptop (Blender-Grade PBR Model)
 * 100% Original Implementation
 * - Aluminio Space Black / Titanio cepillado con mapa de micro-rugosidad procedural
 * - Chasis Unibody CNC biselado, rejillas, puertos USB-C/MagSafe/HDMI y tornillos Torx
 * - Teclado chiclet PBT oscuro con leyendas reales + retroiluminación LED esmeralda + Trackpad vidrio
 * - Pantalla Retina 2K nítida (sin sobreexposición) con previsualización real de EasyGrow MOD-01.1
 * - Apertura/cierre suave en vivo conforme el cursor (pointermove), rueda, tacto y teclado
 */

class EasyGrowLaptopHero {
  constructor(containerId = 'laptop-canvas-container') {
    this.container = document.getElementById(containerId);
    this.loadingEl = document.getElementById('laptop-loading-indicator');

    this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isMobile = window.innerWidth < 768;
    this.hasWebGL = this.checkWebGLSupport();

    this.introProgress = this.isReducedMotion ? 1 : 0;
    this.introStartTime = null;
    this.introDurationMs = 900;

    // [0 = cerrado, 1 = abierto y activo]
    this.targetProgress = 0.35;
    this.currentProgress = 0.35;
    this.targetPointerX = 0;
    this.currentPointerX = 0;
    this.lastTouchY = null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.keyLight = null;
    this.rimLight = null;
    this.edgeLight = null;
    this.screenEmitLight = null;
    this.contactShadowMesh = null;
    this.studioFloorGlow = null;
    this.animFrameId = null;

    this.nodes = {
      LaptopRoot: null,
      LaptopBase: null,
      LidPivot: null,
      Screen: null,
      WebcamLed: null,
      BackLogoMat: null,
      keyRowsList: []
    };

    this.allMaterials = [];
    this.screenMaterial = null;
    this.screenTexture = null;
    this.modelLoaded = false;
  }

  checkWebGLSupport() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  easeOutCubic(t) {
    return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  init() {
    if (!this.container) return;
    this.bindInteractionControls();

    if (!this.hasWebGL || typeof THREE === 'undefined') {
      this.hideLoadingIndicator();
      this.renderFallback();
      return;
    }

    this.initThreeScene();
    this.buildPhotorealisticLaptop();
    this.startRenderLoop();
  }

  hideLoadingIndicator() {
    if (this.loadingEl) {
      this.loadingEl.classList.add('is-hidden');
    }
  }

  initThreeScene() {
    const width = this.container.clientWidth || 960;
    const height = this.container.clientHeight || 560;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(31, width / height, 0.1, 100);
    this.camera.position.set(0, 1.48, this.isMobile ? 5.85 : 4.75);
    this.camera.lookAt(0, 0.25, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.5 : 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.buildStudioEnvironment();

    // Iluminación balanceada de estudio fotográfico para metal oscuro y pantalla legible
    const hemiLight = new THREE.HemisphereLight(0xf6f8f6, 0xc8cdc7, 0.62);
    this.scene.add(hemiLight);

    const shadowRes = this.isMobile ? 1024 : 2048;
    this.keyLight = new THREE.DirectionalLight(0xfffaf2, 1.85);
    this.keyLight.position.set(3.6, 5.8, 4.4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.keyLight.shadow.camera.near = 1.0;
    this.keyLight.shadow.camera.far = 16.0;
    this.keyLight.shadow.camera.left = -2.8;
    this.keyLight.shadow.camera.right = 2.8;
    this.keyLight.shadow.camera.top = 2.8;
    this.keyLight.shadow.camera.bottom = -2.8;
    this.keyLight.shadow.bias = -0.00035;
    this.scene.add(this.keyLight);

    const fillLight = new THREE.DirectionalLight(0xe2ebe6, 0.72);
    fillLight.position.set(-4.5, 2.8, 3.2);
    this.scene.add(fillLight);

    this.rimLight = new THREE.DirectionalLight(0x1fa866, 0.95);
    this.rimLight.position.set(-3.6, 2.4, -4.2);
    this.scene.add(this.rimLight);

    this.edgeLight = new THREE.DirectionalLight(0xffffff, 1.45);
    this.edgeLight.position.set(4.2, 2.6, -3.5);
    this.scene.add(this.edgeLight);

    this.buildContactShadow();
    window.addEventListener('resize', () => this.onResize());
  }

  buildStudioEnvironment() {
    if (typeof THREE.PMREMGenerator !== 'function') return;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();

    // Softboxes contrastados para reflejos metálicos realistas en los biseles
    const studioScene = new THREE.Scene();
    studioScene.background = new THREE.Color(0x2b3036);

    const panelGeo = new THREE.PlaneGeometry(11, 7);
    const topBox = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    topBox.position.set(0, 5.6, 1.2);
    topBox.rotation.x = Math.PI * 0.5;
    studioScene.add(topBox);

    const leftStrip = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.2), new THREE.MeshBasicMaterial({ color: 0xe9efec, side: THREE.DoubleSide }));
    leftStrip.position.set(-6.0, 2.6, 1.0);
    leftStrip.rotation.y = Math.PI * 0.5;
    studioScene.add(leftStrip);

    const rightAccent = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.0), new THREE.MeshBasicMaterial({ color: 0x34c77b, side: THREE.DoubleSide }));
    rightAccent.position.set(6.0, 2.1, -1.4);
    rightAccent.rotation.y = -Math.PI * 0.5;
    studioScene.add(rightAccent);

    const frontHorizon = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), new THREE.MeshBasicMaterial({ color: 0xd9ded9, side: THREE.DoubleSide }));
    frontHorizon.position.set(0, 1.8, 6.2);
    studioScene.add(frontHorizon);

    const envRT = pmrem.fromScene(studioScene, 0.03);
    this.scene.environment = envRT.texture;
    pmrem.dispose();
  }

  buildContactShadow() {
    const catchGeo = new THREE.PlaneGeometry(14, 12);
    const catchMat = new THREE.ShadowMaterial({ opacity: 0.28 });
    const shadowCatcher = new THREE.Mesh(catchGeo, catchMat);
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = -0.02;
    shadowCatcher.receiveShadow = true;
    this.scene.add(shadowCatcher);

    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fctx = floorCanvas.getContext('2d');
    const fGrad = fctx.createRadialGradient(256, 256, 20, 256, 256, 250);
    fGrad.addColorStop(0, 'rgba(17, 17, 17, 0.12)');
    fGrad.addColorStop(0.5, 'rgba(31, 168, 102, 0.05)');
    fGrad.addColorStop(1, 'rgba(248, 248, 246, 0.0)');
    fctx.fillStyle = fGrad;
    fctx.fillRect(0, 0, 512, 512);

    this.studioFloorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(8.6, 6.4),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(floorCanvas), transparent: true, depthWrite: false, opacity: 0.9 })
    );
    this.studioFloorGlow.rotation.x = -Math.PI / 2;
    this.studioFloorGlow.position.y = -0.022;
    this.scene.add(this.studioFloorGlow);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 30, 128, 128, 122);
    grad.addColorStop(0, 'rgba(10, 12, 14, 0.56)');
    grad.addColorStop(0.52, 'rgba(10, 12, 14, 0.22)');
    grad.addColorStop(1, 'rgba(10, 12, 14, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    this.contactShadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4.3, 3.0),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, opacity: 1.0 })
    );
    this.contactShadowMesh.rotation.x = -Math.PI / 2;
    this.contactShadowMesh.position.y = -0.019;
    this.scene.add(this.contactShadowMesh);
  }

  createBrushedMetalTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y++) {
      const v = 116 + Math.floor(Math.random() * 26);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, 512, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  createKeyLegendTexture(label) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#121417';
    ctx.fillRect(0, 0, 128, 128);
    // Sutil marco biselado en la tecla
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 120, 120);
    if (label) {
      ctx.fillStyle = '#D1D5DB';
      ctx.font = label.length > 2 ? 'bold 24px system-ui, sans-serif' : 'bold 38px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 64, 66);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  createRoundedRectShape(w, h, r) {
    const shape = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
  }

  createScreenDashboardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d');

    // Fondo real de EasyGrow Console (#F5F6F3)
    ctx.fillStyle = '#F5F6F3';
    ctx.fillRect(0, 0, 2048, 1280);

    // Sidebar izquierdo
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 390, 1280);
    ctx.fillStyle = '#D7D7D3';
    ctx.fillRect(390, 0, 2, 1280);

    // Logo EasyGrow
    ctx.fillStyle = '#1FA866';
    ctx.beginPath();
    ctx.arc(62, 62, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText('EasyGrow', 98, 73);

    const groups = [
      { head: '01. GERENCIA & CALENDARIO', items: ['1. Dashboard de Objetivos', '2. Calendario & Agenda'], active: 0 },
      { head: '02. COMERCIO & LOGÍSTICA', items: ['Catálogo REA & Despacho', 'Guías & Transportadoras'], active: -1 },
      { head: '03. VENTAS & CRM', items: ['Pipeline CRM & Clientes', 'Fórmulas & Directorio B2B'], active: -1 },
      { head: '04. CAPTACIÓN & QRS', items: ['Formularios & Clasificación', 'Códigos QR Dinámicos'], active: -1 },
      { head: '05. ATENCIÓN & WHATSAPP', items: ['1. Bandeja de Mensajes', '2. WhatsApp & Llamadas'], active: -1 }
    ];
    let sy = 140;
    groups.forEach((grp) => {
      ctx.fillStyle = '#6B7280';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(grp.head, 28, sy);
      sy += 34;
      grp.items.forEach((it, idx) => {
        if (grp.active === idx) {
          ctx.fillStyle = 'rgba(31, 168, 102, 0.14)';
          ctx.fillRect(20, sy - 26, 350, 44);
          ctx.fillStyle = '#1FA866';
          ctx.fillRect(20, sy - 26, 5, 44);
          ctx.fillStyle = '#111111';
          ctx.font = 'bold 21px system-ui, sans-serif';
        } else {
          ctx.fillStyle = '#4B5563';
          ctx.font = '600 20px system-ui, sans-serif';
        }
        ctx.fillText(it, 42, sy + 4);
        sy += 52;
      });
      sy += 18;
    });

    // Topbar
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(392, 0, 1656, 86);
    ctx.fillStyle = '#D7D7D3';
    ctx.fillRect(392, 86, 1656, 2);

    ctx.fillStyle = '#111111';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('01. Gerencia & Calendario  /  Dashboard de Objetivos Gerenciales', 436, 52);

    ctx.fillStyle = 'rgba(31, 168, 102, 0.14)';
    ctx.fillRect(1690, 20, 310, 46);
    ctx.fillStyle = '#1FA866';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('● EN LÍNEA • AUDITORÍA', 1712, 51);

    // Encabezado MOD-01.1
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(432, 114, 1572, 102);
    ctx.strokeStyle = '#D7D7D3';
    ctx.lineWidth = 2;
    ctx.strokeRect(432, 114, 1572, 102);
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(458, 134, 118, 28);
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 17px monospace';
    ctx.fillText('MOD-01.1', 474, 154);
    ctx.font = 'bold 29px system-ui, sans-serif';
    ctx.fillText('Dashboard de Objetivos Gerenciales y Cumplimiento', 596, 158);
    ctx.fillStyle = '#525860';
    ctx.font = '500 20px system-ui, sans-serif';
    ctx.fillText('Metas conectadas en vivo a ventas, cierres CRM, entregas logísticas y atención WhatsApp.', 458, 196);

    // 4 KPI Cards reales
    const kpis = [
      { lbl: 'CUMPLIMIENTO GLOBAL', val: '86%', sub: 'Promedio de 4 metas', accent: '#1FA866' },
      { lbl: 'EN META (VERDE)', val: '3', sub: 'Avance igual o ≥ 80%', accent: '#1FA866' },
      { lbl: 'EN SEGUIMIENTO', val: '1', sub: 'Requiere foco', accent: '#D97706' },
      { lbl: 'VENTAS VS. META', val: '$18.450.000', sub: '92% del objetivo', accent: '#111111' }
    ];
    kpis.forEach((k, idx) => {
      const x = 432 + idx * 398;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, 238, 376, 156);
      ctx.strokeStyle = '#D7D7D3';
      ctx.strokeRect(x, 238, 376, 156);

      ctx.fillStyle = '#6B7280';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(k.lbl, x + 24, 276);

      ctx.fillStyle = k.accent;
      ctx.font = 'bold 42px monospace';
      ctx.fillText(k.val, x + 24, 334);

      ctx.fillStyle = '#4B5563';
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillText(k.sub, x + 24, 372);
    });

    // Gráfica real comparativa de cumplimiento por objetivo vs umbral 80%
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(432, 418, 1572, 456);
    ctx.strokeStyle = '#D7D7D3';
    ctx.strokeRect(432, 418, 1572, 456);
    ctx.fillStyle = '#F4F5F2';
    ctx.fillRect(432, 418, 1572, 56);
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('Gráfica Comparativa de Cumplimiento por Objetivo vs. Umbral (80%)', 462, 454);

    // Líneas guía horizontales + línea meta 80%
    const plotTop = 516;
    const plotBottom = 796;
    const plotH = plotBottom - plotTop;
    [0, 25, 50, 75, 100].forEach(pct => {
      const gy = plotBottom - (pct / 100) * plotH;
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(510, gy);
      ctx.lineTo(1955, gy);
      ctx.stroke();
      ctx.fillStyle = '#6B7280';
      ctx.font = 'bold 17px monospace';
      ctx.fillText(`${pct}%`, 452, gy + 6);
    });

    const threshY = plotBottom - 0.8 * plotH;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(510, threshY);
    ctx.lineTo(1955, threshY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('META MÍNIMA 80%', 1785, threshY - 10);

    const chartBars = [
      { label: 'Ventas COP', pct: 92, color: '#1FA866' },
      { label: 'Cierres CRM', pct: 84, color: '#1FA866' },
      { label: 'Guías a Tiempo', pct: 95, color: '#1FA866' },
      { label: 'Atención WA', pct: 74, color: '#D97706' },
      { label: 'Captación QRs', pct: 88, color: '#1FA866' },
      { label: 'ROAS Campañas', pct: 81, color: '#1FA866' }
    ];
    const pts = [];
    chartBars.forEach((b, idx) => {
      const bx = 575 + idx * 230;
      const bw = 112;
      const bh = (b.pct / 100) * plotH;
      const by = plotBottom - bh;

      ctx.fillStyle = '#F3F4F0';
      ctx.fillRect(bx, plotTop, bw, plotH);
      ctx.fillStyle = b.color;
      ctx.fillRect(bx, by, bw, bh);

      ctx.fillStyle = '#111111';
      ctx.font = 'bold 21px monospace';
      ctx.fillText(`${b.pct}%`, bx + 30, by - 12);
      ctx.fillStyle = '#374151';
      ctx.font = '600 19px system-ui, sans-serif';
      ctx.fillText(b.label, bx - 4, 836);

      pts.push([bx + bw / 2, by]);
    });

    ctx.strokeStyle = 'rgba(17,17,17,0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.stroke();

    // Tabla inferior ERP real
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(432, 900, 1572, 336);
    ctx.strokeStyle = '#D7D7D3';
    ctx.strokeRect(432, 900, 1572, 336);
    ctx.fillStyle = '#F4F5F2';
    ctx.fillRect(432, 900, 1572, 56);
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText('OBJETIVO GERENCIAL                       ÁREA                          RESPONSABLE                 AVANCE      SEMÁFORO', 462, 935);

    const rows = [
      ['Meta de Ventas Mensuales (COP)', 'Ventas & CRM', 'Dirección Comercial', '92%', 'EN META'],
      ['Cierres Comerciales Ganados', 'Ventas & CRM', 'Equipo Comercial', '84%', 'EN META'],
      ['Guías Entregadas a Tiempo', 'Comercio & Logística', 'Coord. Logístico', '95%', 'EN META'],
      ['Atención Omnicanal & Captación', 'Atención & WhatsApp', 'Equipo Atención', '74%', 'EN PROGRESO']
    ];
    rows.forEach((r, idx) => {
      const ry = 1004 + idx * 62;
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(r[0], 462, ry);
      ctx.fillStyle = '#4B5563';
      ctx.font = '500 19px system-ui, sans-serif';
      ctx.fillText(r[1], 920, ry);
      ctx.fillText(r[2], 1240, ry);
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(r[3], 1570, ry);
      ctx.fillStyle = idx < 3 ? '#1FA866' : '#D97706';
      ctx.fillText(r[4], 1730, ry);
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy() || 1, 8);
    tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
    this.screenTexture = tex;
    return tex;
  }

  trackMaterial(mat) {
    mat.transparent = true;
    mat.userData = {
      baseOpacity: mat.opacity !== undefined ? mat.opacity : 1.0,
      baseEmissiveIntensity: mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 0.0
    };
    this.allMaterials.push(mat);
    return mat;
  }

  buildPhotorealisticLaptop() {
    const root = new THREE.Group();
    root.name = 'LaptopRoot';
    this.scene.add(root);
    this.nodes.LaptopRoot = root;

    const brushedTex = this.createBrushedMetalTexture();

    // Aluminio Space Black / Titanio cepillado realista (mucho más contrastado que gris lavado)
    const matAluminum = this.trackMaterial(new THREE.MeshPhysicalMaterial({
      color: 0x1e2227,
      metalness: 0.90,
      roughness: 0.28,
      roughnessMap: brushedTex,
      bumpMap: brushedTex,
      bumpScale: 0.0015,
      clearcoat: 0.25,
      clearcoatRoughness: 0.22
    }));

    const matAluminumTrim = this.trackMaterial(new THREE.MeshPhysicalMaterial({
      color: 0x3b414a,
      metalness: 0.95,
      roughness: 0.16,
      clearcoat: 0.4
    }));

    const matAluminumDark = this.trackMaterial(new THREE.MeshPhysicalMaterial({
      color: 0x111316,
      metalness: 0.82,
      roughness: 0.36
    }));

    const matRubber = this.trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x090a0c,
      metalness: 0.04,
      roughness: 0.92
    }));

    const matGlassBezel = this.trackMaterial(new THREE.MeshPhysicalMaterial({
      color: 0x050608,
      metalness: 0.08,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03
    }));

    const matTrackpad = this.trackMaterial(new THREE.MeshPhysicalMaterial({
      color: 0x171a1e,
      metalness: 0.35,
      roughness: 0.12,
      clearcoat: 0.88,
      clearcoatRoughness: 0.08
    }));

    const matPortDark = this.trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x060708,
      metalness: 0.2,
      roughness: 0.7
    }));

    // === 1. BASE UNIBODY CNC ===
    const baseGroup = new THREE.Group();
    baseGroup.name = 'LaptopBase';
    root.add(baseGroup);
    this.nodes.LaptopBase = baseGroup;

    const baseW = 3.16;
    const baseD = 2.16;
    const baseH = 0.072;
    const baseShape = this.createRoundedRectShape(baseW, baseD, 0.11);
    const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
      depth: baseH,
      bevelEnabled: true,
      bevelThickness: 0.016,
      bevelSize: 0.016,
      bevelSegments: 6,
      curveSegments: 18
    });
    baseGeo.rotateX(Math.PI / 2);
    const baseMesh = new THREE.Mesh(baseGeo, matAluminum);
    baseMesh.position.y = baseH + 0.016;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    baseGroup.add(baseMesh);

    // Patas de goma + tornillos Torx discretos en base
    const footGeo = new THREE.CylinderGeometry(0.085, 0.095, 0.014, 24);
    [[-1.25, -0.82], [1.25, -0.82], [-1.25, 0.82], [1.25, 0.82]].forEach(([fx, fz]) => {
      const foot = new THREE.Mesh(footGeo, matRubber);
      foot.position.set(fx, -0.006, fz);
      baseGroup.add(foot);
    });

    // Muesca ergonómica frontal pulida
    const notchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.024, 0.08), matAluminumDark);
    notchMesh.position.set(0, baseH + 0.022, baseD / 2 - 0.02);
    baseGroup.add(notchMesh);

    // Puertos detallados (marco metálico + cavidad oscura interna)
    const portFrameGeo = new THREE.BoxGeometry(0.022, 0.026, 0.092);
    const portCoreGeo = new THREE.BoxGeometry(0.026, 0.016, 0.072);
    [-0.58, -0.40, -0.22].forEach(pz => {
      const pf = new THREE.Mesh(portFrameGeo, matAluminumTrim);
      pf.position.set(-baseW / 2 - 0.01, baseH * 0.56, pz);
      const pc = new THREE.Mesh(portCoreGeo, matPortDark);
      pc.position.set(-baseW / 2 - 0.011, baseH * 0.56, pz);
      baseGroup.add(pf, pc);
    });
    const hdmiFrame = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.028, 0.135), matAluminumTrim);
    hdmiFrame.position.set(baseW / 2 + 0.01, baseH * 0.56, -0.45);
    const hdmiCore = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.018, 0.11), matPortDark);
    hdmiCore.position.set(baseW / 2 + 0.011, baseH * 0.56, -0.45);
    baseGroup.add(hdmiFrame, hdmiCore);

    const jackRing = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.022, 16), matAluminumTrim);
    jackRing.rotation.z = Math.PI / 2;
    jackRing.position.set(baseW / 2 + 0.01, baseH * 0.56, -0.22);
    baseGroup.add(jackRing);

    // Hueco fresado del teclado (keyboard well) + rejillas perforadas laterales
    const wellMesh = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.01, 0.98), matAluminumDark);
    wellMesh.position.set(0, baseH + 0.029, -0.30);
    wellMesh.receiveShadow = true;
    baseGroup.add(wellMesh);

    const speakerGeo = new THREE.BoxGeometry(0.16, 0.004, 0.92);
    [-1.41, 1.41].forEach(sx => {
      const spk = new THREE.Mesh(speakerGeo, matRubber);
      spk.position.set(sx, baseH + 0.031, -0.30);
      baseGroup.add(spk);
    });

    // Trackpad de vidrio con bisel metálico fino
    const tpBorder = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.006, 0.70), matAluminumTrim);
    tpBorder.position.set(0, baseH + 0.029, 0.59);
    const trackpadMesh = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.008, 0.68), matTrackpad);
    trackpadMesh.position.set(0, baseH + 0.030, 0.59);
    trackpadMesh.receiveShadow = true;
    baseGroup.add(tpBorder, trackpadMesh);

    // Teclado QWERTY con leyendas reales + retroiluminación LED esmeralda
    const keyRowsLegends = [
      ['esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', '⏻'],
      ['°', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '¿', '⌫'],
      ['⇥', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '`', '+', '}'],
      ['⇪', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ', '{', '⏎'],
      ['⇧', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '-', '⇧']
    ];
    const rowConfigs = [
      { z: -0.70, width: 0.155, gap: 0.022, legends: keyRowsLegends[0] },
      { z: -0.545, width: 0.155, gap: 0.022, legends: keyRowsLegends[1] },
      { z: -0.39, width: 0.155, gap: 0.022, legends: keyRowsLegends[2] },
      { z: -0.235, width: 0.168, gap: 0.022, legends: keyRowsLegends[3] },
      { z: -0.08, width: 0.184, gap: 0.022, legends: keyRowsLegends[4] },
      { z: 0.075, hasSpacebar: true }
    ];

    const keySideMat = this.trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x0d0f12,
      metalness: 0.05,
      roughness: 0.72
    }));

    const blankKeyTopMat = this.trackMaterial(new THREE.MeshStandardMaterial({
      map: this.createKeyLegendTexture(''),
      roughness: 0.55,
      metalness: 0.04
    }));

    rowConfigs.forEach((rc, rIdx) => {
      const glowMat = this.trackMaterial(new THREE.MeshStandardMaterial({
        color: 0x0a1c13,
        emissive: 0x1fa866,
        emissiveIntensity: 0.02,
        roughness: 0.4
      }));
      const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.003, 0.118), glowMat);
      glowStrip.position.set(0, baseH + 0.032, rc.z);
      baseGroup.add(glowStrip);
      this.nodes.keyRowsList.push({ index: rIdx + 1, node: glowStrip });

      if (rc.hasSpacebar) {
        const specs = [
          { x: -1.07, w: 0.24, lbl: 'fn' }, { x: -0.78, w: 0.24, lbl: 'ctrl' }, { x: -0.50, w: 0.22, lbl: '⌘' },
          { x: 0.0, w: 0.72, lbl: '' },
          { x: 0.50, w: 0.22, lbl: '⌘' }, { x: 0.78, w: 0.24, lbl: 'alt' }, { x: 1.07, w: 0.24, lbl: '◀▶' }
        ];
        specs.forEach(sp => {
          const topMat = sp.lbl ? this.trackMaterial(new THREE.MeshStandardMaterial({
            map: this.createKeyLegendTexture(sp.lbl),
            roughness: 0.55
          })) : blankKeyTopMat;
          const mats = [keySideMat, keySideMat, topMat, keySideMat, keySideMat, keySideMat];
          const key = new THREE.Mesh(new THREE.BoxGeometry(sp.w, 0.016, 0.11), mats);
          key.position.set(sp.x, baseH + 0.040, rc.z);
          key.castShadow = true;
          baseGroup.add(key);
        });
      } else {
        const count = rc.legends.length;
        const totalSpan = count * rc.width + (count - 1) * rc.gap;
        const startX = -totalSpan / 2 + rc.width / 2;
        for (let k = 0; k < count; k++) {
          const kx = startX + k * (rc.width + rc.gap);
          const topMat = this.trackMaterial(new THREE.MeshStandardMaterial({
            map: this.createKeyLegendTexture(rc.legends[k]),
            roughness: 0.55
          }));
          const mats = [keySideMat, keySideMat, topMat, keySideMat, keySideMat, keySideMat];
          const key = new THREE.Mesh(new THREE.BoxGeometry(rc.width, 0.016, 0.112), mats);
          key.position.set(kx, baseH + 0.040, rc.z);
          key.castShadow = true;
          baseGroup.add(key);
        }
      }
    });

    // === 2. BISAGRA ARTICULADA Y TAPA DE PANTALLA ===
    const lidPivot = new THREE.Group();
    lidPivot.name = 'LidPivot';
    lidPivot.position.set(0, baseH + 0.03, -baseD / 2 + 0.055);
    root.add(lidPivot);
    this.nodes.LidPivot = lidPivot;

    const hingeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 2.28, 28), matAluminumDark);
    hingeMesh.rotation.z = Math.PI / 2;
    lidPivot.add(hingeMesh);

    const lidW = baseW;
    const lidH = baseD;
    const lidThick = 0.030;

    const lidShape = this.createRoundedRectShape(lidW, lidH, 0.11);
    const lidGeo = new THREE.ExtrudeGeometry(lidShape, {
      depth: lidThick,
      bevelEnabled: true,
      bevelThickness: 0.010,
      bevelSize: 0.010,
      bevelSegments: 6,
      curveSegments: 18
    });
    lidGeo.rotateX(Math.PI / 2);
    const lidShell = new THREE.Mesh(lidGeo, matAluminum);
    lidShell.position.set(0, lidThick + 0.018, lidH / 2 - 0.055);
    lidShell.castShadow = true;
    lidShell.receiveShadow = true;
    lidPivot.add(lidShell);

    // Goma selladora perimetral fina entre tapa y cristal
    const gasket = new THREE.Mesh(new THREE.BoxGeometry(lidW - 0.04, 0.005, lidH - 0.04), matRubber);
    gasket.position.set(0, 0.006, lidH / 2 - 0.055);
    lidPivot.add(gasket);

    // Logo trasero EasyGrow
    const backLogoMat = this.trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x34c77b,
      emissive: 0x1fa866,
      emissiveIntensity: 0.35,
      metalness: 0.75,
      roughness: 0.22
    }));
    this.nodes.BackLogoMat = backLogoMat;
    const backLogo = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.16, 36), backLogoMat);
    backLogo.rotation.x = -Math.PI / 2;
    backLogo.position.set(0, lidThick + 0.029, lidH / 2 - 0.055);
    lidPivot.add(backLogo);

    // Bisel de cristal negro alrededor de la pantalla
    const bezelMesh = new THREE.Mesh(new THREE.BoxGeometry(lidW - 0.075, 0.007, lidH - 0.075), matGlassBezel);
    bezelMesh.position.set(0, 0.003, lidH / 2 - 0.055);
    lidPivot.add(bezelMesh);

    // Cámara web lente zafiro + LED verde indicador
    const camLensMat = this.trackMaterial(new THREE.MeshPhysicalMaterial({
      color: 0x102848,
      metalness: 0.2,
      roughness: 0.05,
      clearcoat: 1.0
    }));
    const camRing = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.009, 16), camLensMat);
    camRing.position.set(0, 0.0005, lidH - 0.125);
    lidPivot.add(camRing);

    const camLedMat = this.trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x1fa866,
      emissive: 0x34c77b,
      emissiveIntensity: 0.1
    }));
    const camLed = new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 12), camLedMat);
    camLed.position.set(0.04, 0.0005, lidH - 0.125);
    lidPivot.add(camLed);
    this.nodes.WebcamLed = camLed;

    // Pantalla OLED 2K balanceada (colores nítidos sin quemar blancos)
    const screenTex = this.createScreenDashboardTexture();
    const screenMat = this.trackMaterial(new THREE.MeshPhysicalMaterial({
      color: 0xcfd4d0,
      map: screenTex,
      emissiveMap: screenTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.56,
      roughness: 0.12,
      metalness: 0.04,
      clearcoat: 0.9,
      clearcoatRoughness: 0.06
    }));
    this.screenMaterial = screenMat;

    const screenGeo = new THREE.PlaneGeometry(lidW - 0.185, lidH - 0.205);
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.rotation.x = Math.PI / 2;
    screenMesh.position.set(0, -0.0015, lidH / 2 - 0.06);
    lidPivot.add(screenMesh);
    this.nodes.Screen = screenMesh;

    this.screenEmitLight = new THREE.PointLight(0xd9f7e8, 0.0, 3.0);
    this.screenEmitLight.position.set(0, 0.72, -0.45);
    root.add(this.screenEmitLight);

    this.modelLoaded = true;
    this.hideLoadingIndicator();

    if (!this.isReducedMotion) {
      this.introProgress = 0;
      this.introStartTime = performance.now();
    } else {
      this.introProgress = 1;
    }
    this.applySequenceAtProgress(this.currentProgress);
  }

  setTargetProgress(next) {
    const clamped = Math.max(0, Math.min(1, next));
    this.targetProgress = clamped;
    if (this.container) {
      this.container.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
    }
    if (this.isReducedMotion) {
      this.currentProgress = clamped;
      this.applySequenceAtProgress(this.currentProgress);
    }
  }

  bindInteractionControls() {
    this.container.addEventListener(
      'pointermove',
      (e) => {
        if (this.isReducedMotion) return;
        const rect = this.container.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const normY = (e.clientY - rect.top) / rect.height;
        const openRatio = Math.max(0, Math.min(1, 1.06 - normY * 1.18));
        this.targetPointerX = Math.max(-1, Math.min(1, normX));
        this.setTargetProgress(openRatio);
      },
      { passive: true }
    );

    this.container.addEventListener('pointerleave', () => {
      this.targetPointerX = 0;
    }, { passive: true });

    this.container.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        let normalizedDelta = e.deltaY;
        if (e.deltaMode === 1) normalizedDelta *= 28;
        else if (e.deltaMode === 2) normalizedDelta *= 300;
        const step = Math.max(-0.06, Math.min(0.06, normalizedDelta * 0.0006));
        this.setTargetProgress(this.targetProgress + step);
      },
      { passive: false }
    );

    this.container.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 1) this.lastTouchY = e.touches[0].clientY;
    }, { passive: true });

    this.container.addEventListener('touchmove', (e) => {
      if (!e.touches || e.touches.length !== 1 || this.lastTouchY === null) return;
      const currentY = e.touches[0].clientY;
      const deltaY = this.lastTouchY - currentY;
      this.lastTouchY = currentY;
      if ((this.targetProgress <= 0.001 && deltaY < 0) || (this.targetProgress >= 0.999 && deltaY > 0)) return;
      e.preventDefault();
      e.stopPropagation();
      this.setTargetProgress(this.targetProgress + Math.max(-0.06, Math.min(0.06, deltaY * 0.0024)));
    }, { passive: false });

    this.container.addEventListener('touchend', () => { this.lastTouchY = null; }, { passive: true });

    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.setTargetProgress(this.targetProgress + 0.08);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.setTargetProgress(this.targetProgress - 0.08);
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.setTargetProgress(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        this.setTargetProgress(1);
      }
    });
  }

  applySequenceAtProgress(p) {
    if (!this.modelLoaded || !this.nodes.LaptopRoot) {
      this.updateFallbackVisuals(p);
      return;
    }

    const intro = this.easeOutCubic(this.introProgress);
    const root = this.nodes.LaptopRoot;

    const entryScale = this.lerp(0.92, 1.0, intro);
    const entryOffsetY = this.lerp(-0.16, 0.0, intro);

    const baseRotY = this.lerp(-0.42, 0.0, this.smoothstep(0.0, 0.45, p));
    const rotY = baseRotY + this.currentPointerX * 0.34;
    const rotX = this.lerp(0.16, 0.06, this.smoothstep(0.0, 0.65, p));

    root.visible = intro > 0.01;
    root.scale.setScalar(entryScale);
    root.position.set(0, entryOffsetY, 0);
    root.rotation.set(rotX, rotY, 0);

    const tLidOpen = this.smoothstep(0.04, 0.82, p);
    if (this.nodes.LidPivot) {
      this.nodes.LidPivot.rotation.x = -1.78 * tLidOpen;
    }

    for (let i = 0; i < this.allMaterials.length; i++) {
      const m = this.allMaterials[i];
      const baseOp = m.userData ? m.userData.baseOpacity : 1.0;
      m.opacity = baseOp * intro;
    }

    if (this.studioFloorGlow && this.studioFloorGlow.material) {
      this.studioFloorGlow.material.opacity = intro * this.lerp(0.85, 1.0, tLidOpen);
      this.studioFloorGlow.scale.setScalar(this.lerp(0.96, 1.06, tLidOpen));
    }

    if (this.contactShadowMesh && this.contactShadowMesh.material) {
      this.contactShadowMesh.material.opacity = intro * this.lerp(0.92, 1.0, tLidOpen);
    }

    const tScreenGlow = this.smoothstep(0.26, 0.78, p);
    if (this.screenMaterial) {
      this.screenMaterial.emissiveIntensity = this.lerp(0.04, 0.58, tScreenGlow);
    }
    if (this.screenEmitLight) {
      this.screenEmitLight.intensity = this.lerp(0.0, 0.45, tScreenGlow);
    }
    if (this.nodes.WebcamLed && this.nodes.WebcamLed.material) {
      this.nodes.WebcamLed.material.emissiveIntensity = this.lerp(0.05, 1.4, tScreenGlow);
    }
    if (this.nodes.BackLogoMat) {
      this.nodes.BackLogoMat.emissiveIntensity = this.lerp(0.18, 0.65, tLidOpen);
    }

    this.nodes.keyRowsList.forEach(({ index, node }) => {
      const start = 0.25 + (index - 1) * 0.06;
      const end = start + 0.2;
      const glow = this.smoothstep(start, end, p);
      if (node.material) {
        node.material.emissiveIntensity = this.lerp(0.02, 1.2, glow);
      }
    });

    if (this.camera) {
      const tCam = this.smoothstep(0.1, 0.8, p);
      const aspect = this.camera.aspect || 1;
      const portraitZoom = aspect < 1.15 ? (1.15 / Math.max(0.58, aspect)) : 1;
      const camZ = this.lerp(4.75, 4.95, tCam) * portraitZoom;
      const camY = this.lerp(1.48, 1.42, tCam) * (aspect < 1.0 ? 1.06 : 1);
      const lookY = this.lerp(0.16, 0.74, tCam);
      this.camera.position.set(this.currentPointerX * 0.16, camY, camZ);
      this.camera.lookAt(0, lookY, 0);
    }
  }

  onResize() {
    this.isMobile = window.innerWidth < 768;
    if (!this.renderer || !this.camera || !this.container) return;
    const width = this.container.clientWidth || 960;
    const height = this.container.clientHeight || 560;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.5 : 2));
  }

  startRenderLoop() {
    const render = (now) => {
      let needsUpdate = false;

      if (this.modelLoaded && this.introProgress < 1 && this.introStartTime !== null) {
        const elapsed = now - this.introStartTime;
        this.introProgress = Math.min(1, elapsed / this.introDurationMs);
        needsUpdate = true;
      }

      const diff = this.targetProgress - this.currentProgress;
      if (Math.abs(diff) > 0.0003) {
        this.currentProgress += diff * 0.11;
        needsUpdate = true;
      } else if (this.currentProgress !== this.targetProgress) {
        this.currentProgress = this.targetProgress;
        needsUpdate = true;
      }

      const diffX = this.targetPointerX - this.currentPointerX;
      if (Math.abs(diffX) > 0.0005) {
        this.currentPointerX += diffX * 0.09;
        needsUpdate = true;
      } else if (this.currentPointerX !== this.targetPointerX) {
        this.currentPointerX = this.targetPointerX;
        needsUpdate = true;
      }

      if (needsUpdate) {
        this.applySequenceAtProgress(this.currentProgress);
      }

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }

      this.animFrameId = requestAnimationFrame(render);
    };

    this.animFrameId = requestAnimationFrame(render);
  }

  renderFallback() {
    if (!this.container) return;
    const fallbackWrap = document.createElement('div');
    fallbackWrap.className = 'laptop-fallback-wrapper';
    fallbackWrap.style.marginTop = '2rem';
    fallbackWrap.innerHTML = `
      <div class="laptop-fallback-screen" id="fallback-screen">
        <div class="fallback-screen-glow"></div>
        <div class="fallback-screen-content" id="fallback-screen-content">
          <span class="fallback-badge">EasyGrow Core 3D</span>
          <h4>Consola & Marketplace</h4>
          <p>Infraestructura modular para ventas, CRM y logística.</p>
        </div>
      </div>
      <div class="laptop-fallback-base">
        <div class="fallback-notch"></div>
      </div>
    `;
    this.container.appendChild(fallbackWrap);
    this.updateFallbackVisuals(this.currentProgress);
  }

  updateFallbackVisuals(p) {
    const glow = this.container ? this.container.querySelector('.fallback-screen-glow') : null;
    if (glow) {
      glow.style.opacity = String((0.3 + p * 0.7).toFixed(2));
    }
  }
}

window.EasyGrowLaptopHero = EasyGrowLaptopHero;
