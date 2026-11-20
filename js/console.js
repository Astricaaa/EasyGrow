/**
 * EasyGrow Console Master Controller & Module Manager
 * Enterprise Connected • Multi-Tenant SQLite • Real-Time SSE • Dynamic Excel Importer
 */

class EasyGrowConsoleApp {
  constructor() {
    this.modulesRegistry = [];
    this.activeModuleId = 'executive-goals';
    this.activeStationId = 1;
    this.triggeringElement = null;
    this.isDrawerOpen = false;
    this.renderTimer = null;
    this.renderNonce = 0;

    // Current Session & Real-Time
    this.currentUser = null;
    this.eventSource = null;
    this.products = [];
    this.metrics = {
      totalRevenue: 0,
      totalCost: 0,
      netProfit: 0,
      grossMarginPct: 0,
      pipelineValue: 0,
      openOpportunitiesCount: 0,
      openOpportunitiesValue: 0,
      weightedPipelineValue: 0,
      avgPurchaseValue: 0,
      period: 'all',
      periodRevenue: 0,
      purchasesCount: 0,
      customersWithPurchases: 0,
      totalLeads: 0,
      closedCount: 0,
      winRate: 0
    };

    // Estación 02: Etapas Kanban 3D Editables, Periodos, KPIs Seleccionables, Compras y Fórmulas
    this.stages = [];
    this.historyAnalysis = null;
    this.purchases = [];
    this.privateFormulas = [];
    this.communityFormulas = [];
    this.metricsPeriod = 'all';
    this.selectedDashboardKPIs = ['ventas', 'conversion', 'compra_promedio', 'oportunidades_abiertas', 'ingresos_periodo', 'proyeccion_ponderada'];
    this.builderName = '';
    this.builderDesc = '';
    this.builderExpr = 'VALOR_OPORTUNIDAD * (PROBABILIDAD_ETAPA / 100)';
    this.builderUnit = 'COP';
    this.builderTestVal = 1000000;
    this.builderTestProb = 50;

    // Excel Parser State (CRM + Inventario Estación 01)
    this.excelRawRows = [];
    this.excelHeaders = [];
    this.invExcelRawRows = [];
    this.invExcelHeaders = [];
    this.invAiMapping = {};
    this.invPreviewRows = [];

    // Estación 01: Carrito Multi-Origen, Transportadoras y Guías
    this.cart = [];
    this.cartDestinationCity = 'Bogotá D.C.';
    this.carrierPriority = 'balanced';
    this.carrierOverrides = {};
    this.marketOriginFilter = 'all';
    this.shipments = [];
    this.simOriginCity = 'Medellín';
    this.simDestCity = 'Bogotá D.C.';
    this.lastCheckoutSummary = null;

    // Estación 03: Google Forms, Reglas/IA para Análisis Humano y QRs Dinámicos
    this.station3Config = null;
    this.formRules = [];
    this.formSubmissions = [];
    this.qrCodes = [];
    this.formFilterCategory = 'ALL';
    this.formFilterStatus = 'ALL';
    this.openQuickFormQrId = null;

    // Estación 04: WhatsApp Business Platform, Bandeja 3 Paneles (WA/IG/FB), Orbe IA & Calendario
    this.waIntegration = null;
    this.waEnvironment = null;
    this.waWebhookLogs = [];
    this.waCalls = [];
    this.inboxContacts = [];
    this.inboxMessagesByContact = {};
    this.calendarAppointments = [];
    this.showInboxCalendarDrawer = false;
    this.showInboxIncomingModal = false;

    // Estación 05: Marketing & Analítica (Parrilla IG/FB/TikTok, Campañas Ads, Permisos, Atribución, SEO)
    this.station5Data = null;
    this.activeCollaboratorEmail = null;
    this.editingSocialPostId = null;
    this.socialDraftNetworks = { instagram: true, facebook: true, tiktok: true };
    this.socialDraftMediaType = 'image';
    this.socialDraftRequiresNativeApp = false;
    this.adFilters = { provider: 'ALL', accountId: 'ALL', campaignId: 'ALL', period: '30d' };
    this.seoFilters = { period: '28d', query: '', page: '', device: 'ALL', country: 'ALL' };
    this.pendingCampaignConfirm = null;
    this.pendingPermConfirm = null;

    // Local Interactive State
    this.selectedInboxContactId = null;
    this.inboxChannelFilter = "all";
    this.marketCategoryFilter = "all";
    this.selectedProduct = null;
    this.scheduledPosts = [];
    this.callLogs = [];
    this.moduleSubTabs = {};
    this.calendarViewMode = 'month';
    this.calendarMonthOffset = 0;
    this.calendarCategoryFilter = 'ALL';
    this.selectedCalendarDate = new Date().toISOString().slice(0, 10);
    this.editingGoalId = null;
  }

  async init() {
    this.initCursorHalo();
    this.initAiOrb();

    // Verify session with server
    const isAuthed = await this.loadCurrentUserSession();
    if (!isAuthed) return;

    this.initRealtimeSSE();
    await this.loadProducts();
    await this.loadShipments();
    await this.loadStages();
    await this.loadPurchases();
    await this.loadFormulas();
    await this.loadStation3Workspace();
    await this.loadWhatsAppConfig();
    await this.loadInboxWorkspace();
    await this.loadStation5Workspace();
    await this.loadMetrics();
    await this.loadModulesRegistry();
    this.renderSidebar();
    this.bindDrawerEvents();
    this.bindGlobalShortcuts();

    // Listen to CRM updates
    if (window.EasyGrowEvents) {
      window.EasyGrowEvents.on('crm:contacts-updated', async () => {
        await this.loadMetrics();
        if (this.activeModuleId === 'crm-pipeline') {
          this.openModuleFull('crm-pipeline', false);
        } else if (this.activeModuleId === 'unified-inbox') {
          this.openModuleFull('unified-inbox', false);
        }
      });
    }

    // Direct open to initial module (01. Gerencia & Calendario)
    this.openModuleFull('executive-goals', false);
  }

  // --- Session & Auth Management ---
  async loadCurrentUserSession() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        window.location.href = '/login.html';
        return false;
      }
      const data = await res.json();
      if (!data.success || !data.user) {
        window.location.href = '/login.html';
        return false;
      }

      this.currentUser = data.user;
      this.updateUserUI();
      return true;
    } catch (e) {
      window.location.href = '/login.html';
      return false;
    }
  }

  updateUserUI() {
    if (!this.currentUser) return;
    const initial = (this.currentUser.name || this.currentUser.companyName || 'U').charAt(0).toUpperCase();
    const initialsElem = document.getElementById('user-avatar-initials');
    if (initialsElem) initialsElem.textContent = initial;

    const companyElem = document.getElementById('user-company-display');
    if (companyElem) companyElem.textContent = this.currentUser.companyName || this.currentUser.name;

    const roleBadge = document.getElementById('user-role-badge');
    if (roleBadge) {
      if (this.currentUser.role === 'admin') {
        roleBadge.textContent = '👑 ADMIN MAESTRO';
        roleBadge.style.color = 'var(--accent-2)';
      } else {
        roleBadge.textContent = '🏢 NEGOCIO';
        roleBadge.style.color = 'var(--accent-1)';
      }
    }
  }

  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    window.location.href = '/login.html';
  }

  // --- Real-Time SSE Listener ---
  initRealtimeSSE() {
    try {
      this.eventSource = new EventSource('/api/realtime/events');
      
      this.eventSource.onmessage = async (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'marketplace_updated') {
            this.showToast(
              '📡 Red Dropi en Vivo',
              'El Administrador Maestro ha actualizado el Catálogo Global del Marketplace.',
              'success'
            );
            await this.loadProducts();
            if (this.activeModuleId === 'marketplace') {
              this.renderMarketplaceCatalog();
            }
          }
          if (payload.type === 'inbox_updated') {
            await this.loadWhatsAppConfig();
            await this.loadInboxWorkspace();
            this.showToast('📩 Evento WhatsApp Webhook', 'Se procesó un nuevo evento oficial en la bandeja omnicanal.', 'info');
            if (['unified-inbox', 'call-tracking', 'whatsapp-integrations'].includes(this.activeModuleId)) {
              this.openModuleFull(this.activeModuleId, false);
            }
          }
        } catch (err) {}
      };

      this.eventSource.onerror = () => {
        // SSE auto-reconnects automatically
      };
    } catch (err) {
      console.warn('[SSE] No se pudo inicializar SSE:', err);
    }
  }

  // --- Real-Time Toast Notifications ---
  showToast(title, message, type = 'info') {
    const container = document.getElementById('realtime-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const borderColor = type === 'success' ? 'var(--usd-green)' : (type === 'warn' ? 'var(--data-amber)' : 'var(--accent-1)');
    toast.style.cssText = `
      background: #FFFFFF;
      border: 1.5px solid #111111;
      border-left: 4px solid ${borderColor};
      border-radius: 8px;
      padding: 0.9rem 1.25rem;
      min-width: 300px;
      max-width: 400px;
      color: #111111;
      box-shadow: 0 12px 32px rgba(17, 17, 17, 0.14);
      pointer-events: auto;
      transform: translateX(100px);
      opacity: 0;
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    toast.innerHTML = `
      <div style="font-weight: 800; font-size: 0.88rem; color: #111111; margin-bottom: 0.25rem;">
        ${title}
      </div>
      <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
        ${message}
      </div>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    });

    setTimeout(() => {
      toast.style.transform = 'translateX(100px)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  // --- Data Loaders ---
  async loadProducts() {
    try {
      const res = await fetch('/api/marketplace/products');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          this.products = data.products;
          return this.products;
        }
      }
    } catch (e) {}
    return this.products;
  }

  async loadShipments() {
    try {
      const res = await fetch('/api/shipping/shipments');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.shipments)) {
          this.shipments = data.shipments;
          return this.shipments;
        }
      }
    } catch (e) {}
    return this.shipments;
  }

  async loadMetrics() {
    try {
      const res = await fetch(`/api/crm/metrics?period=${encodeURIComponent(this.metricsPeriod || 'all')}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.metrics) {
          this.metrics = data.metrics;
          const topbarRev = document.getElementById('topbar-revenue-display');
          if (topbarRev) {
            topbarRev.textContent = `$${this.metrics.totalRevenue.toLocaleString()} COP`;
          }
        }
      }
    } catch (e) {}
  }

  async loadStages() {
    try {
      const res = await fetch('/api/crm/stages');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.stages = data.stages || [];
          this.historyAnalysis = data.historyAnalysis || null;
        }
      }
    } catch (e) {}
    return this.stages;
  }

  async loadPurchases() {
    try {
      const res = await fetch('/api/crm/purchases');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.purchases)) {
          this.purchases = data.purchases;
        }
      }
    } catch (e) {}
    return this.purchases;
  }

  async loadFormulas() {
    try {
      const res = await fetch('/api/crm/formulas');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.privateFormulas = data.privateFormulas || [];
          this.communityFormulas = data.communityFormulas || [];
        }
      }
    } catch (e) {}
  }

  async loadStation3Workspace() {
    try {
      const res = await fetch('/api/station3/workspace');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.station3Config = data.config || null;
          this.formRules = data.rules || [];
          this.formSubmissions = data.submissions || [];
          this.qrCodes = data.qrCodes || [];
        }
      }
    } catch (e) {}
  }

  async loadWhatsAppConfig() {
    try {
      const res = await fetch('/api/whatsapp/config');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.waIntegration = data.integration || null;
          this.waEnvironment = data.environment || null;
          this.waWebhookLogs = data.logs || [];
          this.waCalls = data.calls || [];
        }
      }
    } catch (e) {}
  }

  async loadInboxWorkspace() {
    try {
      const res = await fetch('/api/inbox/workspace');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.waIntegration = data.integration || this.waIntegration;
          this.waEnvironment = data.environment || this.waEnvironment;
          this.inboxContacts = data.contacts || [];
          this.inboxMessagesByContact = data.messagesByContact || {};
          this.calendarAppointments = data.calendarAppointments || [];
          this.waCalls = data.calls || this.waCalls;
        }
      }
    } catch (e) {}
  }

  async loadStation5Workspace() {
    try {
      const actor = this.activeCollaboratorEmail || (this.currentUser && this.currentUser.email) || '';
      const params = new URLSearchParams({
        actorEmail: actor,
        provider: this.adFilters.provider || 'ALL',
        accountId: this.adFilters.accountId || 'ALL',
        campaignId: this.adFilters.campaignId || 'ALL',
        period: this.adFilters.period || '30d',
        seoPeriod: this.seoFilters.period || '28d',
        seoQuery: this.seoFilters.query || '',
        seoPage: this.seoFilters.page || '',
        seoDevice: this.seoFilters.device || 'ALL',
        seoCountry: this.seoFilters.country || 'ALL'
      });
      const res = await fetch(`/api/station5/workspace?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.station5Data = data;
          if (!this.activeCollaboratorEmail && data.activeCollaborator) {
            this.activeCollaboratorEmail = data.activeCollaborator.collaborator_email;
          }
        }
      }
    } catch (e) {}
  }

  initCursorHalo() {
    const halo = document.getElementById('cursor-halo');
    if (!halo) return;
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) {
      halo.style.display = 'none';
      return;
    }

    window.addEventListener('pointermove', (e) => {
      halo.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    }, { passive: true });
  }

  initAiOrb() {
    const orbWidget = document.getElementById('ai-assistant-widget');
    const orbCore = document.getElementById('ai-orb-core');
    if (!orbWidget || !orbCore) return;

    orbWidget.addEventListener('click', () => {
      orbCore.style.boxShadow = '0 0 35px #34C77B';
      orbCore.style.transform = 'scale(1.25)';
      
      const responses = [
        "Sincronización Dropi activa: Red común global conectada a bodegas mayoristas.",
        `Sesión activa como: ${this.currentUser ? this.currentUser.companyName : 'Usuario'} (${this.currentUser ? this.currentUser.role : 'tenant'}).`,
        `Ingresos verificados en tu CRM: $${this.metrics.totalRevenue.toLocaleString()} COP. Margen real: ${this.metrics.grossMarginPct}%.`,
        "Ciberseguridad bancaria activa: Cookies HTTP-Only y aislamiento multitenant estricto.",
        "Motor de Intención Dropi listo para clasificar WhatsApp, SMS y Web Chat."
      ];
      const msg = responses[Math.floor(Math.random() * responses.length)];

      setTimeout(() => {
        orbCore.style.boxShadow = '';
        orbCore.style.transform = '';
        alert(`[Orbe IA EasyGrow]: ${msg}`);
      }, 250);
    });
  }

  async loadModulesRegistry() {
    try {
      const res = await fetch('modules/modules.registry.json');
      this.modulesRegistry = await res.json();
    } catch (e) {
      this.modulesRegistry = [];
    }
  }

  renderSidebar() {
    const container = document.getElementById('sidebar-nav-container');
    if (!container) return;

    const stationsMap = {
      1: { name: '01. Gerencia & Calendario', icon: 'trending-up' },
      2: { name: '02. Comercio & Logística', icon: 'shopping-bag' },
      3: { name: '03. Ventas & CRM', icon: 'users' },
      4: { name: '04. Captación & QRs', icon: 'target' },
      5: { name: '05. Atención & WhatsApp', icon: 'message-circle' },
      6: { name: '06. Marketing & Auditoría', icon: 'trending-up' }
    };

    let html = '';
    for (let sId = 1; sId <= 6; sId++) {
      const station = stationsMap[sId];
      const modules = this.modulesRegistry.filter(m => m.stationId === sId);
      if (modules.length === 0) continue;

      html += `
        <div class="sidebar-station-group ${sId === this.activeStationId ? 'active' : ''}">
          <button class="station-group-header" onclick="window.consoleApp.toggleStationGroup(${sId})">
            <span class="station-group-title">${station.name}</span>
            <svg class="station-collapse-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div class="station-modules-list">
            ${modules.map(mod => `
              <button 
                class="module-nav-btn ${mod.id === this.activeModuleId ? 'active' : ''}" 
                id="sidebar-mod-${mod.id}"
                data-mod-id="${mod.id}"
                onclick="window.consoleApp.openModuleFull('${mod.id}', true)"
                aria-current="${mod.id === this.activeModuleId ? 'page' : 'false'}">
                <span class="module-btn-icon">${window.EasyGrowIcons.get(mod.icon, 16)}</span>
                <span class="module-btn-label">${mod.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  toggleStationGroup(stationId) {
    this.activeStationId = stationId;
    this.renderSidebar();
  }

  async openModuleFull(moduleId, updateURL = true) {
    if (moduleId === 'call-tracking') {
      if (!this.moduleSubTabs) this.moduleSubTabs = {};
      this.moduleSubTabs['whatsapp-integrations'] = 'llamadas';
      moduleId = 'whatsapp-integrations';
    }
    const mod = this.modulesRegistry.find(m => m.id === moduleId);
    if (!mod) return;

    this.activeModuleId = moduleId;
    this.activeStationId = mod.stationId;

    // Close mobile sidebar drawer after selecting a module
    const sidebarEl = document.getElementById('console-sidebar');
    if (sidebarEl) sidebarEl.classList.remove('mobile-open');

    // Breadcrumbs
    const bStation = document.getElementById('breadcrumb-station-name');
    const bModule = document.getElementById('breadcrumb-module-name');
    if (bStation) {
      bStation.textContent = mod.stationName;
    }
    if (bModule) bModule.textContent = mod.fullName;

    // Active button in sidebar
    document.querySelectorAll('.module-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mod-id') === moduleId);
      btn.setAttribute('aria-current', btn.getAttribute('data-mod-id') === moduleId ? 'page' : 'false');
    });

    // Viewport warp transition (guarded against overlapping async renders)
    const viewport = document.getElementById('module-viewport');
    if (viewport) {
      const nonce = ++this.renderNonce;
      if (this.renderTimer) clearTimeout(this.renderTimer);
      viewport.classList.add('warp-exit');
      
      this.renderTimer = setTimeout(async () => {
        this.renderTimer = null;
        const renderedHtml = await this.renderModuleContent(mod);
        if (nonce !== this.renderNonce) return;

        viewport.innerHTML = renderedHtml;
        viewport.setAttribute('data-module', moduleId);
        viewport.classList.remove('warp-exit');
        viewport.classList.add('warp-enter');
        
        requestAnimationFrame(() => {
          viewport.classList.remove('warp-enter');
        });

        this.initModuleInteractivity(moduleId);
      }, 140);
    }
  }

  // --- Dynamic Module Renderer ---
  async renderModuleContent(mod) {
    // Dynamic KPI ribbon based on real metrics
    let kpiRibbon = ``;
    if (mod.id === 'crm-pipeline') {
      kpiRibbon = `
        <div class="module-kpi-ribbon">
          <div class="stat-box">
            <span class="stat-box-lbl">Leads Registrados</span>
            <span class="stat-box-val">${this.metrics.totalLeads}</span>
            <span class="stat-box-sub">${this.metrics.totalLeads > 0 ? 'En base de datos' : 'Cuenta limpia'}</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-lbl">Ingresos Facturados</span>
            <span class="stat-box-val" style="color: var(--accent-1);">$${this.metrics.totalRevenue.toLocaleString()} COP</span>
            <span class="stat-box-sub">Ventas cerradas</span>
          </div>
          <div class="stat-box">
            <span class="stat-box-lbl">Margen Bruto Real</span>
            <span class="stat-box-val" style="color: var(--usd-green);">${this.metrics.grossMarginPct}%</span>
            <span class="stat-box-sub">Rentabilidad neta</span>
          </div>
        </div>
      `;
    } else {
      kpiRibbon = `
        <div class="module-kpi-ribbon">
          ${(mod.kpis || []).map(k => `
            <div class="stat-box">
              <span class="stat-box-lbl">${k.label}</span>
              <span class="stat-box-val">${k.value}</span>
              <span class="stat-box-sub">${k.change}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // 01. Gerencia & Calendario — MOD-01.1: Dashboard de Objetivos Gerenciales (Vista Vertical Unificada)
    if (mod.id === 'executive-goals') {
      const storeName = this.getActiveStoreName ? this.getActiveStoreName() : 'EasyGrow';
      const goals = this.getExecutiveGoals();
      const totalGoals = goals.length;
      const onTrackCount = goals.filter(g => g.pct >= 80).length;
      const riskCount = goals.filter(g => g.pct < 80).length;
      const avgCompletion = totalGoals > 0
        ? Math.round(goals.reduce((s, g) => s + Math.min(100, g.pct), 0) / totalGoals)
        : 0;
      const salesGoal = goals.find(g => g.id === 'goal_sales') || goals[0];
      const editingGoal = this.editingGoalId ? goals.find(g => g.id === this.editingGoalId) : null;
      const todayIso = new Date().toISOString().slice(0, 10);
      const defaultDeadline = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

      const fmtVal = (val, unit) => {
        if (unit === 'COP') return `$${Number(val || 0).toLocaleString('es-CO')} COP`;
        if (unit === '%') return `${Number(val || 0)}%`;
        return `${Number(val || 0).toLocaleString('es-CO')} ${unit || ''}`.trim();
      };

      const statusBadge = (pct) => {
        if (pct >= 80) return { label: 'En meta', cls: 'ok' };
        if (pct >= 45) return { label: 'En progreso', cls: 'warn' };
        return { label: 'Atención requerida', cls: 'err' };
      };

      return `
        ${this.renderErpHeader({
          code: 'MOD-01.1',
          title: mod.fullName,
          subtitle: 'Tablero ejecutivo conectado en vivo a ventas, cierres CRM, logística y atención al cliente.',
          helpText: 'Consolida automáticamente metas conectadas a la operación real de EasyGrow (ingresos, cierres, entregas y atención) junto con objetivos personalizados por gerencia, responsables y fechas límite.',
          actionsHtml: `
            <button type="button" class="btn-secondary" onclick="window.consoleApp.openModuleFull('operational-calendar', true)">Ir al Calendario (01.2)</button>
            <button type="button" class="btn-secondary" onclick="window.consoleApp.exportAuditTableToExcel('executive_goals')">Exportar Excel Auditoría</button>
          `
        })}

        ${this.renderHowItWorks([
          { title: '1. Visualiza el cumplimiento', desc: 'Las tarjetas superiores muestran el porcentaje real logrado por cada área frente a su meta mensual.' },
          { title: '2. Controla responsables', desc: 'La tabla central indica qué objetivos están en verde, cuáles requieren apoyo y permite sumar avances.' },
          { title: '3. Define nuevas metas', desc: 'Usa el formulario inferior para crear objetivos estratégicos para Ventas, Logística, Atención o Marketing.' }
        ])}

        <!-- ARRIBA: KPIs Ejecutivos + Gráficas de Cumplimiento por Área -->
        <div class="erp-kpi-strip">
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Cumplimiento Global</span>
            <span class="erp-kpi-val num-col" style="color: var(--accent-1);">${avgCompletion}%</span>
            <span class="erp-kpi-sub">Promedio de ${totalGoals} metas</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">En Meta (Semáforo Verde)</span>
            <span class="erp-kpi-val num-col" style="color: var(--accent-1);">${onTrackCount}</span>
            <span class="erp-kpi-sub">Avance igual o superior al 80%</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">En Seguimiento / Riesgo</span>
            <span class="erp-kpi-val num-col" style="color: ${riskCount > 0 ? '#B45309' : 'var(--text-main)'};">${riskCount}</span>
            <span class="erp-kpi-sub">Requieren seguimiento</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Ventas vs. Meta Principal</span>
            <span class="erp-kpi-val num-col">${salesGoal ? `${salesGoal.pct}%` : '0%'}</span>
            <span class="erp-kpi-sub">${salesGoal ? fmtVal(salesGoal.current, salesGoal.unit) : '$0 COP'}</span>
          </div>
        </div>

        <div class="erp-goals-charts-grid">
          ${goals.slice(0, 4).map(g => {
            const st = statusBadge(g.pct);
            const widthPct = Math.min(100, Math.max(2, g.pct));
            return `
              <div class="erp-goal-chart-card">
                <div class="erp-goal-chart-head">
                  <div>
                    <span class="erp-status-pill" style="margin-bottom:0.25rem;">${this.escapeHtml(g.area)}</span>
                    <div style="font-size:0.86rem; font-weight:700; color:var(--text-main);">${this.escapeHtml(g.title)}</div>
                  </div>
                  <span class="erp-goal-chart-pct">${g.pct}%</span>
                </div>
                <div class="erp-progress-track">
                  <div class="erp-progress-fill ${st.cls}" style="width: ${widthPct}%;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.74rem; color:var(--text-muted); margin-top:0.15rem;">
                  <span>Actual: <strong style="color:var(--text-main);">${this.escapeHtml(fmtVal(g.current, g.unit))}</strong></span>
                  <span>Meta: <strong>${this.escapeHtml(fmtVal(g.target, g.unit))}</strong></span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.72rem; color:var(--text-dim);">
                  <span>Resp: ${this.escapeHtml(g.owner)}</span>
                  <span class="erp-status-pill ${st.cls}">${st.label}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Gráfica Comparativa de Cumplimiento por Área vs. Umbral Gerencial (80%) -->
        <div class="erp-table-wrapper" style="margin-bottom: 1.15rem;">
          <div class="erp-table-toolbar">
            <strong>Gráfica Comparativa de Cumplimiento por Objetivo vs. Umbral (80%)</strong>
            <div style="display:flex; gap:0.85rem; align-items:center; font-size:0.74rem; color:var(--text-muted);">
              <span><span style="display:inline-block; width:10px; height:10px; background:#1FA866; border-radius:2px; margin-right:4px;"></span>En Meta (≥80%)</span>
              <span><span style="display:inline-block; width:10px; height:10px; background:#D97706; border-radius:2px; margin-right:4px;"></span>En Progreso (45–79%)</span>
              <span><span style="display:inline-block; width:10px; height:10px; background:#DC2626; border-radius:2px; margin-right:4px;"></span>Atención (&lt;45%)</span>
            </div>
          </div>
          <div style="padding: 1rem 1.15rem; overflow-x: auto;">
            ${(() => {
              const chartGoals = goals.slice(0, 8);
              const w = 860;
              const h = 210;
              const padL = 44;
              const padR = 20;
              const padT = 18;
              const padB = 42;
              const plotW = w - padL - padR;
              const plotH = h - padT - padB;
              const slotW = plotW / Math.max(1, chartGoals.length);
              const barW = Math.min(54, slotW * 0.52);
              const thresholdY = padT + plotH * (1 - 0.80);

              const gridLines = [0, 25, 50, 75, 100].map(pct => {
                const y = padT + plotH * (1 - pct / 100);
                return `
                  <line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" stroke="#E6E8E2" stroke-width="1"/>
                  <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#6B7280" font-size="11" font-family="monospace">${pct}%</text>
                `;
              }).join('');

              const barsSvg = chartGoals.map((g, i) => {
                const clampedPct = Math.min(100, Math.max(0, Number(g.pct || 0)));
                const bh = Math.max(4, (clampedPct / 100) * plotH);
                const x = padL + i * slotW + (slotW - barW) / 2;
                const y = padT + plotH - bh;
                const fill = clampedPct >= 80 ? '#1FA866' : (clampedPct >= 45 ? '#D97706' : '#DC2626');
                const shortLabel = g.title.length > 16 ? g.title.slice(0, 15) + '…' : g.title;
                return `
                  <g>
                    <rect x="${x.toFixed(1)}" y="${padT}" width="${barW.toFixed(1)}" height="${plotH}" rx="4" fill="#F4F5F2"/>
                    <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="${fill}"/>
                    <text x="${(x + barW / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" fill="#111111" font-size="11" font-weight="700" font-family="monospace">${g.pct}%</text>
                    <text x="${(x + barW / 2).toFixed(1)}" y="${h - 14}" text-anchor="middle" fill="#4B5563" font-size="11" font-family="system-ui, sans-serif">${this.escapeHtml(shortLabel)}</text>
                  </g>
                `;
              }).join('');

              const polyPoints = chartGoals.map((g, i) => {
                const clampedPct = Math.min(100, Math.max(0, Number(g.pct || 0)));
                const cx = padL + i * slotW + slotW / 2;
                const cy = padT + plotH * (1 - clampedPct / 100);
                return `${cx.toFixed(1)},${cy.toFixed(1)}`;
              }).join(' ');

              return `
                <svg viewBox="0 0 ${w} ${h}" style="width:100%; min-width:520px; height:auto; max-height:230px; display:block;" role="img" aria-label="Gráfica de cumplimiento por objetivo gerencial">
                  ${gridLines}
                  ${barsSvg}
                  <line x1="${padL}" y1="${thresholdY.toFixed(1)}" x2="${w - padR}" y2="${thresholdY.toFixed(1)}" stroke="#111111" stroke-width="1.5" stroke-dasharray="5 4"/>
                  <rect x="${w - padR - 108}" y="${(thresholdY - 17).toFixed(1)}" width="106" height="14" rx="3" fill="#FFFFFF" fill-opacity="0.9"/>
                  <text x="${w - padR - 4}" y="${(thresholdY - 6).toFixed(1)}" text-anchor="end" fill="#111111" font-size="10" font-weight="700" font-family="monospace">META MÍNIMA 80%</text>
                  ${chartGoals.length > 1 ? `<polyline fill="none" stroke="#111111" stroke-width="2" stroke-opacity="0.45" points="${polyPoints}"/>` : ''}
                </svg>
              `;
            })()}
          </div>
        </div>

        <!-- AL MEDIO: Tabla Completa por Área & Responsable -->
        <div class="erp-table-wrapper" style="margin-bottom: 1.15rem;">
          <div class="erp-table-toolbar">
            <strong>Desglose de Objetivos por Área y Responsable (${totalGoals})</strong>
            <span style="font-size:0.78rem; color:var(--text-muted);">Las metas operativas se alimentan en vivo desde CRM, Comercio y Atención</span>
          </div>
          <div class="erp-table-scroll">
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Objetivo Gerencial</th>
                  <th>Área</th>
                  <th>Responsable</th>
                  <th class="num-col">Fecha Límite</th>
                  <th class="num-col">Avance / Meta</th>
                  <th style="min-width:140px;">Cumplimiento</th>
                  <th>Semáforo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${goals.map(g => {
                  const st = statusBadge(g.pct);
                  return `
                    <tr>
                      <td>
                        <strong>${this.escapeHtml(g.title)}</strong>
                        ${g.autoMetric ? `<div style="font-size:0.7rem; color:var(--accent-1);">Conectado en vivo</div>` : `<div style="font-size:0.7rem; color:var(--text-muted);">Objetivo manual</div>`}
                      </td>
                      <td>${this.escapeHtml(g.area)}</td>
                      <td>${this.escapeHtml(g.owner)}</td>
                      <td class="num-col">${this.escapeHtml(g.deadline || todayIso)}</td>
                      <td class="num-col"><strong>${this.escapeHtml(fmtVal(g.current, g.unit))}</strong><br><span style="font-size:0.72rem; color:var(--text-muted);">de ${this.escapeHtml(fmtVal(g.target, g.unit))}</span></td>
                      <td>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                          <div class="erp-progress-track" style="flex:1; height:7px;">
                            <div class="erp-progress-fill ${st.cls}" style="width: ${Math.min(100, g.pct)}%;"></div>
                          </div>
                          <span class="num-col" style="font-weight:800; font-size:0.78rem;">${g.pct}%</span>
                        </div>
                      </td>
                      <td><span class="erp-status-pill ${st.cls}">${st.label}</span></td>
                      <td style="white-space:nowrap;">
                        <div style="display:flex; gap:0.35rem;">
                          <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.22rem 0.5rem; border-color:var(--accent-1); color:var(--accent-1);" onclick="window.consoleApp.incrementExecutiveGoal('${g.id}')">+10%</button>
                          <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.22rem 0.5rem;" onclick="window.consoleApp.startEditExecutiveGoal('${g.id}')">Editar</button>
                          <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.22rem 0.5rem; color:var(--data-crimson);" onclick="window.consoleApp.deleteExecutiveGoal('${g.id}')">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- ABAJO: Formulario Definir / Ajustar Objetivo -->
        <div class="erp-table-wrapper" id="exec-goal-form-box">
          <div class="erp-table-toolbar">
            <strong>${editingGoal ? `Editando Objetivo: ${this.escapeHtml(editingGoal.title)}` : '+ Definir Nuevo Objetivo Gerencial'}</strong>
            ${editingGoal ? `<button type="button" class="btn-secondary" style="font-size:0.74rem;" onclick="window.consoleApp.editingGoalId = null; window.consoleApp.openModuleFull('executive-goals', false);">Cancelar Edición</button>` : ''}
          </div>
          <div style="padding: 1.05rem;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.7rem; align-items: end;">
              <div style="grid-column: span 2;">
                <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">Nombre del Objetivo *</label>
                <input type="text" id="goal-title" class="form-control" value="${this.escapeHtml(editingGoal ? editingGoal.title : '')}" placeholder="Ej: Aumentar tasa de recompra trimestral">
              </div>
              <div>
                <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">Área</label>
                <select id="goal-area" class="form-control">
                  ${['Ventas & CRM', 'Comercio & Logística', 'Atención & WhatsApp', 'Marketing & Auditoría', 'Dirección General'].map(ar => `
                    <option value="${ar}" ${editingGoal && editingGoal.area === ar ? 'selected' : ''}>${ar}</option>
                  `).join('')}
                </select>
              </div>
              <div>
                <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">Responsable</label>
                <input type="text" id="goal-owner" class="form-control" value="${this.escapeHtml(editingGoal ? editingGoal.owner : 'Gerencia Comercial')}" placeholder="Nombre o cargo">
              </div>
              <div>
                <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">Avance Actual</label>
                <input type="number" id="goal-current" class="form-control" value="${editingGoal ? Number(editingGoal.manualCurrent ?? editingGoal.current) : 0}" min="0">
              </div>
              <div>
                <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">Meta Numérica *</label>
                <input type="number" id="goal-target" class="form-control" value="${editingGoal ? Number(editingGoal.target) : 100}" min="1">
              </div>
              <div>
                <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">Unidad</label>
                <select id="goal-unit" class="form-control">
                  ${['COP', 'uds', 'cierres', 'guías', 'registros', '%'].map(u => `
                    <option value="${u}" ${editingGoal && editingGoal.unit === u ? 'selected' : ''}>${u}</option>
                  `).join('')}
                </select>
              </div>
              <div>
                <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">Fecha Límite</label>
                <input type="date" id="goal-deadline" class="form-control" value="${this.escapeHtml(editingGoal ? (editingGoal.deadline || defaultDeadline) : defaultDeadline)}">
              </div>
              <div>
                <button type="button" class="btn-primary-large" style="width:100%; justify-content:center;" onclick="window.consoleApp.saveExecutiveGoal()">
                  ${editingGoal ? 'Guardar Cambios' : '+ Guardar Objetivo'}
                </button>
              </div>
            </div>
          </div>
        </div>

        ${this.renderErpAuditFooter({
          entity: storeName,
          moduleLabel: mod.fullName,
          count: totalGoals,
          exportKey: 'executive_goals'
        })}
      `;
    }

    // 01. Gerencia & Calendario — MOD-01.2: Calendario Operativo & Agenda Unificada
    if (mod.id === 'operational-calendar') {
      const storeName = this.getActiveStoreName ? this.getActiveStoreName() : 'EasyGrow';
      const allEvents = this.getUnifiedCalendarEvents();
      const filteredEvents = this.calendarCategoryFilter === 'ALL'
        ? allEvents
        : allEvents.filter(e => e.type === this.calendarCategoryFilter);

      const eventsByDate = {};
      filteredEvents.forEach(ev => {
        if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
        eventsByDate[ev.date].push(ev);
      });

      const gridMeta = this.buildCalendarGridCells();
      const selDate = this.selectedCalendarDate || new Date().toISOString().slice(0, 10);
      const dayEvents = eventsByDate[selDate] || [];
      const todayIso = new Date().toISOString().slice(0, 10);

      const countCita = allEvents.filter(e => e.type === 'cita').length;
      const countMeta = allEvents.filter(e => e.type === 'meta').length;
      const countEntrega = allEvents.filter(e => e.type === 'entrega').length;
      const countSocial = allEvents.filter(e => e.type === 'social').length;

      return `
        ${this.renderErpHeader({
          code: 'MOD-01.2',
          title: mod.fullName,
          subtitle: 'Calendario visual interactivo con citas de clientes, metas gerenciales, entregas y publicaciones.',
          helpText: 'Centraliza automáticamente citas agendadas desde WhatsApp, vencimientos de objetivos de gerencia, entregas estimadas de pedidos y publicaciones programadas de redes sociales.',
          actionsHtml: `
            <button type="button" class="btn-secondary" onclick="window.consoleApp.openModuleFull('executive-goals', true)">Dashboard Objetivos (01.1)</button>
            <button type="button" class="btn-secondary" onclick="window.consoleApp.exportAuditTableToExcel('calendar_events')">Exportar Excel Agenda</button>
          `
        })}

        ${this.renderHowItWorks([
          { title: '1. Selecciona un día', desc: 'Haz clic en cualquier fecha del calendario mensual o semanal para ver sus actividades a la derecha.' },
          { title: '2. Filtra por categoría', desc: 'Usa los botones de colores para ver Citas de Clientes, Metas de Gerencia, Entregas o Redes Sociales.' },
          { title: '3. Agenda sin complicaciones', desc: 'Llena el formulario rápido de la derecha y la cita quedará sincronizada con tu Bandeja de Mensajes.' }
        ])}

        <div class="erp-kpi-strip">
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Citas Clientes</span>
            <span class="erp-kpi-val num-col" style="color:#1FA866;">${countCita}</span>
            <span class="erp-kpi-sub">Sincronizado con Bandeja</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Fechas Límite Metas</span>
            <span class="erp-kpi-val num-col" style="color:#2563EB;">${countMeta}</span>
            <span class="erp-kpi-sub">Objetivos de Gerencia</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Entregas Logísticas</span>
            <span class="erp-kpi-val num-col" style="color:#D97706;">${countEntrega}</span>
            <span class="erp-kpi-sub">Pedidos y guías</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Publicaciones Social</span>
            <span class="erp-kpi-val num-col" style="color:#7C3AED;">${countSocial}</span>
            <span class="erp-kpi-sub">IG • FB • TikTok</span>
          </div>
        </div>

        <div class="erp-table-wrapper" style="margin-bottom: 1.15rem;">
          <div class="erp-table-toolbar">
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              <button type="button" class="btn-secondary" style="font-size:0.78rem; padding:0.28rem 0.6rem;" onclick="window.consoleApp.changeCalendarOffset(-1)">← Anterior</button>
              <button type="button" class="btn-secondary" style="font-size:0.78rem; padding:0.28rem 0.6rem;" onclick="window.consoleApp.changeCalendarOffset(0)">Hoy</button>
              <button type="button" class="btn-secondary" style="font-size:0.78rem; padding:0.28rem 0.6rem;" onclick="window.consoleApp.changeCalendarOffset(1)">Siguiente →</button>
              <strong style="margin-left:0.35rem; font-size:0.95rem; text-transform:capitalize;">${this.escapeHtml(gridMeta.heading)}</strong>
            </div>

            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              <div class="erp-chip-group" style="margin:0;">
                <button type="button" class="erp-chip ${this.calendarCategoryFilter === 'ALL' ? 'active' : ''}" onclick="window.consoleApp.setCalendarCategoryFilter('ALL')">Todos (${allEvents.length})</button>
                <button type="button" class="erp-chip ${this.calendarCategoryFilter === 'cita' ? 'active' : ''}" onclick="window.consoleApp.setCalendarCategoryFilter('cita')">Citas (${countCita})</button>
                <button type="button" class="erp-chip ${this.calendarCategoryFilter === 'meta' ? 'active' : ''}" onclick="window.consoleApp.setCalendarCategoryFilter('meta')">Metas (${countMeta})</button>
                <button type="button" class="erp-chip ${this.calendarCategoryFilter === 'entrega' ? 'active' : ''}" onclick="window.consoleApp.setCalendarCategoryFilter('entrega')">Entregas (${countEntrega})</button>
                <button type="button" class="erp-chip ${this.calendarCategoryFilter === 'social' ? 'active' : ''}" onclick="window.consoleApp.setCalendarCategoryFilter('social')">Redes (${countSocial})</button>
              </div>
              <button type="button" class="btn-secondary" style="font-size:0.76rem; ${this.calendarViewMode === 'month' ? 'border-color:var(--accent-1); color:var(--accent-1);' : ''}" onclick="window.consoleApp.setCalendarViewMode('month')">Mes</button>
              <button type="button" class="btn-secondary" style="font-size:0.76rem; ${this.calendarViewMode === 'week' ? 'border-color:var(--accent-1); color:var(--accent-1);' : ''}" onclick="window.consoleApp.setCalendarViewMode('week')">Semana</button>
            </div>
          </div>

          <div style="padding: 0.9rem;">
            <div class="erp-cal-layout">
              <!-- Cuadrícula 7 Columnas -->
              <div>
                <div class="erp-cal-grid">
                  ${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => `<div class="erp-cal-day-header">${d}</div>`).join('')}
                  ${gridMeta.cells.map(cell => {
                    const evs = eventsByDate[cell.iso] || [];
                    const isToday = cell.iso === todayIso;
                    const isSel = cell.iso === selDate;
                    return `
                      <div class="erp-cal-day-cell ${cell.inCurrentMonth ? '' : 'muted'} ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''}"
                           onclick="window.consoleApp.selectCalendarDay('${cell.iso}')">
                        <div class="erp-cal-day-num">
                          <span>${cell.dayNum}</span>
                          ${isToday ? `<span style="font-size:0.62rem; background:#1FA866; color:#FFFFFF; padding:1px 4px; border-radius:3px;">HOY</span>` : (evs.length > 0 ? `<span style="font-size:0.66rem; color:var(--text-muted);">${evs.length}</span>` : '')}
                        </div>
                        ${evs.slice(0, 3).map(ev => `
                          <div class="erp-cal-event-pill ev-${ev.type}" title="${this.escapeHtml(ev.title)}">
                            ${ev.time ? `${this.escapeHtml(ev.time)} ` : ''}${this.escapeHtml(ev.title)}
                          </div>
                        `).join('')}
                        ${evs.length > 3 ? `<div style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">+${evs.length - 3} más</div>` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Panel Derecho: Eventos del Día Seleccionado + Agendar Cita -->
              <div style="display:flex; flex-direction:column; gap:0.85rem;">
                <div class="erp-table-wrapper">
                  <div class="erp-table-toolbar">
                    <strong>Agenda del ${this.escapeHtml(selDate)}</strong>
                    <span class="erp-status-pill">${dayEvents.length} evento(s)</span>
                  </div>
                  <div style="padding:0.75rem; display:flex; flex-direction:column; gap:0.5rem; max-height:250px; overflow-y:auto;">
                    ${dayEvents.length === 0 ? `
                      <div style="padding:1rem; text-align:center; font-size:0.8rem; color:var(--text-muted); background:#F8F8F6; border:1px dashed var(--border-subtle); border-radius:6px;">
                        Sin eventos programados para esta fecha. Agenda una cita abajo.
                      </div>
                    ` : dayEvents.map(ev => `
                      <div style="background:#F8F9F6; border:1px solid var(--border-subtle); border-left:4px solid ${ev.color}; border-radius:5px; padding:0.55rem 0.7rem;">
                        <div style="display:flex; justify-content:space-between; align-items:start; gap:0.4rem;">
                          <div>
                            <span style="font-size:0.66rem; font-weight:800; text-transform:uppercase; color:${ev.color};">${this.escapeHtml(ev.typeLabel)}</span>
                            <div style="font-size:0.82rem; font-weight:700; color:var(--text-main);">${this.escapeHtml(ev.title)}</div>
                            <div style="font-size:0.74rem; color:var(--text-muted);">${ev.time ? `${this.escapeHtml(ev.time)} • ` : ''}${this.escapeHtml(ev.subtitle)}</div>
                          </div>
                          ${ev.type === 'cita' && ev.rawId ? `
                            <button type="button" onclick="window.consoleApp.deleteCalendarAppointment('${ev.rawId}')" style="background:transparent; border:none; color:var(--text-dim); cursor:pointer; font-size:0.78rem;" title="Eliminar cita">✕</button>
                          ` : ''}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <div class="erp-table-wrapper">
                  <div class="erp-table-toolbar">
                    <strong>+ Agendar Nueva Cita de Cliente</strong>
                  </div>
                  <div style="padding:0.85rem; display:flex; flex-direction:column; gap:0.55rem;">
                    <input type="text" id="cal-title" class="form-control" placeholder="Motivo (ej: Llamada de seguimiento) *">
                    <input type="text" id="cal-contact-name" class="form-control" placeholder="Nombre del cliente *">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                      <input type="date" id="cal-date" class="form-control" value="${this.escapeHtml(selDate)}">
                      <input type="time" id="cal-time" class="form-control" value="10:30">
                    </div>
                    <select id="cal-channel" class="form-control">
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Llamada">Llamada</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Reunión Virtual">Reunión Virtual</option>
                    </select>
                    <button type="button" class="btn-primary-large" style="width:100%; justify-content:center;" onclick="window.consoleApp.createCalendarAppointment('')">
                      Guardar Cita en Calendario
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabla Próximos Eventos -->
        <div class="erp-table-wrapper">
          <div class="erp-table-toolbar">
            <strong>Listado General de Eventos (${filteredEvents.length})</strong>
            <span style="font-size:0.76rem; color:var(--text-muted);">Sincronizado en vivo con Gerencia, Bandeja WhatsApp, Logística y Marketing</span>
          </div>
          <div class="erp-table-scroll">
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Tipo</th>
                  <th>Actividad / Título</th>
                  <th>Detalle / Responsable</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${filteredEvents.length === 0 ? `
                  <tr><td colspan="5" style="padding:1.25rem; text-align:center; color:var(--text-muted);">No hay eventos para el filtro seleccionado.</td></tr>
                ` : filteredEvents.map(ev => `
                  <tr>
                    <td class="num-col" style="white-space:nowrap;"><strong>${this.escapeHtml(ev.date)}</strong> ${ev.time ? `<span style="color:var(--accent-1);">${this.escapeHtml(ev.time)}</span>` : ''}</td>
                    <td><span class="erp-status-pill" style="border-color:${ev.color}; color:${ev.color};">${this.escapeHtml(ev.typeLabel)}</span></td>
                    <td><strong>${this.escapeHtml(ev.title)}</strong></td>
                    <td>${this.escapeHtml(ev.subtitle)}</td>
                    <td>${this.escapeHtml(ev.status || 'Programado')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        ${this.renderErpAuditFooter({
          entity: storeName,
          moduleLabel: mod.fullName,
          count: filteredEvents.length,
          exportKey: 'calendar_events'
        })}
      `;
    }

    // 2. Marketplace Dropi & Inventario Propio + Carrito Multi-Origen
    if (mod.id === 'marketplace') {
      const isAdmin = this.currentUser && this.currentUser.role === 'admin';
      const originsCount = new Set(this.products.map(p => `${p.origin_type || 'dropi'}|${p.supplier}|${p.origin_city || 'Medellín'}`)).size;
      const cartQty = this.cart.reduce((sum, item) => sum + item.qty, 0);
      const activeTab = this.getModuleSubTab('marketplace', 'catalogo');
      const storeName = this.getActiveStoreName ? this.getActiveStoreName() : 'EasyGrow';

      return `
        ${this.renderErpHeader({
          code: 'MOD-02.1',
          title: mod.fullName,
          subtitle: 'Catálogo multiorigen (Dropi e inventario propio) con importación Excel asistida y despacho por origen.',
          helpText: 'Permite publicar productos de Dropi o inventario propio, adaptar columnas de Excel mediante análisis asistido, agrupar el carrito por origen con costos y tiempos estimados y generar una guía por envío.',
          actionsHtml: `
            <button type="button" class="btn-secondary" onclick="window.consoleApp.openInventoryExcelModal()">Importar Excel (IA)</button>
            <button type="button" class="btn-primary-large" style="font-size: 0.84rem;" onclick="window.consoleApp.openAdminProdModal()">+ Publicar (${isAdmin ? 'Dropi / Propio' : 'Inventario Propio'})</button>
            <button type="button" class="btn-secondary" onclick="window.consoleApp.exportAuditTableToExcel('marketplace')">Exportar Excel Auditoría</button>
          `
        })}

        <div class="erp-kpi-strip">
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Catálogo Verificado</span>
            <span class="erp-kpi-val num-col">${this.products.length}</span>
            <span class="erp-kpi-sub">${this.products.filter(p => p.origin_type !== 'propio').length} Dropi • ${this.products.filter(p => p.origin_type === 'propio').length} Propio</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Orígenes de Despacho</span>
            <span class="erp-kpi-val num-col">${originsCount}</span>
            <span class="erp-kpi-sub">Agrupación en carrito</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Unidades en Carrito</span>
            <span class="erp-kpi-val num-col" id="market-cart-count">${cartQty}</span>
            <span class="erp-kpi-sub">Vista única por origen</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Guías Emitidas</span>
            <span class="erp-kpi-val num-col" style="color: var(--accent-1);">${this.shipments.length}</span>
            <span class="erp-kpi-sub">1 guía por envío</span>
          </div>
        </div>

        ${this.renderErpSubTabs('marketplace', activeTab, [
          { key: 'catalogo', label: '1. Catálogo REA', count: this.products.length },
          { key: 'carrito', label: '2. Carrito Multi-Origen & Despacho', count: cartQty }
        ])}

        ${activeTab === 'catalogo' ? `
          <div class="temu-interests-section" style="margin-bottom: 1rem;">
            <div id="marketplace-category-tabs" class="temu-pills-row">
              <button class="temu-pill ${this.marketOriginFilter === 'all' && this.marketCategoryFilter === 'all' ? 'active' : ''}" data-cat="all" onclick="window.consoleApp.filterMarketOrigin('all'); window.consoleApp.filterMarketCategory('all');">Todos los Orígenes</button>
              <button class="temu-pill ${this.marketCategoryFilter === 'Tecnología' ? 'active' : ''}" data-cat="Tecnología" onclick="window.consoleApp.filterMarketCategory('Tecnología')">Tecnología</button>
              <button class="temu-pill ${this.marketCategoryFilter === 'Belleza y cuidado personal' ? 'active' : ''}" data-cat="Belleza y cuidado personal" onclick="window.consoleApp.filterMarketCategory('Belleza y cuidado personal')">Belleza y cuidado personal</button>
              <button class="temu-pill ${this.marketCategoryFilter === 'Hogar inteligente' ? 'active' : ''}" data-cat="Hogar inteligente" onclick="window.consoleApp.filterMarketCategory('Hogar inteligente')">Hogar inteligente</button>
              <button class="temu-pill ${this.marketOriginFilter === 'dropi' ? 'active' : ''}" data-orig="dropi" onclick="window.consoleApp.filterMarketOrigin('dropi')">Alianza Red Dropi</button>
              <button class="temu-pill ${this.marketOriginFilter === 'propio' ? 'active' : ''}" data-orig="propio" onclick="window.consoleApp.filterMarketOrigin('propio')">Inventario Propio</button>
            </div>
          </div>

          <div class="marketplace-grid" id="marketplace-products-grid">
            ${this.renderMarketplaceProductsCards()}
          </div>
        ` : `
          <div id="multi-origin-cart-section" class="order-simulator-box" style="margin-top: 0;">
            ${this.renderMultiOriginCartSection()}
          </div>
        `}

        ${this.renderErpAuditFooter({
          entity: storeName,
          moduleLabel: mod.fullName,
          count: activeTab === 'catalogo' ? this.products.length : cartQty,
          exportKey: 'marketplace'
        })}
      `;
    }

    // 2. Guías por Envío, Transportadoras, Seguimiento, Avisos y Devoluciones (Fase Posterior)
    if (mod.id === 'shipping-tracker') {
      await this.loadShipments();
      const shipments = this.shipments || [];
      const deliveredCount = shipments.filter(s => s.status === 'ENTREGADO').length;
      const allNotices = shipments.flatMap(s => (s.notifications || []).map(n => ({ ...n, guideId: s.id, origin: s.origin_city })));
      const simEval = this.evaluateCarriersForRoute(this.simOriginCity, this.simDestCity, this.carrierPriority);
      const activeTab = this.getModuleSubTab('shipping-tracker', 'guias');
      const storeName = this.getActiveStoreName ? this.getActiveStoreName() : 'EasyGrow';

      return `
        ${this.renderErpHeader({
          code: 'MOD-02.2',
          title: mod.fullName,
          subtitle: 'Control de guías independientes por envío, asignación de transportadora por ruta y recepción de calidad.',
          helpText: 'Cada envío genera una guía propia. Las transportadoras se asignan aparte evaluando cobertura, costo y tiempo estimado. Los proveedores se califican por puntualidad y estado recibido; la calidad del producto según especificaciones. Devoluciones reservadas para Fase Posterior.',
          actionsHtml: `
            <button type="button" class="btn-secondary" onclick="window.consoleApp.openModuleFull('marketplace', true)">Ir a Catálogo y Carrito</button>
            <button type="button" class="btn-secondary" onclick="window.consoleApp.exportAuditTableToExcel('shipping')">Exportar Excel Auditoría</button>
          `
        })}

        <div class="erp-kpi-strip">
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Guías Generadas</span>
            <span class="erp-kpi-val num-col">${shipments.length}</span>
            <span class="erp-kpi-sub">1 guía por envío</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Entregas Completadas</span>
            <span class="erp-kpi-val num-col" style="color: var(--accent-1);">${deliveredCount}</span>
            <span class="erp-kpi-sub">Elegibles para evaluación</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Avisos Logísticos</span>
            <span class="erp-kpi-val num-col">${allNotices.length}</span>
            <span class="erp-kpi-sub">Bitácora de eventos</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Devoluciones</span>
            <span class="erp-kpi-val" style="font-size: 1rem; color: var(--text-muted);">Fase Posterior</span>
            <span class="erp-kpi-sub">Alcance Estación 01</span>
          </div>
        </div>

        ${this.renderErpSubTabs('shipping-tracker', activeTab, [
          { key: 'guias', label: '1. Guías Activas & Seguimiento', count: shipments.length },
          { key: 'transportadoras', label: '2. Matriz de Transportadoras por Ruta', count: simEval.carriers.length },
          { key: 'avisos', label: '3. Bitácora de Avisos & Evaluaciones', count: allNotices.length }
        ])}

        ${activeTab === 'guias' ? `
          ${shipments.length === 0 ? `
            <div class="erp-table-wrapper">
              <div class="erp-table-toolbar">
                <strong>Registro Maestro de Guías</strong>
                <button type="button" class="btn-primary-large" style="font-size:0.8rem;" onclick="window.consoleApp.openModuleFull('marketplace', true)">Ir a Catálogo y Carrito Multi-Origen</button>
              </div>
              <div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.86rem;">
                Sin guías registradas. Agrupa productos en el carrito multi-origen y confirma el despacho para emitir guías independientes.
              </div>
            </div>
          ` : `
            <div class="erp-table-wrapper" style="margin-bottom: 1.25rem;">
              <div class="erp-table-toolbar">
                <strong>Tabla de Control de Guías por Envío (${shipments.length})</strong>
                <span style="font-size:0.78rem; color:var(--text-muted);">1 guía por cada origen de despacho</span>
              </div>
              <div class="erp-table-scroll">
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>Guía / Pedido</th>
                      <th>Origen</th>
                      <th>Ruta</th>
                      <th>Transportadora</th>
                      <th class="num-col">Cobertura</th>
                      <th class="num-col">Flete COP</th>
                      <th>Estado</th>
                      <th>Evaluación</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${shipments.map(s => `
                      <tr>
                        <td><strong>${this.escapeHtml(s.id)}</strong><br><span style="font-size:0.74rem; color:var(--text-dim);">Ped. ${this.escapeHtml(s.checkout_group_id)}</span></td>
                        <td>${s.origin_type === 'propio' ? 'Inventario Propio' : 'Red Dropi'}<br><span style="font-size:0.74rem; color:var(--text-muted);">${this.escapeHtml(s.origin_label)}</span></td>
                        <td>${this.escapeHtml(s.origin_city)} → ${this.escapeHtml(s.destination_city)}<br><span style="font-size:0.74rem; color:var(--text-muted);">${this.escapeHtml(s.customer_name)}</span></td>
                        <td><strong>${this.escapeHtml(s.carrier_name)}</strong><br><span style="font-size:0.74rem; color:var(--text-muted);">${this.escapeHtml(s.estimated_time)}</span></td>
                        <td class="num-col">${s.carrier_coverage}%</td>
                        <td class="num-col">$${Number(s.shipping_cost).toLocaleString('es-CO')}</td>
                        <td><span class="erp-status-pill ${s.status === 'ENTREGADO' ? 'ok' : 'warn'}">${this.escapeHtml(s.status)}</span></td>
                        <td>${s.eval ? `Prov: ${s.eval.punctuality}/5 • Esp: ${s.eval.specQuality}/5` : '<span style="color:var(--text-muted);">Pendiente</span>'}</td>
                        <td>
                          <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
                            ${s.status !== 'ENTREGADO' ? `<button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.25rem 0.5rem;" onclick="window.consoleApp.advanceShipment('${s.id}')">Registrar Avance</button>` : ''}
                            <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.25rem 0.5rem; border-color:var(--accent-1);" onclick="window.consoleApp.openShipmentEvalModal('${s.id}')">${s.evaluated ? 'Actualizar Eval.' : 'Evaluar'}</button>
                          </div>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="shipping-timeline-container" style="margin-top: 0;">
              ${shipments.map(s => `
                <div style="background: #FFFFFF; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 1rem; margin-bottom: 0.9rem;">
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.65rem;">
                    <strong>Guía ${this.escapeHtml(s.id)} — ${this.escapeHtml(s.origin_label)} → ${this.escapeHtml(s.destination_city)}</strong>
                    <span class="erp-status-pill ${s.status === 'ENTREGADO' ? 'ok' : 'warn'}">${this.escapeHtml(s.status)}</span>
                  </div>
                  <div class="shipping-steps-track" style="margin: 0.5rem 0;">
                    ${(s.steps || []).map(st => `
                      <div class="shipping-step-item ${st.done ? 'done' : ''} ${st.current ? 'current' : ''}">
                        <div class="step-icon-circle">${st.done ? '✓' : '•'}</div>
                        <div class="step-info-title">${this.escapeHtml(st.title)}</div>
                        <div class="step-info-date">${this.escapeHtml(st.date)}</div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        ` : ''}

        ${activeTab === 'transportadoras' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Matriz de Asignación Aparte de Transportadoras</strong>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                <select onchange="window.consoleApp.setCarrierSimRoute('origin', this.value)" class="form-control" style="width: auto; font-size: 0.8rem;">
                  ${['Medellín', 'Bogotá D.C.', 'Cali', 'Barranquilla', 'Bucaramanga'].map(c => `<option value="${c}" ${this.simOriginCity === c ? 'selected' : ''}>Origen: ${c}</option>`).join('')}
                </select>
                <select onchange="window.consoleApp.setCarrierSimRoute('dest', this.value)" class="form-control" style="width: auto; font-size: 0.8rem;">
                  ${['Bogotá D.C.', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Cartagena'].map(c => `<option value="${c}" ${this.simDestCity === c ? 'selected' : ''}>Destino: ${c}</option>`).join('')}
                </select>
                <select onchange="window.consoleApp.setCarrierSimRoute('priority', this.value)" class="form-control" style="width: auto; font-size: 0.8rem;">
                  <option value="balanced" ${this.carrierPriority === 'balanced' ? 'selected' : ''}>Criterio: Equilibrio</option>
                  <option value="coverage" ${this.carrierPriority === 'coverage' ? 'selected' : ''}>Priorizar Cobertura</option>
                  <option value="cheapest" ${this.carrierPriority === 'cheapest' ? 'selected' : ''}>Priorizar Menor Costo</option>
                  <option value="fastest" ${this.carrierPriority === 'fastest' ? 'selected' : ''}>Priorizar Menor Tiempo</option>
                </select>
              </div>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Transportadora</th>
                    <th>Ruta Evaluada</th>
                    <th class="num-col">Cobertura</th>
                    <th class="num-col">Costo Flete (COP)</th>
                    <th>Tiempo Estimado</th>
                    <th>Asignación</th>
                  </tr>
                </thead>
                <tbody>
                  ${simEval.carriers.map((c, idx) => `
                    <tr>
                      <td><strong>${this.escapeHtml(c.name)}</strong></td>
                      <td>${this.escapeHtml(this.simOriginCity)} → ${this.escapeHtml(this.simDestCity)}</td>
                      <td class="num-col">${c.coverage}%</td>
                      <td class="num-col">$${Number(c.cost).toLocaleString('es-CO')}</td>
                      <td>${this.escapeHtml(c.estimatedTime)}</td>
                      <td>${idx === 0 ? '<span class="erp-status-pill ok">ASIGNADA</span>' : '<span class="erp-status-pill">Alternativa</span>'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${activeTab === 'avisos' ? `
          <div class="erp-table-wrapper" style="margin-bottom: 1rem;">
            <div class="erp-table-toolbar">
              <strong>Bitácora de Avisos Logísticos y Recepción</strong>
              <span style="font-size:0.78rem; color:var(--text-muted);">${allNotices.length} notificaciones</span>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Hora / Fecha</th>
                    <th>Guía</th>
                    <th>Origen</th>
                    <th>Evento</th>
                    <th>Detalle del Aviso</th>
                  </tr>
                </thead>
                <tbody>
                  ${allNotices.length === 0 ? `
                    <tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No hay avisos logísticos registrados en el periodo actual.</td></tr>
                  ` : allNotices.map(n => `
                    <tr>
                      <td class="num-col">${this.escapeHtml(n.time || 'N/D')}</td>
                      <td><strong>${this.escapeHtml(n.guideId)}</strong></td>
                      <td>${this.escapeHtml(n.origin || '')}</td>
                      <td><strong>${this.escapeHtml(n.title)}</strong></td>
                      <td>${this.escapeHtml(n.message)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div style="background:#F8F8F6; border:1px solid var(--border-subtle); border-left:4px solid #111111; border-radius:6px; padding:0.85rem 1rem; font-size:0.82rem; color:var(--text-main);">
            <strong>Nota de alcance — Devoluciones (Fase Posterior):</strong> Conforme al alcance acordado para esta etapa, la gestión de devoluciones y logística inversa permanece reservada para la siguiente fase del proyecto.
          </div>
        ` : ''}

        ${this.renderErpAuditFooter({
          entity: storeName,
          moduleLabel: mod.fullName,
          count: activeTab === 'transportadoras' ? simEval.carriers.length : (activeTab === 'avisos' ? allNotices.length : shipments.length),
          exportKey: 'shipping'
        })}
      `;
    }

    // 3. Estación 02: Kanban 3D Editable, Proyección Ponderada y Fidelización
    if (mod.id === 'crm-pipeline') {
      await window.EasyGrowCRM.syncWithServer(false);
      await this.loadStages();
      await this.loadPurchases();
      await this.loadFormulas();
      await this.loadMetrics();

      const contacts = window.EasyGrowCRM.getAll();
      const stages = this.stages.length > 0 ? this.stages : [
        { id: 'def_1', slug: 'prospects', name: 'Prospectos Iniciales', common_category: 'nuevo', probability: 20 },
        { id: 'def_2', slug: 'negotiation', name: 'Propuesta Enviada / Negociación', common_category: 'en_progreso', probability: 50 },
        { id: 'def_3', slug: 'closed', name: 'Ventas Ganadas (Cierre)', common_category: 'ganado', probability: 100 },
        { id: 'def_4', slug: 'lost', name: 'Oportunidad Perdida', common_category: 'perdido', probability: 0 }
      ];

      const catLabels = {
        nuevo: 'NUEVO',
        en_progreso: 'EN PROGRESO',
        ganado: 'GANADO',
        perdido: 'PERDIDO'
      };
      const catColors = {
        nuevo: '#111111',
        en_progreso: '#B47800',
        ganado: 'var(--accent-1)',
        perdido: 'var(--data-crimson)'
      };

      const hist = this.historyAnalysis;
      const periodLabels = {
        all: 'Todo el historial',
        month: 'Este mes',
        '7d': 'Últimos 7 días',
        today: 'Hoy'
      };
      const activeTab = this.getModuleSubTab('crm-pipeline', 'kanban');
      const storeName = this.getActiveStoreName ? this.getActiveStoreName() : 'EasyGrow';
      const activeIndicators = this.getDashboardIndicatorCatalog(periodLabels[this.metricsPeriod] || 'Periodo')
        .filter(ind => this.selectedDashboardKPIs.includes(ind.id));
      const totalRawPipeline = contacts.reduce((acc, c) => acc + (Number(c.value) || 0), 0);
      const totalWeightedPipeline = stages.reduce((sum, st) => {
        const stContacts = contacts.filter(c => c.stage === st.slug);
        const rawSum = stContacts.reduce((acc, c) => acc + (Number(c.value) || 0), 0);
        return sum + Math.round(rawSum * ((Number(st.probability) || 0) / 100));
      }, 0);

      return `
        ${this.renderErpHeader({
          code: 'MOD-03.1',
          title: mod.fullName,
          subtitle: 'Tablero Kanban 3D por etapas editables, proyección ponderada e historial de fidelización por compras.',
          helpText: 'Cada tienda edita sus etapas manteniéndolas vinculadas a una categoría común (nuevo, en progreso, ganado, perdido). La proyección sigue la fórmula compartida Valor × Probabilidad de etapa. La tabla de fidelización conserva productos, montos y fechas estimada y real por compra.',
          actionsHtml: `
            <button type="button" class="btn-secondary" onclick="window.consoleApp.openStagesConfigModal()">Editar Etapas</button>
            <button type="button" class="btn-secondary" onclick="window.consoleApp.openPurchaseRecordModal()">+ Registrar Compra</button>
            <button type="button" class="btn-secondary" onclick="window.consoleApp.openExcelModal()">Importar Excel CRM</button>
            <button type="button" class="btn-primary-large" style="font-size:0.84rem;" onclick="window.consoleApp.addQuickOpportunity()">+ Nueva Oportunidad</button>
          `
        })}

        <div class="erp-kpi-strip">
          ${activeIndicators.map(ind => `
            <div class="erp-kpi-cell">
              <span class="erp-kpi-lbl">${ind.label}</span>
              <span class="erp-kpi-val num-col" style="color: ${ind.color || 'var(--text-main)'};">${ind.value}</span>
              <span class="erp-kpi-sub">${ind.sub}</span>
            </div>
          `).join('')}
        </div>

        ${this.renderErpSubTabs('crm-pipeline', activeTab, [
          { key: 'kanban', label: '1. Tablero Kanban & KPIs', count: contacts.length },
          { key: 'clientes', label: '2. Clientes & Historial de Compras', count: (this.purchases || []).length },
          { key: 'proyeccion', label: '3. Proyección & Probabilidades', count: stages.length }
        ])}

        ${activeTab === 'kanban' ? `
          <div class="erp-table-wrapper" style="margin-bottom: 1rem;">
            <div class="erp-table-toolbar">
              <div class="erp-chip-group">
                <span style="font-size:0.74rem; font-weight:700; color:var(--text-muted); margin-right:0.25rem;">Indicadores visibles:</span>
                ${this.getDashboardIndicatorCatalog(periodLabels[this.metricsPeriod] || 'Periodo').map(ind => {
                  const active = this.selectedDashboardKPIs.includes(ind.id);
                  return `<button type="button" class="erp-chip ${active ? 'active' : ''}" onclick="window.consoleApp.toggleDashboardKPI('${ind.id}')">${active ? '✓ ' : '+ '}${ind.label}</button>`;
                }).join('')}
              </div>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <label style="font-size:0.76rem; font-weight:700; color:var(--text-muted);">Periodo:</label>
                <select class="form-control" onchange="window.consoleApp.changeMetricsPeriod(this.value)" style="width:auto; font-size:0.8rem;">
                  <option value="all" ${this.metricsPeriod === 'all' ? 'selected' : ''}>Todo el historial</option>
                  <option value="month" ${this.metricsPeriod === 'month' ? 'selected' : ''}>Este mes</option>
                  <option value="7d" ${this.metricsPeriod === '7d' ? 'selected' : ''}>Últimos 7 días</option>
                  <option value="today" ${this.metricsPeriod === 'today' ? 'selected' : ''}>Hoy</option>
                </select>
              </div>
            </div>
          </div>

          <div class="pipeline-board-grid">
            ${stages.map(st => {
              const stContacts = contacts.filter(c => c.stage === st.slug);
              const rawSum = stContacts.reduce((acc, c) => acc + (Number(c.value) || 0), 0);
              const weightedSum = Math.round(rawSum * ((Number(st.probability) || 0) / 100));
              return `
                <div class="kanban-column cat-${st.common_category}" id="kanban-col-${st.slug}">
                  <div class="kanban-col-header">
                    <div>
                      <div class="kanban-col-title">
                        <span class="kanban-dot" style="background: ${catColors[st.common_category] || '#111111'};"></span>
                        <span>${this.escapeHtml(st.name)}</span>
                      </div>
                      <div class="erp-chip-group" style="margin-top:0.35rem;">
                        <span class="erp-status-pill" style="font-size:0.65rem;">${catLabels[st.common_category] || st.common_category}</span>
                        <span class="erp-status-pill ok" style="font-size:0.65rem;">Prob: ${st.probability}%</span>
                      </div>
                    </div>
                    <div style="text-align: right;">
                      <span class="kanban-sum-pill num-col" title="Total nominal en etapa">$${rawSum.toLocaleString('es-CO')}</span>
                      <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 0.25rem; font-family: monospace;" title="Valor ponderado: Valor × ${st.probability}%">
                        Pond: <b style="color: var(--accent-1);">$${weightedSum.toLocaleString('es-CO')}</b>
                      </div>
                    </div>
                  </div>
                  <div class="kanban-cards-stack">
                    ${this.renderKanbanCards(stContacts, stages, st)}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        ${activeTab === 'clientes' ? `
          <div id="crm-loyalty-section">
            ${this.renderLoyaltyAndPurchasesSection(contacts, stages)}
          </div>
        ` : ''}

        ${activeTab === 'proyeccion' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <div>
                <strong>Proyección Ponderada por Etapa (Fórmula: Valor × Probabilidad)</strong>
                <div style="font-size:0.78rem; color:var(--text-muted);">
                  ${hist && hist.suggestions && hist.suggestions.length > 0
                    ? `${hist.suggestions.length} ajuste(s) sugerido(s) con base en ${hist.resolvedCount} cierres históricos (${hist.empiricalWinPct}% conversión).`
                    : 'Probabilidades iniciales configurables por etapa (se generan sugerencias al superar ≥ 3 cierres resueltos).'}
                </div>
              </div>
              <button type="button" class="btn-primary-large" style="font-size:0.8rem;" onclick="window.consoleApp.openStagesConfigModal()">
                ${hist && hist.suggestions && hist.suggestions.length > 0 ? 'Revisar Sugerencias y Etapas' : 'Editar Probabilidades'}
              </button>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Etapa Kanban</th>
                    <th>Categoría Común</th>
                    <th class="num-col">Oportunidades</th>
                    <th class="num-col">Probabilidad</th>
                    <th class="num-col">Valor Nominal (COP)</th>
                    <th class="num-col">Valor Ponderado (COP)</th>
                  </tr>
                </thead>
                <tbody>
                  ${stages.map(st => {
                    const stContacts = contacts.filter(c => c.stage === st.slug);
                    const rawSum = stContacts.reduce((acc, c) => acc + (Number(c.value) || 0), 0);
                    const weightedSum = Math.round(rawSum * ((Number(st.probability) || 0) / 100));
                    return `
                      <tr>
                        <td><strong>${this.escapeHtml(st.name)}</strong></td>
                        <td><span class="erp-status-pill">${catLabels[st.common_category] || st.common_category}</span></td>
                        <td class="num-col">${stContacts.length}</td>
                        <td class="num-col"><strong>${st.probability}%</strong></td>
                        <td class="num-col">$${rawSum.toLocaleString('es-CO')}</td>
                        <td class="num-col" style="color:var(--accent-1); font-weight:700;">$${weightedSum.toLocaleString('es-CO')}</td>
                      </tr>
                    `;
                  }).join('')}
                  <tr style="background:#F8F9F6; font-weight:800;">
                    <td colspan="2"><strong>TOTAL CARTERA PROYECTADA</strong></td>
                    <td class="num-col">${contacts.length}</td>
                    <td class="num-col">—</td>
                    <td class="num-col">$${totalRawPipeline.toLocaleString('es-CO')}</td>
                    <td class="num-col" style="color:var(--accent-1);">$${totalWeightedPipeline.toLocaleString('es-CO')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${this.renderErpAuditFooter({
          entity: storeName,
          moduleLabel: mod.fullName,
          count: activeTab === 'clientes' ? (this.purchases || []).length : contacts.length,
          exportKey: 'crm_contacts'
        })}
      `;
    }

    // 4. Constructor Visual de Fórmulas (Mis Fórmulas / Comunidad) + Prospección B2B
    if (mod.id === 'prospecting') {
      await this.loadFormulas();
      await this.loadMetrics();
      const activeTab = this.getModuleSubTab('prospecting', 'mis_formulas');
      const storeName = this.getActiveStoreName ? this.getActiveStoreName() : 'EasyGrow';
      const defaultDir = [
        { name: "Andina Logistics & E-com", person: "Andrés Montoya", phone: "+57 311 889 0011", value: 18000000, sector: "Mayoristas / Logística", emp: "25-50", score: "96%" },
        { name: "NovaStore Retail Colombia", person: "Paola Herrera", phone: "+57 321 776 5544", value: 9500000, sector: "Retail / Calzado & Gadgets", emp: "10-20", score: "92%" },
        { name: "BioHealth Distribuciones", person: "Carlos Vives", phone: "+57 300 456 7890", value: 14200000, sector: "Salud / Bienestar", emp: "15-30", score: "94%" },
        { name: "DropiTech Solutions", person: "Valeria Duque", phone: "+57 318 654 3210", value: 22000000, sector: "Dropshipping / Tecnología", emp: "30-60", score: "98%" }
      ];

      return `
        ${this.renderErpHeader({
          code: 'MOD-03.2',
          title: mod.fullName,
          subtitle: 'Constructor visual de KPIs con validación sintáctica, espacios separados privados/comunitarios y directorio B2B.',
          helpText: 'Las fórmulas creadas se guardan en espacios separados: Mis Fórmulas (privadas por tienda) y Biblioteca Comunidad (solo estructura, nunca expone datos comerciales). El directorio B2B permite importar cuentas calificadas al pipeline.',
          actionsHtml: `
            <button type="button" class="btn-secondary" onclick="window.consoleApp.setModuleSubTab('prospecting', 'constructor')">+ Nueva Fórmula</button>
            <button type="button" class="btn-secondary" onclick="window.consoleApp.exportAuditTableToExcel('formulas')">Exportar Excel Auditoría</button>
          `
        })}

        <div class="erp-kpi-strip">
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Mis Fórmulas Privadas</span>
            <span class="erp-kpi-val num-col">${this.privateFormulas.length}</span>
            <span class="erp-kpi-sub">Uso exclusivo de tienda</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Biblioteca Comunidad</span>
            <span class="erp-kpi-val num-col">${this.communityFormulas.length}</span>
            <span class="erp-kpi-sub">Plantillas sin datos privados</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Directorio B2B Disponible</span>
            <span class="erp-kpi-val num-col">${defaultDir.length}</span>
            <span class="erp-kpi-sub">Empresas verificadas</span>
          </div>
        </div>

        ${this.renderErpSubTabs('prospecting', activeTab, [
          { key: 'mis_formulas', label: '1. Mis Fórmulas Privadas', count: this.privateFormulas.length },
          { key: 'comunidad', label: '2. Biblioteca Comunidad', count: this.communityFormulas.length },
          { key: 'constructor', label: '3. Constructor Visual' },
          { key: 'b2b', label: '4. Directorio B2B', count: defaultDir.length }
        ])}

        ${activeTab === 'mis_formulas' || activeTab === 'comunidad' || activeTab === 'constructor' ? `
          <div id="crm-formulas-studio">
            ${this.renderFormulasStudioSection(activeTab)}
          </div>
        ` : `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Directorio B2B Verificado para Prospección</strong>
              <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                <input type="text" id="prospect-search-input" class="form-control" placeholder="Filtrar por sector o empresa..." style="min-width:250px;">
                <button type="button" class="btn-primary-large" style="font-size:0.8rem;" onclick="window.consoleApp.filterProspectsList()">Filtrar Directorio</button>
              </div>
            </div>
            <div class="erp-table-scroll" id="prospects-table-container">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Empresa / Razón Social</th>
                    <th>Contacto Principal</th>
                    <th>Sector</th>
                    <th>Tamaño</th>
                    <th class="num-col">Valor Potencial (COP)</th>
                    <th class="num-col">Afinidad</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${defaultDir.map(item => `
                    <tr>
                      <td><strong>${this.escapeHtml(item.name)}</strong></td>
                      <td>${this.escapeHtml(item.person)}<br><span style="font-size:0.74rem; color:var(--text-muted);">${this.escapeHtml(item.phone)}</span></td>
                      <td>${this.escapeHtml(item.sector)}</td>
                      <td>${this.escapeHtml(item.emp)} emp.</td>
                      <td class="num-col">$${Number(item.value).toLocaleString('es-CO')}</td>
                      <td class="num-col"><span class="erp-status-pill ok">${item.score}</span></td>
                      <td>
                        <button type="button" class="btn-secondary" style="font-size:0.74rem; padding:0.25rem 0.6rem; border-color:var(--accent-1);" onclick="window.consoleApp.importProspectToCRM('${item.name}', '${item.person}', '${item.phone}', ${item.value})">+ Importar a CRM</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `}

        ${this.renderErpAuditFooter({
          entity: storeName,
          moduleLabel: mod.fullName,
          count: activeTab === 'comunidad' ? this.communityFormulas.length : (activeTab === 'b2b' ? defaultDir.length : this.privateFormulas.length),
          exportKey: 'formulas'
        })}
      `;
    }

    // 5. Google Forms, Clasificación Asistida y Tabla/Excel para Análisis Humano (Estación 03)
    if (mod.id === 'forms-surveys') {
      const cfg = this.station3Config || {
        form_title: 'Formulario Google Forms — Captación y Requerimientos EasyGrow',
        google_form_url: 'https://docs.google.com/forms/d/e/1FAIpQLSeEG_demo/viewform',
        embed_url: 'https://docs.google.com/forms/d/e/1FAIpQLSeEG_demo/viewform?embedded=true',
        auto_created: 1
      };
      const embedSnippet = `<iframe src="${this.escapeHtml(cfg.embed_url)}" width="100%" height="580" frameborder="0" marginheight="0" marginwidth="0">Cargando formulario EasyGrow...</iframe>`;

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const todayDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const categories = Array.from(new Set([
        ...this.formRules.map(r => r.category_name),
        ...this.formSubmissions.map(s => s.matched_category)
      ]));

      const filteredSubs = this.formSubmissions.filter(s => {
        if (this.formFilterCategory !== 'ALL' && s.matched_category !== this.formFilterCategory) return false;
        if (this.formFilterStatus !== 'ALL' && s.human_status !== this.formFilterStatus) return false;
        return true;
      });
      const pendingCount = this.formSubmissions.filter(s => s.human_status === 'Pendiente de revisión').length;
      const activeTab = this.getModuleSubTab('forms-surveys', 'respuestas');
      const storeName = this.getActiveStoreName ? this.getActiveStoreName() : 'EasyGrow';

      return `
        ${this.renderErpHeader({
          code: 'MOD-04.1',
          title: mod.fullName,
          subtitle: 'Bandeja de respuestas verificadas por fecha y hora, reglas de clasificación y exportación a Excel.',
          helpText: 'Vincula o autocrea formularios de Google Forms (enlace e inserción web). Las respuestas registran fecha y hora exacta de recepción, aplican reglas definidas por el usuario con apoyo de IA y conservan el análisis final en criterio humano.',
          actionsHtml: `
            <button type="button" class="btn-secondary" onclick="window.consoleApp.aiOrganizeFormSubmissions()">Sugerir Categorías (IA)</button>
            <button type="button" class="btn-primary-large" style="font-size:0.84rem;" onclick="window.consoleApp.exportFormSubmissionsToExcel()">Exportar Excel Auditoría</button>
          `
        })}

        <div class="erp-kpi-strip">
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Respuestas Recibidas</span>
            <span class="erp-kpi-val num-col">${this.formSubmissions.length}</span>
            <span class="erp-kpi-sub">Con fecha y hora verificada</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Reglas Activas</span>
            <span class="erp-kpi-val num-col" style="color: var(--accent-1);">${this.formRules.length}</span>
            <span class="erp-kpi-sub">Clasificación por requerimiento</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Pendientes de Revisión</span>
            <span class="erp-kpi-val num-col">${pendingCount}</span>
            <span class="erp-kpi-sub">Análisis humano requerido</span>
          </div>
        </div>

        ${this.renderErpSubTabs('forms-surveys', activeTab, [
          { key: 'respuestas', label: '1. Bandeja de Respuestas & Auditoría Excel', count: filteredSubs.length },
          { key: 'reglas', label: '2. Reglas de Clasificación', count: this.formRules.length },
          { key: 'conexion', label: '3. Conexión Google Forms' },
          { key: 'registro_manual', label: '4. Registro Manual de Respuesta' }
        ])}

        ${activeTab === 'respuestas' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Tabla Clasificada para Análisis Humano (${filteredSubs.length})</strong>
              <div style="display: flex; gap: 0.55rem; flex-wrap: wrap; align-items: center;">
                <select class="form-control" onchange="window.consoleApp.formFilterCategory = this.value; window.consoleApp.openModuleFull('forms-surveys', false);" style="width: auto; font-size: 0.78rem;">
                  <option value="ALL" ${this.formFilterCategory === 'ALL' ? 'selected' : ''}>Todas las Categorías</option>
                  ${categories.map(c => `<option value="${this.escapeHtml(c)}" ${this.formFilterCategory === c ? 'selected' : ''}>${this.escapeHtml(c)}</option>`).join('')}
                </select>
                <select class="form-control" onchange="window.consoleApp.formFilterStatus = this.value; window.consoleApp.openModuleFull('forms-surveys', false);" style="width: auto; font-size: 0.78rem;">
                  <option value="ALL" ${this.formFilterStatus === 'ALL' ? 'selected' : ''}>Todos los Estados</option>
                  <option value="Pendiente de revisión" ${this.formFilterStatus === 'Pendiente de revisión' ? 'selected' : ''}>Pendiente de revisión</option>
                  <option value="Revisado - Aprobado" ${this.formFilterStatus === 'Revisado - Aprobado' ? 'selected' : ''}>Revisado - Aprobado</option>
                  <option value="Revisado - Descartado" ${this.formFilterStatus === 'Revisado - Descartado' ? 'selected' : ''}>Revisado - Descartado</option>
                </select>
              </div>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Fecha / Hora</th>
                    <th>Remitente / Canal</th>
                    <th style="min-width: 220px;">Requerimiento Pedido</th>
                    <th style="min-width: 190px;">Clasificación (Regla / IA)</th>
                    <th style="min-width: 200px;">Revisión Humana y Notas</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredSubs.length === 0 ? `
                    <tr><td colspan="6" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No hay respuestas registradas con el filtro actual. Utiliza "4. Registro Manual de Respuesta" o completa un formulario vinculado.</td></tr>
                  ` : filteredSubs.map(sub => `
                    <tr>
                      <td class="num-col" style="white-space: nowrap;">
                        <div style="font-weight: 700; color: var(--text-main);">${this.escapeHtml(sub.created_date)}</div>
                        <div style="color: var(--accent-1); font-size: 0.74rem;">${this.escapeHtml(sub.created_time)} ✓</div>
                      </td>
                      <td>
                        <strong>${this.escapeHtml(sub.respondent_name)}</strong>
                        ${sub.respondent_contact ? `<div style="font-size: 0.74rem; color: var(--text-muted);">${this.escapeHtml(sub.respondent_contact)}</div>` : ''}
                        <span class="erp-status-pill" style="margin-top:0.2rem;">${this.escapeHtml(sub.source_channel)}</span>
                      </td>
                      <td style="line-height: 1.4;">${this.escapeHtml(sub.requirement_text)}</td>
                      <td>
                        <select id="sub-cat-${sub.id}" class="form-control" style="font-size: 0.76rem; margin-bottom: 0.3rem;">
                          ${Array.from(new Set([...categories, sub.matched_category, sub.ai_suggested_category])).map(cat => `
                            <option value="${this.escapeHtml(cat)}" ${sub.matched_category === cat ? 'selected' : ''}>${this.escapeHtml(cat)}</option>
                          `).join('')}
                        </select>
                        <div style="font-size: 0.7rem; color: var(--accent-1);">Sugerencia IA: <b>${this.escapeHtml(sub.ai_suggested_category)}</b></div>
                      </td>
                      <td>
                        <select id="sub-status-${sub.id}" class="form-control" style="font-size: 0.75rem; margin-bottom: 0.3rem;">
                          <option value="Pendiente de revisión" ${sub.human_status === 'Pendiente de revisión' ? 'selected' : ''}>Pendiente de revisión</option>
                          <option value="Revisado - Aprobado" ${sub.human_status === 'Revisado - Aprobado' ? 'selected' : ''}>Revisado - Aprobado</option>
                          <option value="Revisado - Descartado" ${sub.human_status === 'Revisado - Descartado' ? 'selected' : ''}>Revisado - Descartado</option>
                        </select>
                        <input type="text" id="sub-notes-${sub.id}" class="form-control" value="${this.escapeHtml(sub.human_notes || '')}" placeholder="Nota análisis humano..." style="font-size: 0.74rem;">
                      </td>
                      <td style="white-space: nowrap;">
                        <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                          <button type="button" class="btn-primary-large" onclick="window.consoleApp.saveHumanReview('${sub.id}')" style="font-size: 0.72rem; padding: 0.3rem 0.65rem; justify-content: center;">Guardar</button>
                          <button type="button" class="btn-secondary" onclick="window.consoleApp.sendReviewedRowToCRM('${sub.id}')" style="font-size: 0.7rem; padding: 0.25rem 0.55rem;">→ Enviar a CRM</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${activeTab === 'reglas' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Reglas de Clasificación por Requerimiento</strong>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                <input type="text" id="new-rule-category" class="form-control" placeholder="Categoría (ej: Distribuidor VIP)" style="min-width:190px;">
                <input type="text" id="new-rule-keywords" class="form-control" placeholder="Palabras clave separadas por coma" style="min-width:220px;">
                <button type="button" class="btn-primary-large" onclick="window.consoleApp.addFormRule()" style="font-size: 0.8rem;">+ Agregar Regla</button>
              </div>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Categoría de Destino</th>
                    <th>Origen de la Regla</th>
                    <th>Palabras Clave (Criterio)</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.formRules.length === 0 ? `
                    <tr><td colspan="4" style="text-align:center; padding:1.25rem; color:var(--text-muted);">No hay reglas definidas todavía.</td></tr>
                  ` : this.formRules.map(r => `
                    <tr>
                      <td><strong>${this.escapeHtml(r.category_name)}</strong></td>
                      <td><span class="erp-status-pill ${r.source === 'ai' ? 'warn' : 'ok'}">${r.source === 'ai' ? 'Sugerida IA' : 'Regla Usuario'}</span></td>
                      <td><code style="background:#F4F5F2; padding:2px 6px; border-radius:4px; font-size:0.76rem;">${this.escapeHtml(r.keywords)}</code></td>
                      <td>
                        <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.2rem 0.5rem;" onclick="window.consoleApp.deleteFormRule('${r.id}')">Eliminar</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${activeTab === 'conexion' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Vinculación y Autocreación de Google Forms</strong>
              <button type="button" class="btn-primary-large" onclick="window.consoleApp.saveGoogleFormConfig('autocreate')" style="font-size: 0.8rem;">Autocrear / Regenerar Plantilla Google Forms</button>
            </div>
            <div style="padding: 1.15rem;">
              <div style="display: grid; grid-template-columns: 1.2fr 1.8fr auto; gap: 0.75rem; align-items: end; margin-bottom: 1.15rem;">
                <div>
                  <label style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Nombre del Formulario</label>
                  <input type="text" id="gforms-title-input" class="form-control" value="${this.escapeHtml(cfg.form_title)}">
                </div>
                <div>
                  <label style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Enlace de Google Forms vinculado (<code>.../viewform</code>)</label>
                  <input type="url" id="gforms-url-input" class="form-control" value="${this.escapeHtml(cfg.google_form_url)}" style="font-family: monospace; font-size: 0.8rem;">
                </div>
                <button type="button" class="btn-secondary" onclick="window.consoleApp.saveGoogleFormConfig('link')" style="height: 36px; border-color: #111111; font-weight: 700;">Vincular Google Form</button>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 1rem;">
                <div style="background: #F8F9F6; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 0.9rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
                    <strong style="font-size: 0.82rem; color: var(--text-main);">Opción A • Enlace Directo Compartible</strong>
                    <button type="button" class="btn-secondary" onclick="window.consoleApp.copyStation3Text('${this.escapeHtml(cfg.google_form_url)}', 'Enlace de Google Forms')" style="padding: 3px 9px; font-size: 0.72rem;">Copiar Enlace</button>
                  </div>
                  <code style="display: block; word-break: break-all; background: #FFFFFF; border: 1px solid var(--border-subtle); padding: 0.45rem 0.6rem; border-radius: 4px; font-size: 0.74rem; color: #111111;">${this.escapeHtml(cfg.google_form_url)}</code>
                </div>

                <div style="background: #F8F9F6; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 0.9rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
                    <strong style="font-size: 0.82rem; color: var(--text-main);">Opción B • Inserción en Página Web (&lt;iframe&gt;)</strong>
                    <button type="button" class="btn-secondary" id="btn-copy-gforms-embed" onclick="window.consoleApp.copyGFormsEmbed()" style="padding: 3px 9px; font-size: 0.72rem;">Copiar HTML</button>
                  </div>
                  <code id="gforms-embed-code" style="display: block; word-break: break-all; background: #FFFFFF; border: 1px solid var(--border-subtle); padding: 0.45rem 0.6rem; border-radius: 4px; font-size: 0.72rem; color: #111111;">${this.escapeHtml(embedSnippet)}</code>
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        ${activeTab === 'registro_manual' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Registro Manual / Recepción de Respuesta de Google Forms</strong>
              <div class="erp-chip-group">
                <button type="button" class="erp-chip" onclick="window.consoleApp.fillFormSubmissionSample('mayorista')">Plantilla: Mayorista</button>
                <button type="button" class="erp-chip" onclick="window.consoleApp.fillFormSubmissionSample('catalogo')">Plantilla: Catálogo</button>
                <button type="button" class="erp-chip" onclick="window.consoleApp.fillFormSubmissionSample('especial')">Plantilla: Requerimiento Especial</button>
              </div>
            </div>
            <div style="padding: 1.15rem;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 0.75rem;">
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Nombre / Empresa *</label>
                  <input type="text" id="gf-sub-name" class="form-control" placeholder="Ej: Laura Mendoza">
                </div>
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Contacto (Correo / WhatsApp)</label>
                  <input type="text" id="gf-sub-contact" class="form-control" placeholder="laura@tienda.co / 310...">
                </div>
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Fecha Verificada</label>
                  <input type="date" id="gf-sub-date" class="form-control" value="${todayDate}">
                </div>
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Hora Exacta de Creación</label>
                  <input type="time" id="gf-sub-time" step="1" class="form-control" value="${nowTime}">
                </div>
              </div>

              <div style="margin-bottom: 0.9rem;">
                <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Requerimiento / Solicitud recibida *</label>
                <textarea id="gf-sub-req" rows="2" class="form-control" placeholder="Describe lo que solicita la persona (ej: Cotización mayorista de 50 unidades con entrega en Medellín)..."></textarea>
              </div>

              <button type="button" class="btn-primary-large" onclick="window.consoleApp.submitGoogleFormResponse()">
                Registrar Respuesta, Verificar Hora/Fecha y Clasificar en Tabla
              </button>
            </div>
          </div>
        ` : ''}

        ${this.renderErpAuditFooter({
          entity: storeName,
          moduleLabel: mod.fullName,
          count: activeTab === 'reglas' ? this.formRules.length : filteredSubs.length,
          exportKey: 'forms'
        })}
      `;
    }

    // 6. Códigos QR Dinámicos sin Reimpresión (Estación 03)
    if (mod.id === 'qr-generator') {
      const totalAllScans = this.qrCodes.reduce((s, q) => s + (Number(q.total_scans) || 0), 0);
      const totalUniqueScans = this.qrCodes.reduce((s, q) => s + (Number(q.unique_scans) || 0), 0);
      const totalIdentified = this.qrCodes.reduce((s, q) => s + (Number(q.identified_leads) || 0), 0);
      const cfgUrl = (this.station3Config && this.station3Config.google_form_url) || 'https://docs.google.com/forms/d/e/1FAIpQLSeEG_form/viewform';
      const activeTab = this.getModuleSubTab('qr-generator', 'directorio');
      const storeName = this.getActiveStoreName ? this.getActiveStoreName() : 'EasyGrow';

      const destLabels = {
        google_form: 'Google Form de Captación',
        product: 'Página de Producto',
        whatsapp: 'WhatsApp Directo',
        custom: 'Otra Página / URL'
      };

      return `
        ${this.renderErpHeader({
          code: 'MOD-04.2',
          title: mod.fullName,
          subtitle: 'Directorio de códigos QR dinámicos con cambio de destino en vivo y trazabilidad por campaña.',
          helpText: 'Permite reasignar el destino del QR después de impreso. El escaneo mide totales, únicos y fecha de forma anónima; solo se asocia a una persona cuando completa e identifica el formulario de destino.',
          actionsHtml: `
            <button type="button" class="btn-primary-large" style="font-size:0.84rem;" onclick="window.consoleApp.setModuleSubTab('qr-generator', 'nuevo_qr')">+ Nuevo QR Dinámico</button>
            <button type="button" class="btn-secondary" onclick="window.consoleApp.exportAuditTableToExcel('qrs')">Exportar Excel Auditoría</button>
          `
        })}

        <div class="erp-kpi-strip">
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">QRs Activos</span>
            <span class="erp-kpi-val num-col">${this.qrCodes.length}</span>
            <span class="erp-kpi-sub">Destino editable sin reimprimir</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Escaneos Totales / Únicos</span>
            <span class="erp-kpi-val num-col" style="color: var(--accent-1);">${totalAllScans.toLocaleString('es-CO')} / ${totalUniqueScans.toLocaleString('es-CO')}</span>
            <span class="erp-kpi-sub">Métrica agregada anónima</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Identificados en Form</span>
            <span class="erp-kpi-val num-col">${totalIdentified}</span>
            <span class="erp-kpi-sub">Conversión a registro</span>
          </div>
        </div>

        ${this.renderErpSubTabs('qr-generator', activeTab, [
          { key: 'directorio', label: '1. Directorio de QRs Activos & Métricas', count: this.qrCodes.length },
          { key: 'nuevo_qr', label: '2. + Nuevo QR Dinámico' }
        ])}

        ${activeTab === 'directorio' ? `
          <div class="erp-table-wrapper" style="margin-bottom: 1.25rem;">
            <div class="erp-table-toolbar">
              <strong>Registro Maestro de Códigos QR Dinámicos (${this.qrCodes.length})</strong>
              <span style="font-size:0.78rem; color:var(--text-muted);">Gestión de URL destino e historial por código impreso</span>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Código / Ubicación</th>
                    <th>Campaña / Destino Actual</th>
                    <th class="num-col">Totales / Únicos</th>
                    <th class="num-col">Identificados</th>
                    <th class="num-col">Último Escaneo</th>
                    <th>Reasignar Destino</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.qrCodes.length === 0 ? `
                    <tr><td colspan="6" style="padding:1.5rem; text-align:center; color:var(--text-muted);">No existen QRs creados todavía. Usa la pestaña "2. + Nuevo QR Dinámico".</td></tr>
                  ` : this.qrCodes.map(qr => `
                    <tr>
                      <td>
                        <strong style="font-family:monospace;">${this.escapeHtml(qr.code_slug)}</strong><br>
                        <strong>${this.escapeHtml(qr.name)}</strong><br>
                        <span style="font-size:0.72rem; color:var(--text-muted);">${this.escapeHtml(qr.placement)}</span>
                      </td>
                      <td>
                        <span class="erp-status-pill">${this.escapeHtml(qr.campaign)}</span><br>
                        <span style="font-size:0.74rem; color:var(--accent-1); font-weight:700;">${destLabels[qr.dest_type] || qr.dest_type}</span><br>
                        <code style="font-size:0.7rem; color:var(--text-muted); word-break:break-all;">${this.escapeHtml(qr.target_url)}</code>
                      </td>
                      <td class="num-col"><strong>${Number(qr.total_scans || 0)}</strong> / <span style="color:var(--accent-1);">${Number(qr.unique_scans || 0)}</span></td>
                      <td class="num-col">${Number(qr.identified_leads || 0)}</td>
                      <td class="num-col" style="font-size:0.74rem;">${this.escapeHtml(qr.last_scan_at || 'Sin escaneos')}</td>
                      <td style="white-space:nowrap;">
                        <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.25rem 0.55rem;" onclick="window.consoleApp.downloadQRCodeSvg('${qr.id}', '${this.escapeHtml(qr.code_slug)}')">Descargar SVG</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
            ${this.qrCodes.map(qr => {
              const history = Array.isArray(qr.history) ? qr.history : [];
              const isQuickOpen = this.openQuickFormQrId === qr.id;
              return `
                <div style="background:#FFFFFF; border:1px solid var(--border-subtle); border-radius:8px; padding:1rem; display:grid; grid-template-columns:160px 1fr; gap:1.25rem; align-items:start;">
                  <div style="text-align: center; background: #F8F9F6; padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-subtle);">
                    <div style="background: #FFFFFF; padding: 0.5rem; display: inline-block; border-radius: 6px; border: 1px solid #111111;">
                      ${this.buildDeterministicQRPatternSvg(qr.code_slug)}
                    </div>
                    <div style="margin-top: 0.45rem; font-family: monospace; font-weight: 800; font-size: 0.76rem; color: #111111;">${this.escapeHtml(qr.code_slug)}</div>
                  </div>
                  <div>
                    <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.45rem;">
                      ${this.escapeHtml(qr.name)} — Cambiar Destino en Vivo (Sin reimprimir)
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1.6fr 1fr auto; gap: 0.55rem; align-items: center; margin-bottom: 0.65rem;">
                      <select id="qr-dest-type-${qr.id}" class="form-control" onchange="window.consoleApp.onQrDestTypePresetChange('${qr.id}', this.value)" style="font-size: 0.78rem;">
                        <option value="google_form" ${qr.dest_type === 'google_form' ? 'selected' : ''}>Google Form</option>
                        <option value="product" ${qr.dest_type === 'product' ? 'selected' : ''}>Página Producto</option>
                        <option value="whatsapp" ${qr.dest_type === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
                        <option value="custom" ${qr.dest_type === 'custom' ? 'selected' : ''}>Otra URL</option>
                      </select>
                      <input type="text" id="qr-url-${qr.id}" class="form-control" value="${this.escapeHtml(qr.target_url)}" style="font-size: 0.78rem; font-family: monospace;">
                      <input type="text" id="qr-campaign-${qr.id}" class="form-control" value="${this.escapeHtml(qr.campaign)}" placeholder="Campaña" style="font-size: 0.78rem;">
                      <button type="button" class="btn-primary-large" onclick="window.consoleApp.updateQRDestination('${qr.id}')" style="font-size: 0.76rem;">Actualizar Destino</button>
                    </div>
                    ${history.length > 0 ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom:0.65rem;">Último ajuste: <code>${this.escapeHtml(history[0].at)}</code> — ${this.escapeHtml(history[0].note)}</div>` : ''}
                    <div style="display: flex; gap: 0.55rem; flex-wrap: wrap;">
                      <button type="button" class="btn-secondary" onclick="window.consoleApp.simulateAnonymousQRScan('${qr.id}')" style="font-size: 0.76rem;">Registrar Escaneo Anónimo (+1 Total)</button>
                      <button type="button" class="btn-secondary" onclick="window.consoleApp.toggleQRQuickForm('${qr.id}')" style="font-size: 0.76rem; border-color:var(--accent-1); color:var(--accent-1);">Registrar Escaneo + Formulario Identificado</button>
                    </div>
                    ${isQuickOpen ? `
                      <div style="margin-top: 0.75rem; background: #F8F9F6; border: 1px solid var(--accent-1); border-radius: 6px; padding: 0.8rem;">
                        <div style="font-size: 0.76rem; font-weight: 700; color: var(--accent-1); margin-bottom: 0.45rem;">Registro de Persona Identificada vía QR ${this.escapeHtml(qr.code_slug)}</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                          <input type="text" id="qr-qf-name-${qr.id}" class="form-control" placeholder="Nombre de quien se identifica *">
                          <input type="text" id="qr-qf-contact-${qr.id}" class="form-control" placeholder="Correo o WhatsApp">
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr auto; gap: 0.5rem;">
                          <input type="text" id="qr-qf-req-${qr.id}" class="form-control" placeholder="Requerimiento ingresado en formulario">
                          <button type="button" class="btn-primary-large" onclick="window.consoleApp.submitQRIdentifiedForm('${qr.id}')" style="font-size: 0.76rem;">Registrar en Tabla</button>
                        </div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Crear Nuevo Código QR Dinámico</strong>
            </div>
            <div style="padding: 1.15rem;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; align-items: end;">
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Nombre del QR *</label>
                  <input type="text" id="new-qr-name" class="form-control" placeholder="Ej: QR Tarjeta Caja VIP">
                </div>
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Ubicación Física</label>
                  <select id="new-qr-placement" class="form-control">
                    <option value="Empaque de Producto">Empaque de Producto</option>
                    <option value="Tarjeta de Agradecimiento">Tarjeta de Agradecimiento</option>
                    <option value="Volante Promocional">Volante Promocional</option>
                    <option value="Mostrador / Punto Físico">Mostrador / Punto Físico</option>
                  </select>
                </div>
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Campaña *</label>
                  <input type="text" id="new-qr-campaign" class="form-control" placeholder="Ej: Recompra Navideña">
                </div>
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Destino Inicial</label>
                  <select id="new-qr-dest-type" class="form-control">
                    <option value="google_form">Google Form de Captación</option>
                    <option value="product">Página de Producto</option>
                    <option value="whatsapp">WhatsApp Directo</option>
                    <option value="custom">Otra URL</option>
                  </select>
                </div>
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">URL de Destino</label>
                  <input type="url" id="new-qr-url" class="form-control" value="${this.escapeHtml(cfgUrl)}">
                </div>
                <button type="button" class="btn-primary-large" onclick="window.consoleApp.createDynamicQR()" style="justify-content: center;">+ Generar QR Dinámico</button>
              </div>
            </div>
          </div>
        `}

        ${this.renderErpAuditFooter({
          entity: storeName,
          moduleLabel: mod.fullName,
          count: this.qrCodes.length,
          exportKey: 'qrs'
        })}
      `;
    }

    // 05. Atención & WhatsApp — MOD-05.3: Entrenador Orbe IA
    if (mod.id === 'chat-widget') {
      const storeName = this.getActiveStoreName ? this.getActiveStoreName() : 'EasyGrow';
      return `
        ${this.renderErpHeader({
          code: 'MOD-05.3',
          title: mod.fullName,
          subtitle: 'Verifica con ejemplos reales cómo la inteligencia artificial entiende y responde a tus clientes.',
          helpText: 'Orbe IA analiza el mensaje para detectar si el cliente quiere comprar, consultar disponibilidad o reportar una entrega, proponiendo una respuesta que tu equipo revisa antes de enviar.'
        })}

        ${this.renderHowItWorks([
          { title: '1. Escribe o elige una pregunta', desc: 'Usa cualquiera de los ejemplos frecuentes o escribe una duda real de un cliente.' },
          { title: '2. Pulsa Probar Respuesta', desc: 'Orbe IA identificará automáticamente el motivo del mensaje en segundos.' },
          { title: '3. Revisa la sugerencia', desc: 'Comprueba el borrador propuesto antes de usarlo en tu Bandeja de Mensajes.' }
        ])}

        <div class="erp-table-wrapper" style="max-width: 780px;">
          <div class="erp-table-toolbar">
            <strong>Probar Respuestas de Orbe IA</strong>
            <span class="erp-status-pill ok">Asistente Listo</span>
          </div>
          <div style="padding: 1.15rem;">
            <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem;">
              <input type="text" id="intent-sample-input" class="form-control" placeholder="Escribe aquí lo que preguntaría un cliente (ej: ¿cuánto vale el envío?)..." style="flex: 1;">
              <button type="button" class="btn-primary-large" onclick="window.consoleApp.testIntentClassification()">
                Probar Respuesta IA
              </button>
            </div>

            <div style="margin-bottom: 1rem;">
              <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.4rem;">Ejemplos frecuentes de clientes</div>
              <div class="erp-chip-group">
                <button type="button" class="erp-chip" onclick="window.consoleApp.testIntentSample('¡Hola! Me interesa comprar 2 unidades, ¿dónde hago el pago contraentrega?')">Cliente quiere comprar (Contraentrega)</button>
                <button type="button" class="erp-chip" onclick="window.consoleApp.testIntentSample('Mi pedido lleva 4 días y no llega, pésimo servicio')">Cliente pide soporte (Entrega)</button>
                <button type="button" class="erp-chip" onclick="window.consoleApp.testIntentSample('¿Tienen disponibilidad en Bogotá y cuánto tarda el envío?')">Consulta de inventario y tiempos</button>
              </div>
            </div>

            <div id="intent-result-display" style="display: none; background: #F8F9F6; border: 1px solid var(--accent-1); border-radius: 6px; padding: 1rem;"></div>
          </div>
        </div>
        ${this.renderErpAuditFooter({ entity: storeName, moduleLabel: mod.fullName, count: 3, statusLabel: 'Operativo' })}
      `;
    }

    // 9. Bandeja Unificada de 3 Paneles (WhatsApp, Instagram, Facebook) + Orbe IA (Aprobación Humana) + Calendario Lateral
    if (mod.id === 'unified-inbox') {
      const contacts = Array.isArray(this.inboxContacts) ? this.inboxContacts : [];
      const msgsMap = this.inboxMessagesByContact || {};
      const integ = this.waIntegration || { status: 'no_conectado' };
      const appts = Array.isArray(this.calendarAppointments) ? this.calendarAppointments : [];

      const filteredContacts = contacts.filter(c => {
        if (this.inboxChannelFilter === 'all') return true;
        const cMsgs = msgsMap[c.id] || [];
        if (cMsgs.some(m => m.channel === this.inboxChannelFilter)) return true;
        const tagsStr = (c.tags || []).join(' ').toLowerCase();
        return tagsStr.includes(this.inboxChannelFilter);
      });

      const activeContact = filteredContacts.find(c => c.id === this.selectedInboxContactId)
        || (filteredContacts.length > 0 ? filteredContacts[0] : null);
      const threadMessages = activeContact ? (msgsMap[activeContact.id] || []) : [];

      const waBadgeMap = {
        no_conectado: { lbl: 'WA: No conectado', color: '#111111' },
        conectando: { lbl: 'WA: Conectando...', color: '#E2B857' },
        conectado: { lbl: `WA: Conectado (${integ.display_phone_number || 'Activo'})`, color: '#1FA866' },
        requiere_atencion: { lbl: 'WA: Requiere atención', color: '#D14343' },
        desconectado: { lbl: 'WA: Desconectado', color: '#6E747B' }
      };
      const waBadge = waBadgeMap[integ.status] || waBadgeMap.no_conectado;

      const storeName = this.getActiveStoreName ? this.getActiveStoreName() : 'EasyGrow';
      return `
        ${this.renderErpHeader({
          code: 'MOD-05.1',
          title: mod.fullName,
          subtitle: 'Atiende mensajes de WhatsApp, Instagram y Facebook en un solo lugar con ayuda de inteligencia artificial.',
          helpText: 'A la izquierda seleccionas la conversación, al centro lees el chat y apruebas o editas la respuesta sugerida por Orbe IA, y a la derecha ves la ficha del cliente.',
          actionsHtml: `
            <button type="button" class="btn-secondary" onclick="window.consoleApp.openModuleFull('whatsapp-integrations', true)" style="border-color: ${waBadge.color}; color: ${waBadge.color}; font-weight: 700;">
              ${waBadge.lbl}
            </button>
            <button type="button" class="btn-secondary" onclick="window.consoleApp.toggleInboxIncomingModal()">
              + Registrar Mensaje Recibido
            </button>
            <button type="button" class="btn-secondary" onclick="window.consoleApp.openModuleFull('operational-calendar', true)">
              📅 Ir al Calendario Completo (01)
            </button>
            <button type="button" class="btn-primary-large" style="font-size:0.84rem;" onclick="window.consoleApp.toggleInboxCalendarDrawer()">
              ${this.showInboxCalendarDrawer ? 'Ocultar Agenda Rápida' : `Agenda Rápida (${appts.length})`}
            </button>
          `
        })}

        ${this.renderHowItWorks([
          { title: '1. Elige un cliente', desc: 'Haz clic en cualquier conversación de la izquierda o filtra por WhatsApp, Instagram o Facebook.' },
          { title: '2. Responde o aprueba la IA', desc: 'Revisa la respuesta sugerida en el chat central y pulsa Aprobar antes de enviarla.' },
          { title: '3. Agenda o mira su ficha', desc: 'Consulta sus compras a la derecha o agéndale una cita sincronizada con el Calendario.' }
        ])}

        ${this.showInboxIncomingModal ? `
          <div class="demo-card" style="margin-bottom: 1.25rem; border: 1.5px solid #111111;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <strong style="color: var(--text-main);">Registrar Mensaje Entrante Omnicanal (WhatsApp / Instagram / Facebook)</strong>
              <button type="button" onclick="window.consoleApp.toggleInboxIncomingModal()" style="background: transparent; border: none; cursor: pointer; font-weight: 700;">✕</button>
            </div>
            <div style="display: grid; grid-template-columns: 0.9fr 1fr 1fr 1.8fr auto; gap: 0.55rem; align-items: center;">
              <select id="inb-test-channel" class="form-control" style="background: #FFFFFF;">
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
              <input type="text" id="inb-test-name" class="form-control" placeholder="Nombre cliente *" style="background: #FFFFFF;">
              <input type="text" id="inb-test-phone" class="form-control" placeholder="+57 300..." style="background: #FFFFFF;">
              <input type="text" id="inb-test-body" class="form-control" placeholder="Mensaje entrante (ej: Quiero comprar 2 unidades contraentrega)" style="background: #FFFFFF;">
              <button type="button" class="btn-primary-large" onclick="window.consoleApp.submitTestIncomingInboxMessage()">
                Clasificar con Orbe IA
              </button>
            </div>
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: ${this.showInboxCalendarDrawer ? '1fr 330px' : '1fr'}; gap: 1.25rem; align-items: start;">
          <div>
            ${filteredContacts.length === 0 ? `
              <div style="background: #FFFFFF; border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); padding: 3.5rem 2rem; text-align: center; color: var(--text-muted);">
                <h3 style="color: var(--text-main); margin-bottom: 0.5rem;">Bandeja WA, IG & Facebook Lista</h3>
                <p style="max-width: 520px; margin: 0 auto 1.25rem auto; font-size: 0.88rem;">Aún no hay conversaciones en este canal. Los mensajes reales recibidos por webhooks oficiales de WhatsApp o registrados desde Instagram/Facebook aparecerán aquí con clasificación de Orbe IA pendiente de aprobación humana.</p>
                <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
                  <button class="btn-secondary" onclick="window.consoleApp.toggleInboxIncomingModal()">📥 Probar Mensaje Entrante</button>
                  <button class="btn-primary-large" onclick="window.consoleApp.openModuleFull('whatsapp-integrations', true)">Configurar WhatsApp Business</button>
                </div>
              </div>
            ` : `
              <div class="inbox-3col-layout">
                <!-- Columna 1: Conversaciones (Izquierda) -->
                <div class="inbox-col-left">
                  <div class="inbox-channels-bar">
                    <button class="inbox-chan-pill ${this.inboxChannelFilter === 'all' ? 'active' : ''}" onclick="window.consoleApp.setInboxFilter('all')">Todos</button>
                    <button class="inbox-chan-pill ${this.inboxChannelFilter === 'whatsapp' ? 'active' : ''}" onclick="window.consoleApp.setInboxFilter('whatsapp')">WhatsApp</button>
                    <button class="inbox-chan-pill ${this.inboxChannelFilter === 'instagram' ? 'active' : ''}" onclick="window.consoleApp.setInboxFilter('instagram')">Instagram</button>
                    <button class="inbox-chan-pill ${this.inboxChannelFilter === 'facebook' ? 'active' : ''}" onclick="window.consoleApp.setInboxFilter('facebook')">Facebook</button>
                  </div>

                  <div class="inbox-conversations-list">
                    ${filteredContacts.map(c => {
                      const isSel = activeContact && activeContact.id === c.id;
                      const cMsgs = msgsMap[c.id] || [];
                      const lastMsg = cMsgs.length > 0 ? cMsgs[cMsgs.length - 1] : null;
                      const hasPendingAi = cMsgs.some(m => m.ai_approval_status === 'pending_human_approval');
                      const snippet = lastMsg ? lastMsg.body : (c.lastMessage || 'Conversación iniciada');
                      const chan = lastMsg ? lastMsg.channel : (c.lastChannel || 'whatsapp');
                      const intentMeta = window.EasyGrowCRM.analyzeIntent(snippet);
                      return `
                        <div class="inbox-conv-item ${isSel ? 'active' : ''}" onclick="window.consoleApp.selectInboxContact('${c.id}')">
                          <div class="conv-item-top">
                            <span class="conv-contact-name">${this.escapeHtml(c.contactPerson || c.contact_person || c.name || 'Cliente')}</span>
                            <span class="conv-channel-tag ${chan}">${this.escapeHtml(chan.toUpperCase())}</span>
                          </div>
                          <div class="conv-snippet">${this.escapeHtml(snippet)}</div>
                          <div style="margin-top: 0.4rem; display: flex; justify-content: space-between; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                            <span class="conv-intent-badge" style="color: ${intentMeta.color}; border: 1px solid ${intentMeta.color};">
                              ${this.escapeHtml(lastMsg && lastMsg.intent_label ? lastMsg.intent_label : intentMeta.classification)}
                            </span>
                            ${hasPendingAi ? `<span style="font-size: 0.66rem; font-weight: 800; color: var(--accent-1);">⏳ Aprobar IA</span>` : ''}
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>

                <!-- Columna 2: Chat y Aprobación Humana de Orbe IA (Centro) -->
                <div class="inbox-col-center">
                  ${activeContact ? `
                    <div class="chat-thread-header">
                      <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: #111111; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800;">
                          ${this.escapeHtml((activeContact.contactPerson || activeContact.contact_person || activeContact.name || 'C').charAt(0))}
                        </div>
                        <div>
                          <div style="font-weight: 700; color: var(--text-main);">${this.escapeHtml(activeContact.contactPerson || activeContact.contact_person || activeContact.name || 'Cliente')}</div>
                          <div style="font-size: 0.75rem; color: var(--text-muted);">${this.escapeHtml(activeContact.phone || 'Sin teléfono')} • ${this.escapeHtml(activeContact.company || activeContact.name || 'Directo')}</div>
                        </div>
                      </div>
                      <select id="inbox-send-channel" class="form-control" style="width: auto; font-size: 0.76rem; padding: 0.3rem 0.5rem; background: #FFFFFF;">
                        <option value="whatsapp">Enviar por WhatsApp</option>
                        <option value="instagram">Enviar por Instagram</option>
                        <option value="facebook">Enviar por Facebook</option>
                      </select>
                    </div>

                    <div class="chat-messages-container" id="chat-messages-stream">
                      ${threadMessages.length === 0 ? `
                        <div style="text-align: center; color: var(--text-muted); font-size: 0.84rem; padding: 2rem 1rem;">
                          No hay mensajes registrados aún para este contacto. Envía un mensaje o recibe eventos vía webhook.
                        </div>
                      ` : threadMessages.map(m => {
                        if (m.direction === 'system_call') {
                          return `
                            <div style="margin: 0.45rem auto; padding: 0.55rem 0.9rem; background: #F8F8F6; border: 1px solid #111111; border-radius: 8px; font-size: 0.78rem; color: #111111; max-width: 90%; text-align: center;">
                              ${this.escapeHtml(m.body)}
                            </div>
                          `;
                        }
                        const isIncoming = m.direction === 'incoming';
                        const isPendingApproval = isIncoming && m.ai_approval_status === 'pending_human_approval' && m.ai_suggested_reply;
                        return `
                          <div class="chat-bubble ${isIncoming ? 'incoming' : 'outgoing'}">
                            <div class="bubble-sender">${this.escapeHtml(m.sender_name)} • <span style="text-transform: uppercase;">${this.escapeHtml(m.channel)}</span></div>
                            <div class="bubble-text">${this.escapeHtml(m.body)}</div>
                            <div class="bubble-time">${this.escapeHtml((m.created_at || '').slice(11, 16))} • Estado: ${this.escapeHtml(m.delivery_status)}</div>
                          </div>
                          ${isPendingApproval ? `
                            <div style="background: #FFFFFF; border: 1.5px solid var(--accent-1); border-radius: 10px; padding: 0.85rem; margin: 0.35rem 0 0.75rem 0;">
                              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.35rem;">
                                <strong style="font-size: 0.76rem; color: var(--accent-1);">🤖 Orbe IA — Sugerencia Pendiente de Aprobación Humana</strong>
                                <span class="mod-tag" style="font-size: 0.68rem; padding: 1px 7px;">Intención: ${this.escapeHtml(m.intent_label)} (${Math.round((Number(m.intent_score) || 0.8) * 100)}%)</span>
                              </div>
                              <textarea id="ai-draft-${m.id}" rows="2" class="form-control" style="background: #F8F8F6; font-size: 0.8rem; margin-bottom: 0.5rem;">${this.escapeHtml(m.ai_suggested_reply)}</textarea>
                              <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
                                <button type="button" class="btn-primary-large" onclick="window.consoleApp.approveAndSendAISuggestion('${m.id}')" style="font-size: 0.74rem; padding: 0.35rem 0.75rem;">
                                  ✓ Aprobar y Enviar Respuesta
                                </button>
                                <button type="button" class="btn-secondary" onclick="window.consoleApp.copyAISuggestionToComposer('${m.id}')" style="font-size: 0.72rem; padding: 0.32rem 0.65rem;">
                                  ✏️ Editar en Caja
                                </button>
                                <button type="button" class="btn-secondary" onclick="window.consoleApp.discardAISuggestion('${m.id}')" style="font-size: 0.72rem; padding: 0.32rem 0.65rem; color: var(--data-crimson);">
                                  ✕ Descartar
                                </button>
                              </div>
                            </div>
                          ` : ''}
                        `;
                      }).join('')}
                    </div>

                    <div class="chat-reply-bar">
                      <input type="text" id="chat-reply-input" placeholder="Escribe un mensaje o aprueba arriba la respuesta de Orbe IA..." style="flex: 1; padding: 0.75rem 1rem; background: #FFFFFF; border: 1px solid var(--border-subtle); border-radius: 6px; color: var(--text-main);">
                      <button class="btn-primary-large" onclick="window.consoleApp.sendInboxReply('${activeContact.id}')" style="padding: 0.75rem 1.25rem;">
                        Enviar
                      </button>
                    </div>
                  ` : `
                    <div style="display: grid; place-items: center; height: 100%; color: var(--text-dim);">
                      Selecciona una conversación a la izquierda.
                    </div>
                  `}
                </div>

                <!-- Columna 3: Ficha del Cliente (Derecha) -->
                <div class="inbox-col-right">
                  ${activeContact ? `
                    <div class="contact-360-card">
                      <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--accent-1); font-weight: 700;">Ficha del Cliente 360°</div>
                      <h4 style="color: var(--text-main); font-size: 1.15rem; margin-top: 0.25rem;">${this.escapeHtml(activeContact.name || activeContact.company || 'Cliente')}</h4>
                      <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">Etapa Pipeline: <b>${this.escapeHtml(activeContact.stage || 'prospects')}</b></div>

                      <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.82rem; margin-bottom: 1.25rem;">
                        <div><span style="color: var(--text-muted);">Contacto:</span> <b>${this.escapeHtml(activeContact.contactPerson || activeContact.contact_person || activeContact.name || 'No registrado')}</b></div>
                        <div><span style="color: var(--text-muted);">Teléfono:</span> <b>${this.escapeHtml(activeContact.phone || 'Sin teléfono')}</b></div>
                        <div><span style="color: var(--text-muted);">Valor Oportunidad:</span> <b style="color: var(--accent-1);">$${(activeContact.value || 0).toLocaleString()} COP</b></div>
                      </div>

                      <div style="margin-bottom: 1rem;">
                        <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.35rem;">Etiquetas Activas:</span>
                        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                          ${(activeContact.tags || []).map(t => `
                            <span class="mod-tag" style="background: rgba(31, 168, 102, 0.08); border-color: rgba(31, 168, 102, 0.3); color: var(--accent-1);">${this.escapeHtml(t)}</span>
                          `).join('')}
                        </div>
                      </div>

                      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <button class="btn-primary-large" onclick="window.consoleApp.createDropiOrderForContact('${activeContact.id}')" style="width: 100%; font-size: 0.82rem; padding: 0.55rem; justify-content: center;">
                          ${window.EasyGrowIcons.get('shopping-bag', 14)} Generar Pedido en Dropi
                        </button>
                        <button class="btn-secondary" onclick="window.consoleApp.openCalendarWithContact('${this.escapeHtml(activeContact.name || activeContact.contactPerson || 'Cliente')}')" style="width: 100%; font-size: 0.8rem;">
                          📅 Agendar en Calendario
                        </button>
                      </div>
                    </div>
                  ` : `
                    <div style="color: var(--text-dim); text-align: center; padding: 2rem;">Sin contacto seleccionado.</div>
                  `}
                </div>
              </div>
            `}
          </div>

          <!-- Opción Lateral Independiente: Calendario -->
          ${this.showInboxCalendarDrawer ? `
            <div class="demo-card" style="margin: 0; border: 1.5px solid #111111;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <strong style="color: var(--text-main); font-size: 0.95rem;">📅 Calendario Lateral</strong>
                <button type="button" onclick="window.consoleApp.toggleInboxCalendarDrawer()" style="background: transparent; border: none; cursor: pointer; font-weight: 700;">✕</button>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                <input type="text" id="cal-title" class="form-control" placeholder="Motivo (ej: Llamada confirmación)" style="background: #FFFFFF; font-size: 0.78rem;">
                <input type="text" id="cal-contact-name" class="form-control" value="${this.escapeHtml(activeContact ? (activeContact.name || '') : '')}" placeholder="Cliente" style="background: #FFFFFF; font-size: 0.78rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem;">
                  <input type="date" id="cal-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}" style="background: #FFFFFF; font-size: 0.76rem;">
                  <input type="time" id="cal-time" class="form-control" value="10:30" style="background: #FFFFFF; font-size: 0.76rem;">
                </div>
                <select id="cal-channel" class="form-control" style="background: #FFFFFF; font-size: 0.78rem;">
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Llamada">Llamada</option>
                </select>
                <button type="button" class="btn-primary-large" onclick="window.consoleApp.createCalendarAppointment('${activeContact ? activeContact.id : ''}')" style="width: 100%; justify-content: center; font-size: 0.78rem;">
                  + Agendar Seguimiento
                </button>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 360px; overflow-y: auto;">
                ${appts.length === 0 ? `
                  <div style="padding: 1rem; text-align: center; font-size: 0.78rem; color: var(--text-muted); border: 1px dashed var(--border-subtle); border-radius: 6px; background: #F8F8F6;">
                    Sin citas agendadas todavía.
                  </div>
                ` : appts.map(a => `
                  <div style="background: #F8F8F6; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.65rem;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                      <strong style="font-size: 0.8rem; color: var(--text-main);">${this.escapeHtml(a.title)}</strong>
                      <button type="button" onclick="window.consoleApp.deleteCalendarAppointment('${a.id}')" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 0.72rem;">✕</button>
                    </div>
                    <div style="font-size: 0.74rem; color: var(--text-muted);">${this.escapeHtml(a.contact_name)} • ${this.escapeHtml(a.channel)}</div>
                    <div style="font-size: 0.72rem; font-family: monospace; color: var(--accent-1); font-weight: 700; margin-top: 0.2rem;">${this.escapeHtml(a.scheduled_date)} ${this.escapeHtml(a.scheduled_time)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        ${this.renderErpAuditFooter({ entity: storeName, moduleLabel: mod.fullName, count: filteredContacts.length, statusLabel: 'Atención Activa' })}
      `;
    }

    // 05. Atención & WhatsApp — MOD-05.2: Conexión de WhatsApp & Respuesta a Llamadas Perdidas (Unificado y Guiado)
    if (mod.id === 'whatsapp-integrations') {
      const integ = this.waIntegration || {
        status: 'no_conectado',
        status_reason: 'Pendiente de vincular el número de WhatsApp de tu empresa.',
        business_name: '',
        display_phone_number: '',
        waba_id: '',
        phone_number_id: '',
        calling_eligible: false,
        calling_ineligible_reason: 'Las llamadas por WhatsApp aún no están habilitadas en la cuenta de Facebook/Meta de esta empresa.',
        missed_call_enabled: false,
        missed_call_reply_mode: 'auto_window_or_template',
        missed_call_message_text: '¡Hola! Vimos tu llamada perdida por WhatsApp. En este momento nuestros asesores están atendiendo otro cliente; cuéntanos cómo podemos ayudarte por aquí.',
        missed_call_template_name: 'easygrow_missed_call_followup',
        missed_call_template_lang: 'es',
        hasEncryptedCredentials: false
      };
      const env = this.waEnvironment || { ready: false, checks: [], missingConfig: [], publicClientConfig: {} };
      const logs = Array.isArray(this.waWebhookLogs) ? this.waWebhookLogs : [];
      const calls = Array.isArray(this.waCalls) ? this.waCalls : [];
      const activeTab = this.getModuleSubTab('whatsapp-integrations', 'conexion');
      const storeName = this.getActiveStoreName ? this.getActiveStoreName() : 'EasyGrow';

      const statusMeta = {
        no_conectado: { text: 'Sin conectar aún', pill: '' },
        conectando: { text: 'Conectando...', pill: 'warn' },
        conectado: { text: 'Conectado ✓', pill: 'ok' },
        requiere_atencion: { text: 'Requiere reconexión', pill: 'err' },
        desconectado: { text: 'Desconectado', pill: 'warn' }
      }[integ.status] || { text: integ.status, pill: '' };

      return `
        ${this.renderErpHeader({
          code: 'MOD-05.2',
          title: mod.fullName,
          subtitle: 'Conecta el WhatsApp de tu empresa paso a paso y configura el mensaje automático ante llamadas perdidas.',
          helpText: 'Asistente guiado para que cualquier miembro del equipo conecte su número oficial con Facebook/Meta y active respuestas automáticas por chat ante llamadas perdidas sin conocimientos técnicos.',
          actionsHtml: `
            <span class="erp-status-pill ${statusMeta.pill}" style="font-size:0.78rem; padding:0.35rem 0.75rem;">WhatsApp: ${statusMeta.text}</span>
            <button type="button" class="btn-secondary" onclick="window.consoleApp.openModuleFull('unified-inbox', true)">Ir a Bandeja de Mensajes</button>
          `
        })}

        ${this.renderErpSubTabs('whatsapp-integrations', activeTab, [
          { key: 'conexion', label: '1. Conectar mi WhatsApp (Paso a Paso)' },
          { key: 'llamadas', label: '2. Llamadas Perdidas Automáticas', count: calls.length },
          { key: 'webhooks', label: '3. Historial de Actividad', count: logs.length }
        ])}

        ${activeTab === 'conexion' ? `
          ${this.renderHowItWorks([
            {
              title: 'Paso 1: Sistema listo',
              desc: env.ready
                ? 'La plataforma ya tiene activada la conexión segura con WhatsApp.'
                : 'Faltan credenciales del servidor (el área técnica/TI puede revisar los detalles abajo).',
              done: Boolean(env.ready)
            },
            {
              title: 'Paso 2: Vincula tu número',
              desc: 'Haz clic en "Conectar mi WhatsApp" e inicia sesión con la cuenta de Facebook de tu negocio.',
              done: integ.status === 'conectado'
            },
            {
              title: 'Paso 3: Empieza a atender',
              desc: 'Tus mensajes llegarán a la Bandeja (05.1) y podrás activar respuestas para llamadas perdidas.',
              done: integ.status === 'conectado'
            }
          ])}

          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Estado Actual de tu WhatsApp Empresarial</strong>
              <span class="erp-status-pill ${statusMeta.pill}">${statusMeta.text}</span>
            </div>
            <div style="padding: 1.25rem;">
              ${integ.status === 'conectado' ? `
                <div style="background: #F8F9F6; border: 1.5px solid var(--accent-1); border-radius: 6px; padding: 1rem; margin-bottom: 1rem;">
                  <div style="font-size: 0.74rem; text-transform: uppercase; color: var(--accent-1); font-weight: 800;">Número Conectado y Listo</div>
                  <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin-top: 0.25rem;">${this.escapeHtml(integ.business_name || storeName)}</div>
                  <div style="font-size: 0.92rem; font-family: monospace; color: var(--text-main); margin-top: 0.2rem;">Teléfono activo: ${this.escapeHtml(integ.display_phone_number || '—')}</div>
                </div>
                <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                  <button type="button" class="btn-primary-large" onclick="window.consoleApp.testWhatsAppConnection()">Comprobar que funciona</button>
                  <button type="button" class="btn-secondary" onclick="window.consoleApp.setModuleSubTab('whatsapp-integrations', 'llamadas')">Configurar Llamadas Perdidas</button>
                  <button type="button" class="btn-secondary" onclick="window.consoleApp.connectWhatsAppEmbeddedSignup()">Cambiar Número / Reconectar</button>
                  <button type="button" class="btn-secondary" onclick="window.consoleApp.disconnectWhatsApp()" style="color: var(--data-crimson); border-color: var(--data-crimson);">Desconectar</button>
                </div>
              ` : `
                <div style="background: #F8F9F6; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 1rem; margin-bottom: 1rem;">
                  <strong style="font-size: 0.92rem; color: var(--text-main); display:block; margin-bottom:0.35rem;">
                    ${integ.status === 'requiere_atencion' ? 'Tu número necesita volver a autorizarse en Facebook / Meta.' : 'Aún no has vinculado un número de WhatsApp para esta tienda.'}
                  </strong>
                  <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0;">
                    ${env.ready
                      ? 'Todo está listo. Pulsa el botón verde de abajo y sigue las instrucciones de la ventana de Facebook para autorizar tu WhatsApp.'
                      : 'Nota para el equipo: Antes de presionar el botón, pide a Soporte Técnico / TI completar los ajustes del servidor indicados en el menú desplegable inferior.'}
                  </p>
                </div>
                <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
                  <button type="button" class="btn-primary-large" onclick="window.consoleApp.connectWhatsAppEmbeddedSignup()">
                    ${integ.status === 'requiere_atencion' || integ.status === 'desconectado' ? 'Volver a Conectar mi WhatsApp' : 'Conectar mi WhatsApp'}
                  </button>
                  <button type="button" class="btn-secondary" onclick="window.consoleApp.testWhatsAppConnection()">Comprobar Conexión</button>
                </div>
              `}

              <!-- Detalles Técnicos Ocultos por Defecto para No Confundir al Usuario Final -->
              <details class="erp-tech-details">
                <summary>
                  <span>🔧 Ver detalles técnicos y variables del servidor (Solo para Soporte Técnico / TI)</span>
                  <span class="erp-status-pill ${env.ready ? 'ok' : 'warn'}">${env.ready ? 'TI Listo' : `${(env.missingConfig || []).length} pendientes TI`}</span>
                </summary>
                <div style="padding: 1rem;">
                  <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.75rem;">
                    <b>Webhook URL oficial:</b> <code>${this.escapeHtml((env.publicClientConfig && env.publicClientConfig.webhookPublicUrl) || (window.location.origin + '/api/webhooks/whatsapp'))}</code>
                    ${integ.waba_id ? ` • <b>WABA ID:</b> <code>${this.escapeHtml(integ.waba_id)}</code> • <b>Phone ID:</b> <code>${this.escapeHtml(integ.phone_number_id)}</code>` : ''}
                  </div>
                  <div class="erp-table-scroll">
                    <table class="erp-table">
                      <thead>
                        <tr>
                          <th>Variable Técnica (TI)</th>
                          <th>Propósito</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${(env.checks || []).map(chk => `
                          <tr>
                            <td><code>${this.escapeHtml(chk.key)}</code></td>
                            <td>${this.escapeHtml(chk.description)}</td>
                            <td><span class="erp-status-pill ${chk.configured ? 'ok' : 'err'}">${chk.configured ? 'Lista ✓' : 'Pendiente'}</span></td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            </div>
          </div>
        ` : ''}

        ${activeTab === 'llamadas' ? `
          ${this.renderHowItWorks([
            { title: '1. ¿Qué hace esta función?', desc: 'Cuando un cliente llama por WhatsApp y tu equipo no alcanza a contestar, envía 1 mensaje automático por chat.' },
            { title: '2. Escribe tu mensaje cordial', desc: 'Activa la casilla, personaliza el saludo y mira en vivo a la derecha cómo le llegará al cliente.' },
            { title: '3. Revisa quién te llamó', desc: 'En la tabla inferior quedan registrados los clientes que llamaron para devolverles el contacto.' }
          ])}

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.15rem; margin-bottom: 1.15rem;">
            <div class="erp-table-wrapper">
              <div class="erp-table-toolbar">
                <strong>Configurar Mensaje por Llamada Perdida</strong>
                <span class="erp-status-pill ${integ.status === 'conectado' && integ.calling_eligible ? 'ok' : 'warn'}">
                  ${integ.calling_eligible ? 'Llamadas Activas' : 'Requiere activar llamadas'}
                </span>
              </div>
              <div style="padding: 1.1rem;">
                ${integ.status !== 'conectado' || !integ.calling_eligible ? `
                  <div style="background: #F8F9F6; border: 1px solid var(--border-subtle); border-left: 4px solid var(--data-amber); border-radius: 6px; padding: 0.75rem; margin-bottom: 0.9rem; font-size: 0.8rem;">
                    <strong>Nota importante:</strong> ${this.escapeHtml(integ.status !== 'conectado' ? 'Primero conecta tu número en la pestaña "1. Conectar mi WhatsApp". Tu mensajería normal sigue funcionando sin problema.' : integ.calling_ineligible_reason)}
                  </div>
                ` : ''}

                <label style="display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem; background: #F8F9F6; border: 1px solid var(--border-subtle); border-radius: 6px; margin-bottom: 0.85rem; cursor: ${integ.status === 'conectado' && integ.calling_eligible ? 'pointer' : 'not-allowed'}; opacity: ${integ.status === 'conectado' && integ.calling_eligible ? '1' : '0.65'};">
                  <input type="checkbox" id="ct-missed-enabled" ${integ.missed_call_enabled ? 'checked' : ''} ${integ.status === 'conectado' && integ.calling_eligible ? '' : 'disabled'}>
                  <span style="font-size: 0.84rem; font-weight: 700; color: var(--text-main);">Enviar mensaje automático por WhatsApp cuando no contesten</span>
                </label>

                <div style="margin-bottom: 0.85rem;">
                  <label style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Mensaje que recibirá tu cliente:</label>
                  <textarea id="ct-missed-msg" rows="3" class="form-control" oninput="window.consoleApp.updateMissedCallPreview(this.value)">${this.escapeHtml(integ.missed_call_message_text || '¡Hola! Vimos tu llamada perdida por WhatsApp. En este momento nuestros asesores están atendiendo otro cliente; cuéntanos cómo podemos ayudarte por aquí.')}</textarea>
                </div>

                <details class="erp-tech-details" style="margin-bottom: 0.9rem;">
                  <summary><span>Opciones avanzadas de envío (Solo si lo pide Meta)</span></summary>
                  <div style="padding: 0.85rem; display: flex; flex-direction: column; gap: 0.65rem;">
                    <div>
                      <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Regla de envío Meta</label>
                      <select id="ct-reply-mode" class="form-control">
                        <option value="auto_window_or_template" ${integ.missed_call_reply_mode === 'auto_window_or_template' ? 'selected' : ''}>Automático (Recomendado)</option>
                        <option value="template" ${integ.missed_call_reply_mode === 'template' ? 'selected' : ''}>Usar siempre plantilla aprobada</option>
                        <option value="session_text" ${integ.missed_call_reply_mode === 'session_text' ? 'selected' : ''}>Solo ventana de chat abierta (24h)</option>
                      </select>
                    </div>
                    <div style="display: grid; grid-template-columns: 1.5fr 0.7fr; gap: 0.55rem;">
                      <input type="text" id="ct-template-name" class="form-control" value="${this.escapeHtml(integ.missed_call_template_name || 'easygrow_missed_call_followup')}" placeholder="Nombre plantilla">
                      <input type="text" id="ct-template-lang" class="form-control" value="${this.escapeHtml(integ.missed_call_template_lang || 'es')}" placeholder="Idioma">
                    </div>
                  </div>
                </details>

                <button type="button" class="btn-primary-large" onclick="window.consoleApp.saveMissedCallSettings('ct-')" style="width: 100%; justify-content: center;">
                  Guardar Mensaje de Llamadas
                </button>
              </div>
            </div>

            <div class="erp-table-wrapper">
              <div class="erp-table-toolbar">
                <strong>Así lo verá tu cliente en su celular</strong>
                <span style="font-size:0.74rem; color:var(--accent-1); font-weight:700;">1 solo mensaje por llamada</span>
              </div>
              <div style="padding: 1.15rem; background: #F4F5F2; min-height: 220px; display: flex; flex-direction: column; justify-content: center;">
                <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.75rem; background: #FFFFFF; display: inline-block; padding: 3px 10px; border-radius: 99px; border: 1px solid var(--border-subtle); align-self:center;">
                  📞 Llamada perdida registrada automáticamente
                </div>
                <div style="background: #111111; color: #FFFFFF; padding: 0.9rem 1rem; border-radius: 10px 10px 2px 10px; max-width: 90%; margin-left: auto; font-size: 0.84rem; line-height: 1.45;">
                  <div id="ct-missed-preview-bubble">${this.escapeHtml(integ.missed_call_message_text || '¡Hola! Vimos tu llamada perdida por WhatsApp. Cuéntanos cómo podemos ayudarte por aquí.')}</div>
                  <div style="font-size: 0.68rem; color: #34C77B; text-align: right; margin-top: 0.4rem;">Enviado 1 vez sin duplicados ✓✓</div>
                </div>
              </div>
            </div>
          </div>

          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Registro de Llamadas Recibidas (${calls.length})</strong>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Fecha / Hora</th>
                    <th>Cliente / Teléfono</th>
                    <th>Estado</th>
                    <th>Mensaje Enviado</th>
                  </tr>
                </thead>
                <tbody>
                  ${calls.length === 0 ? `
                    <tr><td colspan="4" style="padding:1.25rem; text-align:center; color:var(--text-muted);">Aún no hay llamadas perdidas registradas. Cuando entren llamadas por WhatsApp Business aparecerán aquí.</td></tr>
                  ` : calls.map(c => `
                    <tr>
                      <td class="num-col">${this.escapeHtml((c.created_at || '').replace('T', ' ').slice(0, 19))}</td>
                      <td><strong>${this.escapeHtml(c.customer_name)}</strong> (${this.escapeHtml(c.from_phone)})</td>
                      <td><span class="erp-status-pill ${c.auto_reply_sent ? 'ok' : 'warn'}">${this.escapeHtml(c.auto_reply_status || c.call_status)}</span></td>
                      <td>${this.escapeHtml(c.auto_reply_preview || '—')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${activeTab === 'webhooks' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Historial de Actividad y Comprobaciones (${logs.length})</strong>
              <button type="button" class="btn-secondary" style="font-size:0.74rem;" onclick="window.consoleApp.exportAuditTableToExcel('wa_logs')">Exportar Excel</button>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Fecha / Hora</th>
                    <th>Evento</th>
                    <th>Resultado</th>
                    <th>Resumen</th>
                    <th>Nota / Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  ${logs.length === 0 ? `
                    <tr><td colspan="5" style="padding:1.5rem; text-align:center; color:var(--text-muted);">Aún no hay actividad registrada.</td></tr>
                  ` : logs.map(l => `
                    <tr>
                      <td class="num-col" style="white-space: nowrap;">${this.escapeHtml((l.created_at || '').replace('T', ' ').slice(0, 19))}</td>
                      <td>${this.escapeHtml(l.event_type)}</td>
                      <td><span class="erp-status-pill ${l.status === 'failed' || l.status === 'rejected' ? 'err' : 'ok'}">${this.escapeHtml(l.status)}</span></td>
                      <td>${this.escapeHtml(l.summary)}</td>
                      <td style="color: var(--text-muted);">${this.escapeHtml(l.error_detail || '—')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${this.renderErpAuditFooter({
          entity: storeName,
          moduleLabel: mod.fullName,
          count: activeTab === 'llamadas' ? calls.length : logs.length,
          statusLabel: statusMeta.text,
          exportKey: 'wa_logs'
        })}
      `;
    }

    // 11. Parrilla de Publicaciones (Instagram, Facebook y TikTok — Estación 05)
    if (mod.id === 'social-planner') {
      const s5 = this.station5Data || {};
      const settings = s5.settings || { timezone: 'America/Bogota' };
      const integMap = s5.integrations || {};
      const posts = Array.isArray(s5.socialPosts) ? s5.socialPosts : [];
      const reminders = Array.isArray(s5.manualReminders) ? s5.manualReminders : [];
      const storeName = (this.currentUser && this.currentUser.companyName) || (this.getActiveStoreName ? this.getActiveStoreName() : 'Mi Tienda');

      const editingPost = this.editingSocialPostId ? posts.find(p => p.id === this.editingSocialPostId) : null;
      const nowDate = new Date().toISOString().slice(0, 10);
      const valTitle = editingPost ? editingPost.title : (document.getElementById('sp-title')?.value || '');
      const valText = editingPost ? editingPost.content_text : (document.getElementById('sp-text')?.value || '');
      const valMediaUrl = editingPost ? editingPost.media_url : (document.getElementById('sp-media-url')?.value || '');
      const valNotes = editingPost ? editingPost.media_format_notes : (document.getElementById('sp-format-notes')?.value || '');
      const schedParts = editingPost && editingPost.scheduled_at ? editingPost.scheduled_at.split(' ') : [nowDate, '18:00'];
      const valDate = schedParts[0] || nowDate;
      const valTime = schedParts[1] || '18:00';

      const socialProviders = ['instagram', 'facebook', 'tiktok'];
      const pendingRemCount = reminders.filter(r => r.status === 'pendiente').length;
      const connectedSocialCount = socialProviders.filter(p => integMap[p] && integMap[p].status === 'conectado').length;
      const activeTab = editingPost ? 'programar' : this.getModuleSubTab('social-planner', 'parrilla');

      return `
        ${this.renderErpHeader({
          code: 'MOD-06.1',
          title: mod.fullName,
          subtitle: 'Programación multired (Instagram, Facebook y TikTok)',
          helpText: 'Publica automáticamente cuando la API oficial y el formato de la red lo permiten. Si requiere acción manual en la app nativa, genera un recordatorio detallado con fecha, red, motivo y acción necesaria.',
          actionsHtml: `
            <select id="sp-timezone-select" class="form-control" onchange="window.consoleApp.updateStation5Settings({ timezone: this.value })" style="width: auto;">
              ${['America/Bogota', 'America/Mexico_City', 'America/Lima', 'America/Santiago', 'Europe/Madrid', 'UTC'].map(tz => `
                <option value="${tz}" ${settings.timezone === tz ? 'selected' : ''}>Zona: ${tz}</option>
              `).join('')}
            </select>
            <button type="button" class="btn-primary-large" style="font-size:0.84rem;" onclick="window.consoleApp.setModuleSubTab('social-planner', 'programar')">+ Programar Publicación</button>
            <button type="button" class="btn-secondary" onclick="window.consoleApp.exportAuditTableToExcel('social_posts')">Exportar Excel Auditoría</button>
          `
        })}

        <div class="erp-kpi-strip">
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Cuentas Sociales Conectadas</span>
            <span class="erp-kpi-val num-col">${connectedSocialCount} / 3</span>
            <span class="erp-kpi-sub">Instagram, Facebook y TikTok</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Publicaciones en Parrilla</span>
            <span class="erp-kpi-val num-col" style="color: var(--accent-1);">${posts.length}</span>
            <span class="erp-kpi-sub">Zona: ${this.escapeHtml(settings.timezone)}</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Recordatorios Manuales</span>
            <span class="erp-kpi-val num-col" style="color: ${pendingRemCount > 0 ? 'var(--data-amber)' : 'var(--text-main)'};">${pendingRemCount}</span>
            <span class="erp-kpi-sub">Acciones pendientes en app</span>
          </div>
        </div>

        ${this.renderErpSubTabs('social-planner', activeTab, [
          { key: 'parrilla', label: '1. Parrilla de Publicaciones', count: posts.length },
          { key: 'recordatorios', label: '2. Recordatorios Manuales', count: pendingRemCount },
          { key: 'programar', label: editingPost ? '3. Editando Publicación' : '3. + Programar Publicación' },
          { key: 'cuentas', label: '4. Cuentas Sociales', count: connectedSocialCount }
        ])}

        ${activeTab === 'parrilla' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Parrilla de Publicaciones Programadas y Estados Reales (${posts.length})</strong>
              <button type="button" class="btn-primary-large" style="font-size:0.8rem;" onclick="window.consoleApp.setModuleSubTab('social-planner', 'programar')">+ Nueva Publicación</button>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Fecha / Zona Horaria</th>
                    <th>Título y Texto</th>
                    <th>Redes Destino</th>
                    <th>Formato</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${posts.length === 0 ? `
                    <tr><td colspan="6" style="padding:1.5rem; text-align:center; color:var(--text-muted);">Sin publicaciones programadas aún. Usa "3. + Programar Publicación" para crear borradores o programar en IG, FB y TikTok.</td></tr>
                  ` : posts.map(p => {
                    const pillCls = p.status === 'publicada' ? 'ok' : (p.status === 'error' ? 'err' : (p.status === 'requiere_accion' ? 'warn' : ''));
                    return `
                      <tr>
                        <td class="num-col" style="white-space:nowrap;">
                          <strong>${this.escapeHtml(p.scheduled_at)}</strong><br>
                          <span style="font-size:0.72rem; color:var(--text-muted);">${this.escapeHtml(p.timezone)}</span>
                        </td>
                        <td>
                          <strong>${this.escapeHtml(p.title)}</strong>
                          <div style="font-size:0.76rem; color:var(--text-muted); margin-top:0.2rem;">${this.escapeHtml(p.content_text)}</div>
                          ${p.error_log ? `<div style="font-size:0.72rem; color:var(--data-crimson); margin-top:0.2rem;">Error: ${this.escapeHtml(p.error_log)}</div>` : ''}
                        </td>
                        <td>
                          <div class="erp-chip-group">
                            ${(p.networks || []).map(n => {
                              const ns = (p.networkStatuses && p.networkStatuses[n]) || {};
                              return `<span class="erp-status-pill">${this.escapeHtml(n.toUpperCase())}: ${ns.mode === 'manual_reminder' ? 'Manual' : this.escapeHtml(ns.status || p.status)}</span>`;
                            }).join('')}
                          </div>
                        </td>
                        <td>${this.escapeHtml(p.media_type)}</td>
                        <td><span class="erp-status-pill ${pillCls}">${this.escapeHtml(p.status)}</span></td>
                        <td style="white-space:nowrap;">
                          <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
                            <button type="button" class="btn-secondary" onclick="window.consoleApp.startEditSocialPost('${p.id}')" style="font-size:0.72rem; padding:0.22rem 0.5rem;">Editar</button>
                            <button type="button" class="btn-secondary" onclick="window.consoleApp.retrySocialPost('${p.id}')" style="font-size:0.72rem; padding:0.22rem 0.5rem; border-color:var(--accent-1); color:var(--accent-1);">Publicar / Reintentar</button>
                            <button type="button" class="btn-secondary" onclick="window.consoleApp.cancelSocialPost('${p.id}')" style="font-size:0.72rem; padding:0.22rem 0.5rem; color:var(--data-crimson);">Cancelar</button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${activeTab === 'recordatorios' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Recordatorios de Acción Manual en Redes (${reminders.length})</strong>
              <span style="font-size:0.78rem; color:var(--text-muted);">Publicaciones que requieren carga o edición nativa fuera de la API</span>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Red / Fecha Programada</th>
                    <th>Motivo Técnico</th>
                    <th>Acción Requerida</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${reminders.length === 0 ? `
                    <tr><td colspan="5" style="padding:1.5rem; text-align:center; color:var(--text-muted);">Sin recordatorios pendientes. Si una publicación no admite autopublicación en la API oficial, se registrará aquí.</td></tr>
                  ` : reminders.map(r => `
                    <tr>
                      <td>
                        <strong style="text-transform:uppercase;">${this.escapeHtml(r.network)}</strong><br>
                        <span class="num-col" style="font-size:0.74rem; color:var(--text-muted);">${this.escapeHtml(r.scheduled_at)} (${this.escapeHtml(r.timezone)})</span>
                      </td>
                      <td>${this.escapeHtml(r.reason)}</td>
                      <td>${this.escapeHtml(r.required_action)}</td>
                      <td><span class="erp-status-pill ${r.status === 'completado' ? 'ok' : 'warn'}">${this.escapeHtml(r.status)}</span></td>
                      <td>
                        ${r.status !== 'completado'
                          ? `<button type="button" class="btn-primary-large" onclick="window.consoleApp.completeSocialReminder('${r.id}')" style="font-size:0.72rem; padding:0.28rem 0.6rem;">Marcar Completado</button>`
                          : '<span style="font-size:0.74rem; color:var(--accent-1); font-weight:700;">Completado ✓</span>'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${activeTab === 'programar' ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.25rem;">
            <div class="erp-table-wrapper">
              <div class="erp-table-toolbar">
                <strong>${editingPost ? 'Editar / Reprogramar Publicación' : 'Nueva Publicación Multired (IG, FB y TikTok)'}</strong>
                ${editingPost ? `<button type="button" class="btn-secondary" onclick="window.consoleApp.cancelEditSocialPost()" style="font-size: 0.72rem;">Cancelar Edición</button>` : ''}
              </div>
              <div style="padding: 1.15rem; display: flex; flex-direction: column; gap: 0.7rem;">
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Título de referencia</label>
                  <input type="text" id="sp-title" class="form-control" value="${this.escapeHtml(valTitle)}" placeholder="Ej: Lanzamiento Combo Smartwatch Dropi" oninput="window.consoleApp.refreshSocialPreviewDOM()">
                </div>
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Texto / Copy de la publicación *</label>
                  <textarea id="sp-text" rows="3" class="form-control" oninput="window.consoleApp.refreshSocialPreviewDOM()" placeholder="Escribe el texto principal para Instagram, Facebook y TikTok...">${this.escapeHtml(valText)}</textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1.4fr; gap: 0.6rem;">
                  <div>
                    <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Formato Multimedia</label>
                    <select id="sp-media-type" class="form-control" onchange="window.consoleApp.socialDraftMediaType = this.value; window.consoleApp.refreshSocialPreviewDOM()">
                      <option value="image" ${this.socialDraftMediaType === 'image' ? 'selected' : ''}>Imagen (JPG/PNG)</option>
                      <option value="video" ${this.socialDraftMediaType === 'video' ? 'selected' : ''}>Video / Reel (MP4)</option>
                      <option value="none" ${this.socialDraftMediaType === 'none' ? 'selected' : ''}>Solo Texto (sin multimedia)</option>
                    </select>
                  </div>
                  <div>
                    <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">URL de Imagen o Video</label>
                    <input type="url" id="sp-media-url" class="form-control" value="${this.escapeHtml(valMediaUrl)}" placeholder="https://..." oninput="window.consoleApp.refreshSocialPreviewDOM()">
                  </div>
                </div>

                <div style="display: flex; gap: 1rem; flex-wrap: wrap; background: #F8F9F6; padding: 0.6rem 0.8rem; border-radius: 6px; border: 1px solid var(--border-subtle); font-size: 0.82rem;">
                  <strong style="width: 100%; font-size: 0.74rem; color: var(--text-muted);">Redes Destino:</strong>
                  <label><input type="checkbox" id="sp-net-ig" ${this.socialDraftNetworks.instagram ? 'checked' : ''} onchange="window.consoleApp.socialDraftNetworks.instagram = this.checked; window.consoleApp.refreshSocialPreviewDOM()"> Instagram</label>
                  <label><input type="checkbox" id="sp-net-fb" ${this.socialDraftNetworks.facebook ? 'checked' : ''} onchange="window.consoleApp.socialDraftNetworks.facebook = this.checked; window.consoleApp.refreshSocialPreviewDOM()"> Facebook</label>
                  <label><input type="checkbox" id="sp-net-tt" ${this.socialDraftNetworks.tiktok ? 'checked' : ''} onchange="window.consoleApp.socialDraftNetworks.tiktok = this.checked; window.consoleApp.refreshSocialPreviewDOM()"> TikTok</label>
                </div>

                <label style="font-size: 0.78rem; display: flex; align-items: center; gap: 0.45rem; color: var(--text-main);">
                  <input type="checkbox" id="sp-native-app" ${this.socialDraftRequiresNativeApp ? 'checked' : ''} onchange="window.consoleApp.socialDraftRequiresNativeApp = this.checked; window.consoleApp.refreshSocialPreviewDOM()">
                  <span>Incluye edición nativa dentro de la app (genera recordatorio manual)</span>
                </label>

                <input type="text" id="sp-format-notes" class="form-control" value="${this.escapeHtml(valNotes)}" placeholder="Nota opcional de formato o audio">

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
                  <div>
                    <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Fecha (${this.escapeHtml(settings.timezone)})</label>
                    <input type="date" id="sp-date" class="form-control" value="${this.escapeHtml(valDate)}" oninput="window.consoleApp.refreshSocialPreviewDOM()">
                  </div>
                  <div>
                    <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Hora (${this.escapeHtml(settings.timezone)})</label>
                    <input type="time" id="sp-time" class="form-control" value="${this.escapeHtml(valTime)}" oninput="window.consoleApp.refreshSocialPreviewDOM()">
                  </div>
                </div>

                <div style="display: flex; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.25rem;">
                  <button type="button" class="btn-secondary" onclick="window.consoleApp.submitSocialPost('draft')" style="flex: 1;">Guardar Borrador</button>
                  <button type="button" class="btn-primary-large" onclick="window.consoleApp.submitSocialPost('schedule')" style="flex: 1.5; justify-content: center;">
                    ${editingPost ? 'Guardar Cambios y Reprogramar' : 'Programar Publicación'}
                  </button>
                </div>
              </div>
            </div>

            <div class="erp-table-wrapper">
              <div class="erp-table-toolbar">
                <strong>Vista Previa Antes de Programar</strong>
                <span style="font-size:0.76rem; color:var(--text-muted);">${this.escapeHtml(settings.timezone)}</span>
              </div>
              <div style="padding: 1.15rem;">
                <div id="sp-live-preview-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
                  ${this.buildSocialPreviewHTML(valText, this.socialDraftMediaType, valMediaUrl, `${valDate} ${valTime}`, settings.timezone)}
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        ${activeTab === 'cuentas' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Cuentas Sociales Autorizadas (${this.escapeHtml(storeName)})</strong>
              <span style="font-size:0.78rem; color:var(--text-muted);">Autenticación OAuth oficial por tienda</span>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Red Social</th>
                    <th>Cuenta / Usuario</th>
                    <th>Permisos Requeridos</th>
                    <th>Requisitos Backend</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${socialProviders.map(prov => {
                    const it = integMap[prov] || { status: 'no_conectado', status_reason: 'Pendiente OAuth', env: { label: prov, scopes: [], missingRequirements: [] } };
                    const env = it.env || { label: prov, scopes: [], missingRequirements: [] };
                    const isConn = it.status === 'conectado';
                    return `
                      <tr>
                        <td><strong style="text-transform:capitalize;">${this.escapeHtml(env.label || prov)}</strong></td>
                        <td>${this.escapeHtml(it.account_name || 'Sin vincular')}<br><span style="font-size:0.74rem; color:var(--text-muted);">${this.escapeHtml(it.authorized_user_email || 'Ninguno')}</span></td>
                        <td><code style="font-size:0.72rem;">${this.escapeHtml((env.scopes || []).join(', '))}</code></td>
                        <td style="font-size:0.74rem; color:var(--data-crimson);">${(env.missingRequirements && env.missingRequirements.length > 0) ? this.escapeHtml(env.missingRequirements.join(', ')) : '<span style="color:var(--accent-1);">Completos ✓</span>'}</td>
                        <td><span class="erp-status-pill ${isConn ? 'ok' : 'warn'}">${this.escapeHtml(it.status)}</span></td>
                        <td style="white-space:nowrap;">
                          <div style="display:flex; gap:0.35rem;">
                            <button type="button" class="btn-primary-large" onclick="window.consoleApp.marketingProviderAction('${prov}', 'connect')" style="font-size:0.72rem; padding:0.25rem 0.6rem;">${isConn ? 'Reconectar' : 'Conectar OAuth'}</button>
                            <button type="button" class="btn-secondary" onclick="window.consoleApp.marketingProviderAction('${prov}', 'test')" style="font-size:0.72rem; padding:0.25rem 0.55rem;">Verificar</button>
                            ${isConn ? `<button type="button" class="btn-secondary" onclick="window.consoleApp.marketingProviderAction('${prov}', 'disconnect')" style="font-size:0.72rem; padding:0.25rem 0.55rem; color:var(--data-crimson);">Desconectar</button>` : ''}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${this.renderErpAuditFooter({
          entity: storeName,
          moduleLabel: mod.fullName,
          count: activeTab === 'recordatorios' ? reminders.length : posts.length,
          exportKey: 'social_posts'
        })}
      `;
    }

    // 12. Gestión de Campañas Ads (Meta/Google), Permisos por Colaborador y Atribución Checkout (Estación 05)
    if (mod.id === 'ad-manager') {
      const s5 = this.station5Data || {};
      const settings = s5.settings || { attribution_window_days: 30, reporting_period: '30d' };
      const integMap = s5.integrations || {};
      const collaborators = Array.isArray(s5.collaborators) ? s5.collaborators : [];
      const activeCollab = s5.activeCollaborator || { collaborator_name: 'Usuario', collaborator_email: '', can_connect_accounts: 0, can_view_metrics: 1, can_pause_resume: 0, can_modify_budget: 0 };
      const campaignsData = s5.campaignsData || { accessDenied: false, campaigns: [], totals: { spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, cpc: 0, purchases: 0, attributedRevenue: 0, roas: 0 } };
      const attrReport = s5.attributionReport || { appliedAttributionWindowDays: 30, appliedPeriod: '30d', summary: {}, orders: [] };
      const actionLogs = Array.isArray(s5.actionLogs) ? s5.actionLogs : [];
      const attrSum = attrReport.summary || {};
      const navCtx = window.EasyGrowAttribution ? window.EasyGrowAttribution.getAttributionContext() : { firstOrigin: null, lastPaidCampaign: null };
      const storeName = (this.currentUser && this.currentUser.companyName) || (this.getActiveStoreName ? this.getActiveStoreName() : 'Mi Tienda');

      const adAccounts = Array.from(new Set(campaignsData.campaigns.map(c => c.account_name)));
      const connectedAdsCount = ['meta_ads', 'google_ads'].filter(p => integMap[p] && integMap[p].status === 'conectado').length;
      const activeTab = this.getModuleSubTab('ad-manager', 'campanas');

      return `
        ${this.renderErpHeader({
          code: 'MOD-06.2',
          title: mod.fullName,
          subtitle: 'Administración de campañas existentes (Meta/Google Ads), atribución en checkout y permisos individuales.',
          helpText: 'Conecta cuentas publicitarias existentes mediante autorización oficial para consultar métricas unificadas, pausar/reanudar o ajustar presupuesto previa confirmación. La atribución usa ventana configurable sin inferencias y cada colaborador tiene permisos individuales.',
          actionsHtml: `
            <select class="form-control" onchange="window.consoleApp.switchActiveMarketingCollaborator(this.value)" title="Colaborador activo" style="width:auto;">
              ${collaborators.map(col => `
                <option value="${this.escapeHtml(col.collaborator_email)}" ${activeCollab.collaborator_email === col.collaborator_email ? 'selected' : ''}>
                  Usuario: ${this.escapeHtml(col.collaborator_name)} (${this.escapeHtml(col.role_preset)})
                </option>
              `).join('')}
            </select>
            <select class="form-control" onchange="window.consoleApp.updateStation5Settings({ attributionWindowDays: Number(this.value) })" title="Ventana de atribución" style="width:auto;">
              ${[1, 7, 14, 30, 60, 90].map(d => `
                <option value="${d}" ${Number(settings.attribution_window_days) === d ? 'selected' : ''}>Ventana: ${d} días</option>
              `).join('')}
            </select>
            <button type="button" class="btn-secondary" onclick="window.consoleApp.exportAuditTableToExcel('campaigns_audit')">Exportar Excel Auditoría</button>
          `
        })}

        <div class="erp-kpi-strip">
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Cuentas Ads Conectadas</span>
            <span class="erp-kpi-val num-col">${connectedAdsCount} / 2</span>
            <span class="erp-kpi-sub">Meta Ads &amp; Google Ads</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Ventas Atribuidas</span>
            <span class="erp-kpi-val num-col" style="color: var(--accent-1);">$${Number(attrSum.attributedRevenue || 0).toLocaleString('es-CO')}</span>
            <span class="erp-kpi-sub">Ventana ${attrReport.appliedAttributionWindowDays}d (${this.escapeHtml(attrReport.appliedPeriod)})</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">ROAS Consolidado</span>
            <span class="erp-kpi-val num-col">${Number(campaignsData.totals.roas || 0).toFixed(2)}x</span>
            <span class="erp-kpi-sub">Última campaña pagada</span>
          </div>
          <div class="erp-kpi-cell">
            <span class="erp-kpi-lbl">Órdenes Completadas</span>
            <span class="erp-kpi-val num-col">${attrSum.completedCount || 0}</span>
            <span class="erp-kpi-sub">Sin atribución: ${attrSum.unattributedCompletedCount || 0}</span>
          </div>
        </div>

        ${this.renderErpSubTabs('ad-manager', activeTab, [
          { key: 'campanas', label: '1. Campañas & Métricas', count: campaignsData.campaigns.length },
          { key: 'atribucion', label: '2. Atribución Ventas Checkout', count: (attrReport.orders || []).length },
          { key: 'permisos', label: '3. Matriz de Permisos', count: collaborators.length },
          { key: 'cuentas_ads', label: '4. Cuentas Ads', count: connectedAdsCount },
          { key: 'auditoria', label: '5. Bitácora Auditoría', count: actionLogs.length }
        ])}

        ${activeTab === 'campanas' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Campañas Existentes (Meta Ads + Google Ads)</strong>
              <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
                <select class="form-control" onchange="window.consoleApp.setAdFilter('provider', this.value)" style="width: auto; font-size: 0.78rem;">
                  <option value="ALL" ${this.adFilters.provider === 'ALL' ? 'selected' : ''}>Todas las Redes</option>
                  <option value="meta_ads" ${this.adFilters.provider === 'meta_ads' ? 'selected' : ''}>Meta Ads</option>
                  <option value="google_ads" ${this.adFilters.provider === 'google_ads' ? 'selected' : ''}>Google Ads</option>
                </select>
                <select class="form-control" onchange="window.consoleApp.setAdFilter('accountId', this.value)" style="width: auto; font-size: 0.78rem;">
                  <option value="ALL">Todas las Cuentas (${adAccounts.length})</option>
                  ${adAccounts.map(acc => `<option value="${this.escapeHtml(acc)}">${this.escapeHtml(acc)}</option>`).join('')}
                </select>
                <select class="form-control" onchange="window.consoleApp.setAdFilter('period', this.value)" style="width: auto; font-size: 0.78rem;">
                  <option value="7d" ${this.adFilters.period === '7d' ? 'selected' : ''}>Últimos 7 días</option>
                  <option value="30d" ${this.adFilters.period === '30d' ? 'selected' : ''}>Últimos 30 días</option>
                  <option value="90d" ${this.adFilters.period === '90d' ? 'selected' : ''}>Últimos 90 días</option>
                  <option value="all" ${this.adFilters.period === 'all' ? 'selected' : ''}>Histórico</option>
                </select>
              </div>
            </div>

            ${this.pendingCampaignConfirm ? `
              <div style="background: #FFFFFF; border-bottom: 2px solid #111111; padding: 1rem 1.15rem;">
                <strong style="color: #111111;">Confirmación Requerida Antes de Ejecutar en Plataforma</strong>
                <div style="font-size: 0.82rem; color: var(--text-main); margin: 0.4rem 0;">
                  Tienda: <b>${this.escapeHtml(storeName)}</b> • Colaborador: <b>${this.escapeHtml(activeCollab.collaborator_name)}</b> • Cuenta: <b>${this.escapeHtml(this.pendingCampaignConfirm.accountName)}</b> • Campaña: <b>${this.escapeHtml(this.pendingCampaignConfirm.campaignName)}</b> • Acción: <b>${this.escapeHtml(this.pendingCampaignConfirm.actionLabel)}</b>
                </div>
                <div style="display: flex; gap: 0.55rem;">
                  <button type="button" class="btn-primary-large" onclick="window.consoleApp.confirmExecuteCampaignAction()" style="font-size: 0.8rem;">Confirmar y Enviar a ${this.escapeHtml(this.pendingCampaignConfirm.provider)}</button>
                  <button type="button" class="btn-secondary" onclick="window.consoleApp.pendingCampaignConfirm = null; window.consoleApp.openModuleFull('ad-manager', false);" style="font-size: 0.8rem;">Cancelar</button>
                </div>
              </div>
            ` : ''}

            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Proveedor / Cuenta</th>
                    <th>Campaña</th>
                    <th>Estado</th>
                    <th class="num-col">Presupuesto Diario</th>
                    <th class="num-col">Inversión</th>
                    <th class="num-col">Impr. / Alcance</th>
                    <th class="num-col">Clics / CTR / CPC</th>
                    <th class="num-col">Compras / Ingresos / ROAS</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${campaignsData.accessDenied ? `
                    <tr><td colspan="9" style="padding:1.5rem; color:var(--data-crimson); font-weight:700;">${this.escapeHtml(campaignsData.reason)}</td></tr>
                  ` : campaignsData.campaigns.length === 0 ? `
                    <tr><td colspan="9" style="padding:1.5rem; text-align:center; color:var(--text-muted);">No hay campañas importadas aún porque ninguna cuenta publicitaria está conectada en esta tienda. Conecta Meta Ads o Google Ads en "4. Cuentas Ads".</td></tr>
                  ` : campaignsData.campaigns.map(c => `
                    <tr>
                      <td><strong>${this.escapeHtml(c.provider)}</strong><div style="font-size: 0.72rem; color: var(--text-muted);">${this.escapeHtml(c.account_name)}</div></td>
                      <td><strong>${this.escapeHtml(c.name)}</strong></td>
                      <td><span class="erp-status-pill ${c.status === 'ACTIVE' ? 'ok' : 'warn'}">${this.escapeHtml(c.status)}</span></td>
                      <td class="num-col">$${Number(c.daily_budget).toLocaleString('es-CO')} ${this.escapeHtml(c.currency)}</td>
                      <td class="num-col">$${Number(c.spend).toLocaleString('es-CO')}</td>
                      <td class="num-col">${Number(c.impressions).toLocaleString('es-CO')} / ${c.reach !== null ? Number(c.reach).toLocaleString('es-CO') : 'N/D'}</td>
                      <td class="num-col">${c.clicks} • ${c.ctr}% • $${c.cpc.toLocaleString('es-CO')}</td>
                      <td class="num-col"><strong>${c.purchases}</strong> • $${c.attributedRevenue.toLocaleString('es-CO')} • <b style="color: var(--accent-1);">${c.roas}x</b></td>
                      <td style="white-space: nowrap;">
                        <button type="button" class="btn-secondary" onclick="window.consoleApp.requestCampaignAction('${c.id}', '${c.status === 'ACTIVE' ? 'PAUSE_CAMPAIGN' : 'RESUME_CAMPAIGN'}')" style="font-size: 0.72rem; padding: 0.22rem 0.5rem;">${c.status === 'ACTIVE' ? 'Pausar' : 'Reanudar'}</button>
                        <button type="button" class="btn-secondary" onclick="window.consoleApp.promptBudgetChange('${c.id}')" style="font-size: 0.72rem; padding: 0.22rem 0.5rem;">Presupuesto</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${activeTab === 'atribucion' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <div>
                <strong>Atribución de Ventas en Checkout (${attrReport.appliedAttributionWindowDays} días • Periodo: ${this.escapeHtml(attrReport.appliedPeriod)})</strong>
                <div style="font-size:0.76rem; color:var(--text-muted);">Primer origen: <b>${navCtx.firstOrigin ? `${this.escapeHtml(navCtx.firstOrigin.source)}/${this.escapeHtml(navCtx.firstOrigin.medium)}` : 'Ninguno'}</b> • Última campaña pagada: <b>${navCtx.lastPaidCampaign ? this.escapeHtml(navCtx.lastPaidCampaign.campaignName) : 'Sin campaña (será sin atribución)'}</b></div>
              </div>
              <div style="display:flex; gap:0.45rem; flex-wrap:wrap;">
                <button type="button" class="btn-secondary" onclick="window.consoleApp.simulateNavigationTouch('paid')" style="font-size: 0.74rem;">Registrar Visita Pagada (UTM)</button>
                <button type="button" class="btn-secondary" onclick="window.consoleApp.simulateNavigationTouch('direct')" style="font-size: 0.74rem;">Registrar Visita Directa Posterior</button>
                <button type="button" class="btn-secondary" onclick="window.consoleApp.resetNavigationAttribution()" style="font-size: 0.74rem;">Reiniciar Sesión Navegador</button>
              </div>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Cliente</th>
                    <th class="num-col">Monto (COP)</th>
                    <th>Primer Origen</th>
                    <th>Última Campaña Pagada (Principal ROAS)</th>
                    <th>Estado de Orden</th>
                  </tr>
                </thead>
                <tbody>
                  ${(attrReport.orders || []).length === 0 ? `
                    <tr><td colspan="6" style="padding:1.5rem; text-align:center; color:var(--text-muted);">No hay órdenes completadas en el checkout todavía. Cada compra registrada en Estación 01 guardará aquí su primer origen y última campaña pagada.</td></tr>
                  ` : attrReport.orders.map(o => `
                    <tr>
                      <td class="num-col"><strong>${this.escapeHtml(o.order_key)}</strong></td>
                      <td>${this.escapeHtml(o.customer_name)}</td>
                      <td class="num-col">$${Number(o.order_amount).toLocaleString('es-CO')}</td>
                      <td><code>${this.escapeHtml(o.first_origin_source)} / ${this.escapeHtml(o.first_origin_medium)}</code></td>
                      <td>
                        ${o.attribution_status === 'atribuida_campana_pagada'
                          ? `<b style="color: var(--accent-1);">${this.escapeHtml(o.last_paid_campaign_name)}</b> (${this.escapeHtml(o.last_paid_provider)})`
                          : `<span class="erp-status-pill">sin atribución</span>`}
                      </td>
                      <td>
                        <select class="form-control" onchange="window.consoleApp.updateAttributedOrderStatus('${this.escapeHtml(o.order_key)}', this.value)" style="font-size: 0.76rem; width: auto;">
                          <option value="COMPLETADA" ${o.order_status === 'COMPLETADA' ? 'selected' : ''}>COMPLETADA</option>
                          <option value="CANCELADA" ${o.order_status === 'CANCELADA' ? 'selected' : ''}>CANCELADA</option>
                          <option value="DEVUELTA" ${o.order_status === 'DEVUELTA' ? 'selected' : ''}>DEVUELTA</option>
                        </select>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${activeTab === 'permisos' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Matriz de Permisos por Colaborador (${this.escapeHtml(storeName)})</strong>
              <span style="font-size:0.78rem; color:var(--text-muted);">Configuración granular por persona</span>
            </div>
            <div style="padding: 1.15rem; border-bottom: 1px solid var(--border-subtle); background:#F8F9F6;">
              <div style="display: grid; grid-template-columns: 1fr 1.2fr 0.9fr; gap: 0.6rem; margin-bottom: 0.75rem;">
                <input type="text" id="perm-name" class="form-control" placeholder="Nombre del colaborador *">
                <input type="email" id="perm-email" class="form-control" placeholder="correo@colaborador.co *">
                <select id="perm-role-preset" class="form-control" onchange="window.consoleApp.applyPermissionPreset(this.value)">
                  <option value="Personalizado">Atajo de rol opcional...</option>
                  <option value="Solo Lectura / Analista">Analista (Solo métricas)</option>
                  <option value="Trafficker Operativo">Trafficker (Métricas + Pausar/Presupuesto)</option>
                  <option value="Administrador Marketing">Control Completo Marketing</option>
                </select>
              </div>
              <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem; margin-bottom: 0.75rem;">
                <label><input type="checkbox" id="perm-can-connect"> Conectar / desconectar cuentas</label>
                <label><input type="checkbox" id="perm-can-metrics" checked> Consultar métricas</label>
                <label><input type="checkbox" id="perm-can-pause"> Pausar / reanudar campañas</label>
                <label><input type="checkbox" id="perm-can-budget"> Modificar presupuestos</label>
              </div>
              <button type="button" class="btn-primary-large" onclick="window.consoleApp.requestSaveCollaboratorPermissions()">Revisar y Confirmar Permisos</button>

              ${this.pendingPermConfirm ? `
                <div style="background: #FFFFFF; border: 2px solid #111111; border-radius: 6px; padding: 0.9rem; margin-top: 0.9rem;">
                  <strong style="color: #111111;">Confirmar Asignación de Permisos</strong>
                  <p style="font-size: 0.82rem; color: var(--text-main); margin: 0.35rem 0;">
                    ¿Confirmas aplicar estos permisos a <b>${this.escapeHtml(this.pendingPermConfirm.collaboratorName)} (${this.escapeHtml(this.pendingPermConfirm.collaboratorEmail)})</b>?
                  </p>
                  <div style="display: flex; gap: 0.5rem;">
                    <button type="button" class="btn-primary-large" onclick="window.consoleApp.confirmSaveCollaboratorPermissions()" style="font-size: 0.78rem;">Confirmar y Guardar</button>
                    <button type="button" class="btn-secondary" onclick="window.consoleApp.pendingPermConfirm = null; window.consoleApp.openModuleFull('ad-manager', false);" style="font-size: 0.78rem;">Cancelar</button>
                  </div>
                </div>
              ` : ''}
            </div>

            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Conectar</th>
                    <th>Ver Métricas</th>
                    <th>Pausar/Reanudar</th>
                    <th>Presupuesto</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${collaborators.map(col => `
                    <tr>
                      <td><strong>${this.escapeHtml(col.collaborator_name)}</strong> <span style="color: var(--text-muted);">(${this.escapeHtml(col.collaborator_email)})</span></td>
                      <td>${col.can_connect_accounts ? '✓' : '—'}</td>
                      <td>${col.can_view_metrics ? '✓' : '—'}</td>
                      <td>${col.can_pause_resume ? '✓' : '—'}</td>
                      <td>${col.can_modify_budget ? '✓' : '—'}</td>
                      <td><button type="button" class="btn-secondary" onclick="window.consoleApp.loadCollaboratorIntoForm('${this.escapeHtml(col.collaborator_email)}')" style="font-size: 0.72rem; padding: 2px 7px;">Ajustar</button></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${activeTab === 'cuentas_ads' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Cuentas Publicitarias Conectadas (Meta Ads & Google Ads)</strong>
              <span style="font-size:0.78rem; color:var(--text-muted);">Requiere permiso de conexión de cuentas</span>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Plataforma</th>
                    <th>Cuenta / Usuario Autorizado</th>
                    <th>Scopes Requeridos</th>
                    <th>Requisitos Backend</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${['meta_ads', 'google_ads'].map(prov => {
                    const it = integMap[prov] || { status: 'no_conectado', env: { label: prov, scopes: [], missingRequirements: [] } };
                    const env = it.env || { label: prov, scopes: [], missingRequirements: [] };
                    const isConn = it.status === 'conectado';
                    return `
                      <tr>
                        <td><strong>${this.escapeHtml(env.label)}</strong></td>
                        <td>${this.escapeHtml(it.account_name || 'Sin autorizar')}<br><span style="font-size:0.74rem; color:var(--text-muted);">${this.escapeHtml(it.authorized_user_email || '—')}</span></td>
                        <td><code style="font-size:0.72rem;">${this.escapeHtml((env.scopes || []).join(', '))}</code></td>
                        <td style="font-size:0.74rem; color:var(--data-crimson);">${(env.missingRequirements && env.missingRequirements.length > 0) ? this.escapeHtml(env.missingRequirements.join(', ')) : '<span style="color:var(--accent-1);">Completos ✓</span>'}</td>
                        <td><span class="erp-status-pill ${isConn ? 'ok' : 'warn'}">${this.escapeHtml(it.status)}</span></td>
                        <td style="white-space:nowrap;">
                          <div style="display:flex; gap:0.35rem;">
                            <button type="button" class="btn-primary-large" onclick="window.consoleApp.marketingProviderAction('${prov}', 'connect')" style="font-size:0.72rem; padding:0.25rem 0.6rem;">${isConn ? 'Reconectar' : 'Conectar Cuenta'}</button>
                            <button type="button" class="btn-secondary" onclick="window.consoleApp.marketingProviderAction('${prov}', 'test')" style="font-size:0.72rem; padding:0.25rem 0.55rem;">Verificar</button>
                            ${isConn ? `<button type="button" class="btn-secondary" onclick="window.consoleApp.marketingProviderAction('${prov}', 'disconnect')" style="font-size:0.72rem; padding:0.25rem 0.55rem; color:var(--data-crimson);">Desconectar</button>` : ''}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${activeTab === 'auditoria' ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Bitácora de Auditoría de Acciones, Permisos y Conexiones (${actionLogs.length})</strong>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Fecha / Hora</th>
                    <th>Persona / Tienda</th>
                    <th>Cuenta / Campaña</th>
                    <th>Acción</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  ${actionLogs.length === 0 ? `
                    <tr><td colspan="5" style="padding:1.5rem; text-align:center; color:var(--text-muted);">Sin acciones registradas aún. Todo cambio en campañas, permisos o conexiones quedará auditado aquí.</td></tr>
                  ` : actionLogs.map(l => `
                    <tr>
                      <td class="num-col" style="white-space: nowrap;">${this.escapeHtml((l.created_at || '').replace('T', ' ').slice(0, 19))}</td>
                      <td><strong>${this.escapeHtml(l.actor_name)}</strong> • ${this.escapeHtml(l.store_name)}</td>
                      <td>${this.escapeHtml(l.account_name)}${l.campaign_name ? ` / ${this.escapeHtml(l.campaign_name)}` : ''}</td>
                      <td><code>${this.escapeHtml(l.action_type)}</code> ${l.new_value ? `(${this.escapeHtml(l.new_value)})` : ''}</td>
                      <td><span class="erp-status-pill">${this.escapeHtml(l.result_status)}</span> ${this.escapeHtml(l.result_message)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        ${this.renderErpAuditFooter({
          entity: storeName,
          moduleLabel: mod.fullName,
          count: campaignsData.campaigns.length,
          exportKey: 'campaigns_audit'
        })}
      `;
    }

    // 13. SEO Orgánico: Google Search Console en Modo Solo Lectura (Estación 05)
    if (mod.id === 'seo-analytics') {
      const s5 = this.station5Data || {};
      const integMap = s5.integrations || {};
      const scInteg = integMap.search_console || { status: 'no_conectado', env: { label: 'Google Search Console', scopes: ['https://www.googleapis.com/auth/webmasters.readonly'], missingRequirements: [] } };
      const seo = s5.seoWorkspace || { connectionStatus: 'sin_conexion', readOnlyNotice: 'Solo lectura.', metrics: null, rows: [], recommendations: [] };
      const isConnected = seo.connectionStatus === 'conectado';
      const activeTab = this.getModuleSubTab('seo-analytics', 'metricas');
      const storeName = (this.currentUser && this.currentUser.companyName) || (this.getActiveStoreName ? this.getActiveStoreName() : 'Mi Tienda');

      return `
        ${this.renderErpHeader({
          code: 'MOD-06.3',
          title: mod.fullName,
          subtitle: 'Consulta de métricas reales en Google Search Console bajo modo estricto de solo lectura.',
          helpText: 'Conecta una propiedad autorizada vía OAuth2 webmasters.readonly. No inventa datos cuando falta conexión ni modifica títulos, meta descripciones o contenido del sitio.',
          actionsHtml: `
            <span class="erp-status-pill ${isConnected ? 'ok' : ''}" style="font-size:0.78rem; padding:0.35rem 0.75rem;">
              Estado: ${isConnected ? `Conectado (${this.escapeHtml(seo.propertyUrl)})` : 'Sin conexión'}
            </span>
          `
        })}

        <div style="background: #F8F9F6; border: 1px solid var(--border-subtle); border-left: 4px solid #111111; border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 1rem; font-size: 0.82rem; color: var(--text-main);">
          <strong>Alcance Solo Lectura:</strong> ${this.escapeHtml(seo.readOnlyNotice)}
        </div>

        ${this.renderErpSubTabs('seo-analytics', activeTab, [
          { key: 'metricas', label: '1. Estado & Métricas Search Console', count: (seo.rows || []).length },
          { key: 'recomendaciones', label: '2. Recomendaciones Explicables', count: (seo.recommendations || []).length }
        ])}

        ${activeTab === 'metricas' ? (!isConnected ? `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Conexión Google Search Console (OAuth2 Solo Lectura)</strong>
              <span class="erp-status-pill warn">Sin conexión</span>
            </div>
            <div style="padding: 1.25rem;">
              <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 1rem;">
                Sin propiedad autorizada de Google Search Console para esta tienda. No se generan posiciones ni métricas ficticias sin conexión OAuth2 verificada (<code>webmasters.readonly</code>).
              </p>
              ${(scInteg.env && scInteg.env.missingRequirements && scInteg.env.missingRequirements.length > 0) ? `
                <div style="background: #F8F9F6; border: 1px solid rgba(209,67,67,0.35); border-radius: 6px; padding: 0.8rem 1rem; margin-bottom: 1rem; font-size: 0.8rem; color: var(--data-crimson);">
                  <b>Requisitos pendientes en backend para OAuth2 Search Console:</b> ${this.escapeHtml(scInteg.env.missingRequirements.join(', '))}
                </div>
              ` : ''}
              <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                <button type="button" class="btn-primary-large" onclick="window.consoleApp.marketingProviderAction('search_console', 'connect')">Conectar Google Search Console</button>
                <button type="button" class="btn-secondary" onclick="window.consoleApp.marketingProviderAction('search_console', 'test')">Verificar Conexión</button>
              </div>
            </div>
          </div>
        ` : `
          <div class="erp-kpi-strip">
            <div class="erp-kpi-cell"><span class="erp-kpi-lbl">Clics Orgánicos</span><span class="erp-kpi-val num-col" style="color: var(--accent-1);">${Number(seo.metrics.clicks).toLocaleString('es-CO')}</span><span class="erp-kpi-sub">${this.escapeHtml(this.seoFilters.period)}</span></div>
            <div class="erp-kpi-cell"><span class="erp-kpi-lbl">Impresiones</span><span class="erp-kpi-val num-col">${Number(seo.metrics.impressions).toLocaleString('es-CO')}</span><span class="erp-kpi-sub">Propiedad verificada</span></div>
            <div class="erp-kpi-cell"><span class="erp-kpi-lbl">CTR / Posición Promedio</span><span class="erp-kpi-val num-col">${seo.metrics.ctr}% / ${seo.metrics.avgPosition}</span><span class="erp-kpi-sub">Solo lectura</span></div>
          </div>

          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Consultas y Páginas (Search Console)</strong>
              <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
                <input type="text" id="seo-q-filter" class="form-control" value="${this.escapeHtml(this.seoFilters.query)}" placeholder="Filtrar consulta..." onchange="window.consoleApp.applySeoFilters()">
                <input type="text" id="seo-p-filter" class="form-control" value="${this.escapeHtml(this.seoFilters.page)}" placeholder="Filtrar página..." onchange="window.consoleApp.applySeoFilters()">
                <select id="seo-period-filter" class="form-control" onchange="window.consoleApp.applySeoFilters()">
                  <option value="7d" ${this.seoFilters.period === '7d' ? 'selected' : ''}>7 días</option>
                  <option value="28d" ${this.seoFilters.period === '28d' ? 'selected' : ''}>28 días</option>
                  <option value="90d" ${this.seoFilters.period === '90d' ? 'selected' : ''}>90 días</option>
                </select>
                <select id="seo-device-filter" class="form-control" onchange="window.consoleApp.applySeoFilters()">
                  <option value="ALL">Dispositivos: Todos</option>
                  <option value="MOBILE" ${this.seoFilters.device === 'MOBILE' ? 'selected' : ''}>MOBILE</option>
                  <option value="DESKTOP" ${this.seoFilters.device === 'DESKTOP' ? 'selected' : ''}>DESKTOP</option>
                </select>
                <select id="seo-country-filter" class="form-control" onchange="window.consoleApp.applySeoFilters()">
                  <option value="ALL">Países: Todos</option>
                  <option value="COL" ${this.seoFilters.country === 'COL' ? 'selected' : ''}>COL</option>
                  <option value="MEX" ${this.seoFilters.country === 'MEX' ? 'selected' : ''}>MEX</option>
                </select>
              </div>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Consulta</th>
                    <th>Página</th>
                    <th class="num-col">Clics</th>
                    <th class="num-col">Impresiones</th>
                    <th class="num-col">CTR</th>
                    <th class="num-col">Posición</th>
                  </tr>
                </thead>
                <tbody>
                  ${(seo.rows || []).length === 0 ? `
                    <tr><td colspan="6" style="padding:1.5rem; text-align:center; color:var(--text-muted);">Sin filas para los filtros seleccionados.</td></tr>
                  ` : seo.rows.map(r => `
                    <tr>
                      <td><strong>${this.escapeHtml(r.query)}</strong></td>
                      <td style="font-size:0.76rem;"><code>${this.escapeHtml(r.page)}</code></td>
                      <td class="num-col">${Number(r.clicks || 0)}</td>
                      <td class="num-col">${Number(r.impressions || 0)}</td>
                      <td class="num-col">${r.ctr || 0}%</td>
                      <td class="num-col">${r.position || 0}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `) : `
          <div class="erp-table-wrapper">
            <div class="erp-table-toolbar">
              <strong>Recomendaciones Explicables Basadas en Datos</strong>
            </div>
            <div class="erp-table-scroll">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Hallazgo / Título</th>
                    <th>Dato de Origen</th>
                    <th>Periodo</th>
                    <th>Recomendación</th>
                  </tr>
                </thead>
                <tbody>
                  ${(seo.recommendations || []).length === 0 ? `
                    <tr><td colspan="4" style="padding:1.5rem; text-align:center; color:var(--text-muted);">No hay recomendaciones disponibles sin datos conectados o alertas activas.</td></tr>
                  ` : seo.recommendations.map(rec => `
                    <tr>
                      <td><strong>${this.escapeHtml(rec.title)}</strong></td>
                      <td><code>${this.escapeHtml(rec.dataOrigin)}</code></td>
                      <td>${this.escapeHtml(rec.periodAnalyzed)}</td>
                      <td>${this.escapeHtml(rec.advice)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `}

        ${this.renderErpAuditFooter({
          entity: storeName,
          moduleLabel: mod.fullName,
          count: (seo.rows || []).length,
          statusLabel: isConnected ? 'Conectado (Solo Lectura)' : 'Sin conexión'
        })}
      `;
    }

    return ``;
  }

  // --- ERP Workspace Helpers & Audit Excel Export ---
  getModuleSubTab(modId, defaultTab) {
    if (!this.moduleSubTabs) this.moduleSubTabs = {};
    return this.moduleSubTabs[modId] || defaultTab;
  }

  setModuleSubTab(modId, tabKey) {
    if (!this.moduleSubTabs) this.moduleSubTabs = {};
    this.moduleSubTabs[modId] = tabKey;
    this.openModuleFull(modId, false);
  }

  renderHowItWorks(steps = []) {
    if (!Array.isArray(steps) || steps.length === 0) return '';
    return `
      <div class="erp-how-it-works">
        ${steps.map((s, idx) => `
          <div class="erp-step-card">
            <span class="erp-step-num ${s.done ? 'done' : ''}">${s.done ? '✓' : (idx + 1)}</span>
            <div>
              <strong style="font-size:0.82rem; color:var(--text-main); display:block;">${this.escapeHtml(s.title)}</strong>
              <span style="font-size:0.75rem; color:var(--text-muted); line-height:1.35;">${this.escapeHtml(s.desc)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderErpHeader({ code, title, subtitle, helpText, actionsHtml = '' }) {
    return `
      <div class="erp-workspace-header">
        <div style="min-width: 0; flex: 1;">
          <div class="erp-title-row">
            <span class="erp-module-code">${this.escapeHtml(code)}</span>
            <h2 style="margin:0; font-size:1.35rem; font-weight:700; color:var(--text-main);">${this.escapeHtml(title)}</h2>
            ${helpText ? `
              <span class="erp-help-badge" tabindex="0" aria-label="Alcance del módulo">
                ?
                <span class="erp-help-popover">${this.escapeHtml(helpText)}</span>
              </span>
            ` : ''}
          </div>
          ${subtitle ? `<p style="margin:0.25rem 0 0 0; font-size:0.84rem; color:var(--text-muted);">${this.escapeHtml(subtitle)}</p>` : ''}
        </div>
        ${actionsHtml ? `<div class="erp-header-actions">${actionsHtml}</div>` : ''}
      </div>
    `;
  }

  renderErpSubTabs(modId, activeKey, tabs) {
    return `
      <div class="erp-subtabs-bar" role="tablist">
        ${tabs.map(t => `
          <button type="button" role="tab" aria-selected="${activeKey === t.key ? 'true' : 'false'}"
            class="erp-subtab-btn ${activeKey === t.key ? 'active' : ''}"
            onclick="window.consoleApp.setModuleSubTab('${modId}', '${t.key}')">
            <span>${this.escapeHtml(t.label)}</span>
            ${t.count !== undefined && t.count !== null ? `<span class="erp-subtab-count" id="erp-tab-badge-${modId}-${t.key}">${this.escapeHtml(String(t.count))}</span>` : ''}
          </button>
        `).join('')}
      </div>
    `;
  }

  renderErpAuditFooter({ entity, moduleLabel, count, statusLabel = 'Verificado', exportKey = null }) {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const u = this.currentUser || this.user;
    const userEmail = (u && (u.email || u.name)) || 'admin@easygrow.co';
    return `
      <div class="erp-audit-bar">
        <div><strong>Entidad / Tienda:</strong> ${this.escapeHtml(entity || 'EasyGrow Principal')}</div>
        <div><strong>Responsable:</strong> ${this.escapeHtml(userEmail)}</div>
        <div><strong>Registros verificados:</strong> <span class="num-col">${Number(count || 0).toLocaleString('es-CO')}</span></div>
        <div><strong>Corte:</strong> <span class="num-col">${nowStr}</span></div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span class="erp-status-pill ok">${this.escapeHtml(statusLabel)}</span>
          ${exportKey ? `<button type="button" class="btn-secondary" style="font-size:0.74rem; padding:0.25rem 0.65rem;" onclick="window.consoleApp.exportAuditTableToExcel('${exportKey}')">Exportar Excel Auditoría</button>` : ''}
        </div>
      </div>
    `;
  }

  exportAuditTableToExcel(exportKey) {
    const storeName = this.getActiveStoreName ? this.getActiveStoreName() : 'EasyGrow';
    const userEmail = (this.user && (this.user.email || this.user.name)) || 'admin@easygrow.co';
    const cutOff = new Date().toISOString();
    const meta = (moduleName) => ({
      Fecha_Hora_Corte: cutOff,
      Entidad_Tienda: storeName,
      Usuario_Exportador: userEmail,
      Modulo_Origen: moduleName
    });

    let rows = [];
    let sheetName = 'Auditoria';
    let fileBase = `easygrow_auditoria_${exportKey}`;

    if (exportKey === 'marketplace') {
      sheetName = 'Catalogo_Productos';
      rows = (this.products || []).map(p => ({
        ...meta('01. Comercio & Catalogo'),
        SKU_ID: p.sku || p.id,
        Producto: p.name,
        Categoria: p.category || '',
        Origen_Etiqueta: p.origin_label || p.supplier || '',
        Tipo_Origen: p.origin_type || 'dropi',
        Ciudad_Despacho: p.origin_city || '',
        Precio_COP: Number(p.price || 0),
        Stock: Number(p.stock || 0),
        Proveedor: p.supplier || '',
        Especificaciones_Calidad: p.specifications || ''
      }));
    } else if (exportKey === 'shipping') {
      sheetName = 'Guias_Logistica';
      rows = (this.shipments || []).map(s => ({
        ...meta('01. Guias y Despacho'),
        Guia_ID: s.id,
        Pedido_ID: s.checkout_group_id || '',
        Origen: s.origin_label || '',
        Ruta: `${s.origin_city || ''} -> ${s.destination_city || ''}`,
        Transportadora: s.carrier_name || '',
        Costo_Envio_COP: Number(s.shipping_cost || 0),
        Tiempo_Estimado: s.estimated_time || '',
        Estado: s.status || '',
        Evaluacion_Proveedor: s.eval ? `Puntualidad:${s.eval.punctuality}/5 Estado:${s.eval.receivedCondition}/5 Especif:${s.eval.specQuality}/5` : 'Pendiente'
      }));
    } else if (exportKey === 'crm_contacts') {
      sheetName = 'CRM_Clientes_Compras';
      const stages = this.stages || [];
      const contacts = window.EasyGrowCRM ? window.EasyGrowCRM.getAll() : [];
      const purchases = this.purchases || [];
      rows = [];
      contacts.forEach(c => {
        const st = stages.find(s => s.slug === c.stage);
        const cname = c.contactPerson || c.contact_person || c.name || '';
        const hist = purchases.filter(p => p.contact_id === c.id || (p.customer_name || '').toLowerCase() === cname.toLowerCase());
        if (hist.length === 0) {
          rows.push({
            ...meta('02. CRM y Fidelizacion'),
            Cliente_ID: c.id,
            Cliente: cname,
            Empresa: c.company || c.name || '',
            Etapa: st ? st.name : (c.stage || ''),
            Categoria_Etapa: st ? st.common_category : '',
            Valor_Oportunidad_COP: Number(c.value || 0),
            Probabilidad_Pct: st ? Number(st.probability || 0) : 0,
            Orden_ID: '',
            Productos: '',
            Monto_Compra_COP: 0,
            Estado_Pedido: '',
            Fecha_Estimada_Entrega: '',
            Fecha_Real_Entrega: ''
          });
        } else {
          hist.forEach(h => {
            rows.push({
              ...meta('02. CRM y Fidelizacion'),
              Cliente_ID: c.id,
              Cliente: cname,
              Empresa: c.company || c.name || '',
              Etapa: st ? st.name : (c.stage || ''),
              Categoria_Etapa: st ? st.common_category : '',
              Valor_Oportunidad_COP: Number(c.value || 0),
              Probabilidad_Pct: st ? Number(st.probability || 0) : 0,
              Orden_ID: h.order_ref || h.id || '',
              Productos: h.products_summary || '',
              Monto_Compra_COP: Number(h.amount || 0),
              Estado_Pedido: h.order_status || '',
              Fecha_Estimada_Entrega: h.estimated_delivery_date || '',
              Fecha_Real_Entrega: h.actual_delivery_date || ''
            });
          });
        }
      });
    } else if (exportKey === 'formulas') {
      sheetName = 'Formulas_KPI';
      const priv = (this.privateFormulas || []).map(f => ({
        ...meta('02. Formulas KPI'),
        Formula_ID: f.id,
        Nombre: f.name,
        Ambito: 'Privada',
        Autor: f.author_name || userEmail,
        Expresion: f.expression,
        Unidad: f.unit || '',
        Descripcion: f.description || ''
      }));
      const comm = (this.communityFormulas || []).map(f => ({
        ...meta('02. Formulas KPI'),
        Formula_ID: f.id,
        Nombre: f.name,
        Ambito: 'Comunidad',
        Autor: f.author_name || '',
        Expresion: f.expression,
        Unidad: f.unit || '',
        Descripcion: f.description || ''
      }));
      rows = [...priv, ...comm];
    } else if (exportKey === 'forms') {
      sheetName = 'Respuestas_Captacion';
      rows = (this.formSubmissions || []).map(r => ({
        ...meta('03. Captacion Google Forms'),
        Respuesta_ID: r.id,
        Fecha_Creacion: r.created_date || '',
        Hora_Creacion: r.created_time || '',
        Remitente: r.respondent_name || '',
        Contacto: r.respondent_contact || '',
        Canal_Origen: r.source_channel || '',
        Clasificacion_Regla: r.matched_category || '',
        Sugerencia_IA: r.ai_suggested_category || '',
        Estado_Revision_Humana: r.human_status || '',
        Notas_Humanas: r.human_notes || '',
        Requerimiento: r.requirement_text || ''
      }));
    } else if (exportKey === 'qrs') {
      sheetName = 'QRs_Dinamicos';
      rows = (this.qrCodes || []).map(q => ({
        ...meta('03. Codigos QR Dinamicos'),
        QR_ID: q.id,
        Codigo: q.code_slug || '',
        Nombre: q.name || '',
        Ubicacion: q.placement || '',
        Campana: q.campaign || '',
        URL_Destino_Actual: q.target_url || '',
        Escaneos_Totales: Number(q.total_scans || 0),
        Escaneos_Unicos: Number(q.unique_scans || 0),
        Identificados_Form: Number(q.identified_leads || 0),
        Ultimo_Escaneo: q.last_scan_at || 'Sin escaneos'
      }));
    } else if (exportKey === 'wa_logs') {
      sheetName = 'Bitacora_Webhooks_WA';
      rows = (this.waWebhookLogs || []).map(l => ({
        ...meta('04. WhatsApp Business API'),
        Evento_ID: l.id || '',
        Fecha_Hora: l.created_at || '',
        Direccion: l.direction || '',
        Tipo_Evento: l.event_type || '',
        Estado_Procesamiento: l.status || '',
        Resumen: l.summary || '',
        Detalle_Error: l.error_detail || ''
      }));
    } else if (exportKey === 'social_posts') {
      sheetName = 'Parrilla_Social';
      const s5 = this.station5Data || {};
      rows = (s5.socialPosts || []).map(p => ({
        ...meta('05. Parrilla Redes Sociales'),
        Post_ID: p.id,
        Titulo: p.title || '',
        Redes: (p.networks || []).join(', '),
        Formato: p.media_type || 'image',
        Fecha_Programada: p.scheduled_at || '',
        Zona_Horaria: p.timezone || '',
        Estado: p.status || '',
        Error_Detalle: p.error_log || ''
      }));
    } else if (exportKey === 'campaigns_audit') {
      sheetName = 'Campanas_Auditoria_Ads';
      const s5 = this.station5Data || {};
      const camps = (s5.campaignsData && s5.campaignsData.campaigns) || [];
      rows = camps.map(c => ({
        ...meta('06. Campanas Meta y Google Ads'),
        Campana_ID: c.id,
        Plataforma: c.provider,
        Cuenta: c.account_name || '',
        Nombre: c.name,
        Estado: c.status,
        Presupuesto_Diario: Number(c.daily_budget || 0),
        Moneda: c.currency || 'COP',
        Inversion: Number(c.spend || 0),
        Impresiones: Number(c.impressions || 0),
        Clics: Number(c.clicks || 0),
        Compras_Atribuidas: Number(c.purchases || 0),
        Ingresos_Atribuidos: Number(c.attributedRevenue || 0),
        ROAS: Number(c.roas || 0)
      }));
    } else if (exportKey === 'executive_goals') {
      sheetName = 'Objetivos_Gerencia';
      rows = this.getExecutiveGoals().map(g => ({
        ...meta('01. Objetivos Gerenciales'),
        Objetivo_ID: g.id,
        Objetivo: g.title,
        Area: g.area,
        Responsable: g.owner,
        Fecha_Limite: g.deadline || '',
        Avance_Actual: Number(g.current || 0),
        Meta: Number(g.target || 0),
        Unidad: g.unit || '',
        Cumplimiento_Pct: g.pct,
        Semaforo: g.pct >= 80 ? 'En meta' : (g.pct >= 45 ? 'En progreso' : 'Atencion requerida')
      }));
    } else if (exportKey === 'calendar_events') {
      sheetName = 'Calendario_Operativo';
      rows = this.getUnifiedCalendarEvents().map(ev => ({
        ...meta('01. Calendario Operativo'),
        Fecha: ev.date,
        Hora: ev.time || '',
        Categoria: ev.typeLabel,
        Titulo: ev.title,
        Detalle_Responsable: ev.subtitle || '',
        Estado: ev.status || 'Programado'
      }));
    }

    if (!rows.length) {
      rows = [{ ...meta(exportKey), Nota: 'Sin registros para el criterio o filtro actual' }];
    }

    if (typeof window.XLSX !== 'undefined') {
      const ws = window.XLSX.utils.json_to_sheet(rows);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
      window.XLSX.writeFile(wb, `${fileBase}.xlsx`);
      if (this.showToast) this.showToast(`Archivo ${fileBase}.xlsx generado para auditoría`, 'success');
      return;
    }

    // Fallback CSV UTF-8 BOM para apertura directa en Excel
    const headers = Object.keys(rows[0]);
    const csvEsc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      headers.map(csvEsc).join(','),
      ...rows.map(r => headers.map(h => csvEsc(r[h])).join(','))
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileBase}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (this.showToast) this.showToast(`Archivo ${fileBase}.csv (UTF-8 Excel) generado para auditoría`, 'success');
  }

  // --- 01. Gerencia & Calendario Helpers (Objetivos en Vivo + Calendario Visual) ---
  getGoalsStorageKey() {
    const u = (this.currentUser && this.currentUser.email) || 'default';
    return `easygrow_exec_goals_v1_${u}`;
  }

  getExecutiveGoals() {
    const defaultGoals = [
      { id: 'goal_sales', title: 'Meta de Ventas Mensuales (COP)', area: 'Ventas & CRM', owner: 'Dirección Comercial', target: 10000000, manualCurrent: 0, unit: 'COP', deadline: '', autoMetric: 'revenue' },
      { id: 'goal_crm_closes', title: 'Cierres Comerciales Ganados', area: 'Ventas & CRM', owner: 'Equipo Comercial', target: 10, manualCurrent: 0, unit: 'cierres', deadline: '', autoMetric: 'closedCount' },
      { id: 'goal_logistics', title: 'Guías Entregadas a Tiempo', area: 'Comercio & Logística', owner: 'Coordinador Logístico', target: 15, manualCurrent: 0, unit: 'guías', deadline: '', autoMetric: 'delivered' },
      { id: 'goal_support', title: 'Atención Omnicanal & Captación', area: 'Atención & WhatsApp', owner: 'Equipo de Atención', target: 25, manualCurrent: 0, unit: 'registros', deadline: '', autoMetric: 'engagement' }
    ];

    let stored = null;
    try {
      const raw = localStorage.getItem(this.getGoalsStorageKey());
      if (raw) stored = JSON.parse(raw);
    } catch (e) {}

    const list = Array.isArray(stored) && stored.length > 0 ? stored : defaultGoals;
    if (!stored) {
      try { localStorage.setItem(this.getGoalsStorageKey(), JSON.stringify(defaultGoals)); } catch (e) {}
    }

    const liveMap = {
      revenue: Number(this.metrics?.totalRevenue || 0),
      closedCount: Number(this.metrics?.closedCount || 0),
      delivered: (this.shipments || []).filter(s => s.status === 'ENTREGADO').length,
      engagement: (this.inboxContacts || []).length + (this.formSubmissions || []).length
    };

    return list.map(g => {
      const baseLive = g.autoMetric ? (liveMap[g.autoMetric] || 0) : 0;
      const current = baseLive + Number(g.manualCurrent || 0);
      const target = Math.max(1, Number(g.target || 1));
      const pct = Math.min(999, Math.round((current / target) * 100));
      return { ...g, current, target, pct };
    });
  }

  saveExecutiveGoalsList(list) {
    try {
      localStorage.setItem(this.getGoalsStorageKey(), JSON.stringify(list));
    } catch (e) {}
  }

  saveExecutiveGoal() {
    const title = document.getElementById('goal-title')?.value.trim();
    const area = document.getElementById('goal-area')?.value || 'Ventas & CRM';
    const owner = document.getElementById('goal-owner')?.value.trim() || 'Gerencia';
    const manualCurrent = Math.max(0, Number(document.getElementById('goal-current')?.value || 0));
    const target = Math.max(1, Number(document.getElementById('goal-target')?.value || 100));
    const unit = document.getElementById('goal-unit')?.value || 'uds';
    const deadline = document.getElementById('goal-deadline')?.value || new Date().toISOString().slice(0, 10);

    if (!title) {
      alert('Escribe un nombre claro para el objetivo.');
      return;
    }

    const currentList = this.getExecutiveGoals().map(({ current, pct, ...rest }) => rest);
    if (this.editingGoalId) {
      const idx = currentList.findIndex(g => g.id === this.editingGoalId);
      if (idx !== -1) {
        currentList[idx] = { ...currentList[idx], title, area, owner, manualCurrent, target, unit, deadline };
      }
      this.editingGoalId = null;
    } else {
      currentList.push({
        id: `goal_${Date.now()}`,
        title,
        area,
        owner,
        target,
        manualCurrent,
        unit,
        deadline,
        autoMetric: null
      });
    }

    this.saveExecutiveGoalsList(currentList);
    this.showToast('Objetivo Guardado', `"${title}" actualizado en el Dashboard Gerencial.`, 'success');
    this.openModuleFull('executive-goals', false);
  }

  startEditExecutiveGoal(goalId) {
    this.editingGoalId = goalId;
    this.openModuleFull('executive-goals', false);
    setTimeout(() => {
      document.getElementById('exec-goal-form-box')?.scrollIntoView({ behavior: 'smooth' });
    }, 180);
  }

  incrementExecutiveGoal(goalId) {
    const list = this.getExecutiveGoals().map(({ current, pct, ...rest }) => rest);
    const targetGoal = list.find(g => g.id === goalId);
    if (!targetGoal) return;
    const step = Math.max(1, Math.round(Number(targetGoal.target || 10) * 0.1));
    targetGoal.manualCurrent = Number(targetGoal.manualCurrent || 0) + step;
    this.saveExecutiveGoalsList(list);
    this.showToast('Avance Registrado', `Se sumó +${step} ${targetGoal.unit || ''} a "${targetGoal.title}".`, 'success');
    this.openModuleFull('executive-goals', false);
  }

  deleteExecutiveGoal(goalId) {
    if (!confirm('¿Eliminar este objetivo del tablero gerencial?')) return;
    const list = this.getExecutiveGoals()
      .map(({ current, pct, ...rest }) => rest)
      .filter(g => g.id !== goalId);
    this.saveExecutiveGoalsList(list);
    if (this.editingGoalId === goalId) this.editingGoalId = null;
    this.openModuleFull('executive-goals', false);
  }

  getUnifiedCalendarEvents() {
    const events = [];
    const todayIso = new Date().toISOString().slice(0, 10);

    // 1. Citas de Clientes (sincronizadas con Bandeja de Mensajes)
    (this.calendarAppointments || []).forEach(a => {
      events.push({
        type: 'cita',
        typeLabel: 'Cita Cliente',
        color: '#1FA866',
        rawId: a.id,
        date: (a.scheduled_date || todayIso).slice(0, 10),
        time: a.scheduled_time || '',
        title: a.title || 'Seguimiento',
        subtitle: `${a.contact_name || 'Cliente'} (${a.channel || 'WhatsApp'})`,
        status: 'Agendada'
      });
    });

    // 2. Fechas límite de Objetivos Gerenciales
    this.getExecutiveGoals().forEach(g => {
      if (g.deadline) {
        events.push({
          type: 'meta',
          typeLabel: 'Meta Gerencia',
          color: '#2563EB',
          date: g.deadline.slice(0, 10),
          time: '',
          title: g.title,
          subtitle: `${g.area} • Resp: ${g.owner} (${g.pct}%)`,
          status: g.pct >= 80 ? 'En meta' : 'En seguimiento'
        });
      }
    });

    // 3. Entregas de compras y guías
    (this.purchases || []).forEach(p => {
      if (p.estimated_delivery_date) {
        events.push({
          type: 'entrega',
          typeLabel: 'Entrega Pedido',
          color: '#D97706',
          date: p.estimated_delivery_date.slice(0, 10),
          time: '',
          title: `Entrega: ${p.customer_name || p.order_ref || 'Pedido'}`,
          subtitle: p.products_summary || p.order_ref || '',
          status: p.order_status || 'En curso'
        });
      }
    });
    (this.shipments || []).forEach(s => {
      const dt = (s.created_at || todayIso).slice(0, 10);
      events.push({
        type: 'entrega',
        typeLabel: 'Despacho Guía',
        color: '#D97706',
        date: dt,
        time: '',
        title: `Guía ${s.id} (${s.carrier_name || 'Envío'})`,
        subtitle: `${s.origin_city || ''} → ${s.destination_city || ''} (${s.customer_name || ''})`,
        status: s.status || 'EN TRANSITO'
      });
    });

    // 4. Publicaciones programadas en Parrilla Social
    const s5Posts = (this.station5Data && this.station5Data.socialPosts) || [];
    s5Posts.forEach(p => {
      if (p.scheduled_at) {
        const parts = p.scheduled_at.split(' ');
        events.push({
          type: 'social',
          typeLabel: 'Publicación Social',
          color: '#7C3AED',
          date: (parts[0] || todayIso).slice(0, 10),
          time: parts[1] || '',
          title: p.title || 'Publicación programada',
          subtitle: `Redes: ${(p.networks || []).join(', ')}`,
          status: p.status || 'programada'
        });
      }
    });

    return events.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }

  buildCalendarGridCells() {
    const pad = (n) => String(n).padStart(2, '0');
    const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const monthsEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const now = new Date();
    if (this.calendarViewMode === 'week') {
      const base = this.selectedCalendarDate ? new Date(`${this.selectedCalendarDate}T12:00:00`) : new Date(now);
      base.setDate(base.getDate() + (Number(this.calendarMonthOffset || 0) * 7));
      const dayOfWeek = (base.getDay() + 6) % 7; // 0 = Lunes
      const monday = new Date(base);
      monday.setDate(base.getDate() - dayOfWeek);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const cells = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        cells.push({ iso: toIso(d), dayNum: d.getDate(), inCurrentMonth: true });
      }
      return {
        heading: `Semana del ${monday.getDate()} de ${monthsEs[monday.getMonth()]} al ${sunday.getDate()} de ${monthsEs[sunday.getMonth()]} ${sunday.getFullYear()}`,
        cells
      };
    }

    const firstOfMonth = new Date(now.getFullYear(), now.getMonth() + Number(this.calendarMonthOffset || 0), 1);
    const targetMonth = firstOfMonth.getMonth();
    const targetYear = firstOfMonth.getFullYear();
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // Lunes = 0
    const gridStart = new Date(targetYear, targetMonth, 1 - startOffset);

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push({
        iso: toIso(d),
        dayNum: d.getDate(),
        inCurrentMonth: d.getMonth() === targetMonth
      });
    }
    return {
      heading: `${monthsEs[targetMonth]} ${targetYear}`,
      cells
    };
  }

  selectCalendarDay(dateIso) {
    this.selectedCalendarDate = dateIso;
    this.openModuleFull('operational-calendar', false);
  }

  changeCalendarOffset(delta) {
    if (delta === 0) {
      this.calendarMonthOffset = 0;
      this.selectedCalendarDate = new Date().toISOString().slice(0, 10);
    } else {
      this.calendarMonthOffset = Number(this.calendarMonthOffset || 0) + delta;
    }
    this.openModuleFull('operational-calendar', false);
  }

  setCalendarViewMode(mode) {
    this.calendarViewMode = mode === 'week' ? 'week' : 'month';
    this.calendarMonthOffset = 0;
    this.openModuleFull('operational-calendar', false);
  }

  setCalendarCategoryFilter(cat) {
    this.calendarCategoryFilter = cat || 'ALL';
    this.openModuleFull('operational-calendar', false);
  }

  // --- Estación 01 Helpers: Motor Transportadoras, Carrito Multi-Origen, Excel IA y Evaluaciones ---
  escapeHtml(val) {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  evaluateCarriersForRoute(originCity, destCity, priority = this.carrierPriority) {
    const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isLocal = norm(originCity) && norm(originCity) === norm(destCity);

    const baseCarriers = [
      {
        name: 'Servientrega',
        coverage: isLocal ? 99 : 98,
        cost: isLocal ? 8900 : 12400,
        hours: isLocal ? 18 : 30,
        estimatedTime: isLocal ? '12-24 hrs' : '24-36 hrs'
      },
      {
        name: 'Interrapidísimo',
        coverage: 99,
        cost: isLocal ? 9400 : 13200,
        hours: isLocal ? 20 : 42,
        estimatedTime: isLocal ? '18-24 hrs' : '36-48 hrs'
      },
      {
        name: 'Coordinadora',
        coverage: isLocal ? 98 : 95,
        cost: isLocal ? 7800 : 10600,
        hours: isLocal ? 22 : 40,
        estimatedTime: isLocal ? '18-24 hrs' : '36-48 hrs'
      },
      {
        name: 'Envía',
        coverage: isLocal ? 97 : 93,
        cost: isLocal ? 9600 : 13900,
        hours: isLocal ? 12 : 22,
        estimatedTime: isLocal ? '8-12 hrs' : '18-24 hrs'
      }
    ];

    const scoreFn = (c) => {
      if (priority === 'coverage') return c.coverage * 10 - c.cost * 0.0001;
      if (priority === 'cheapest') return -c.cost + c.coverage * 0.5;
      if (priority === 'fastest') return -c.hours * 100 + c.coverage;
      // balanced: cobertura (45%), tiempo (30%), costo (25%)
      return (c.coverage * 2.2) - (c.hours * 1.4) - (c.cost / 650);
    };

    const sorted = [...baseCarriers].sort((a, b) => scoreFn(b) - scoreFn(a));
    return {
      recommended: sorted[0],
      carriers: sorted,
      isLocal
    };
  }

  getCartGroups() {
    const groupsMap = new Map();
    this.cart.forEach(entry => {
      const prod = this.products.find(p => p.id === entry.productId) || entry.snapshot;
      if (!prod) return;
      const originType = prod.origin_type || 'dropi';
      const originCity = prod.origin_city || 'Medellín';
      const supplier = prod.supplier || (originType === 'propio' ? 'Mi Bodega Propia' : 'Dropi Proveedor');
      const originKey = `${originType}__${supplier}__${originCity}`;

      if (!groupsMap.has(originKey)) {
        const evalResult = this.evaluateCarriersForRoute(originCity, this.cartDestinationCity, this.carrierPriority);
        const overrideName = this.carrierOverrides[originKey];
        const chosenCarrier = evalResult.carriers.find(c => c.name === overrideName) || evalResult.recommended;

        groupsMap.set(originKey, {
          originKey,
          originType,
          originCity,
          supplier,
          originLabel: `${supplier} (${originCity})`,
          items: [],
          subtotalProducts: 0,
          carrierOptions: evalResult.carriers,
          carrier: chosenCarrier
        });
      }

      const grp = groupsMap.get(originKey);
      const unitPrice = Number(prod.suggested_price) || 0;
      grp.items.push({ product: prod, qty: entry.qty, lineTotal: unitPrice * entry.qty });
      grp.subtotalProducts += unitPrice * entry.qty;
    });

    return Array.from(groupsMap.values());
  }

  renderMarketplaceProductsCards() {
    const isAdmin = this.currentUser && this.currentUser.role === 'admin';
    const currentUserId = this.currentUser ? (this.currentUser.tenantId || this.currentUser.userId || this.currentUser.id) : null;

    let list = [...this.products];
    if (this.marketOriginFilter !== 'all') {
      list = list.filter(p => (p.origin_type || 'dropi') === this.marketOriginFilter);
    }
    if (this.marketCategoryFilter !== 'all') {
      list = list.filter(p => p.category === this.marketCategoryFilter);
    }

    if (list.length === 0) {
      return `
        <div style="grid-column: 1 / -1; padding: 3rem; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-subtle); background: var(--bg-dark); border-radius: 12px;">
          No hay productos publicados para este filtro. Puedes publicar uno o importar tu inventario desde Excel con IA.
        </div>
      `;
    }

    return list.map(p => {
      const originType = p.origin_type || 'dropi';
      const originCity = p.origin_city || 'Medellín';
      const canEdit = isAdmin || (originType === 'propio' && p.tenant_id === currentUserId);
      const margin = p.suggested_price > 0 ? (((p.suggested_price - p.cost_dropi) / p.suggested_price) * 100).toFixed(1) : 0;
      const punct = Number(p.supplier_punctuality || 4.9).toFixed(1);
      const cond = Number(p.supplier_condition || 4.8).toFixed(1);
      const specQ = Number(p.product_spec_quality || 4.9).toFixed(1);
      const distAlliances = p.distribution_alliances || 'Alianza Distribución: Servientrega • Coordinadora • Interrapidísimo';

      const productSvg = p.id === 'prod_12346'
        ? `<svg width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="#111111" stroke-width="2.2"><rect x="18" y="54" width="60" height="24" rx="5" fill="#FFFFFF"/><line x1="28" y1="24" x2="28" y2="54"/><path d="M22 24c0-7 12-7 12 0"/><line x1="44" y1="18" x2="44" y2="54"/><path d="M37 18c0-8 14-8 14 0"/><line x1="60" y1="26" x2="60" y2="54"/><circle cx="70" cy="36" r="9" fill="#1FA866" fill-opacity="0.18" stroke="#1FA866"/></svg>`
        : (p.id === 'prod_12347'
          ? `<svg width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="#111111" stroke-width="2.2"><line x1="16" y1="20" x2="80" y2="20" stroke-width="3"/><line x1="24" y1="20" x2="24" y2="70"/><line x1="40" y1="20" x2="40" y2="78"/><line x1="56" y1="20" x2="56" y2="66"/><line x1="72" y1="20" x2="72" y2="74"/><circle cx="24" cy="44" r="4" fill="#1FA866" stroke="none"/><circle cx="40" cy="52" r="4.5" fill="#111111"/><circle cx="56" cy="40" r="4" fill="#1FA866" stroke="none"/><circle cx="72" cy="56" r="4.5" fill="#1FA866" stroke="none"/><circle cx="40" cy="76" r="4" fill="#1FA866" stroke="none"/></svg>`
          : `<svg width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="#111111" stroke-width="2.2"><rect x="24" y="14" width="48" height="68" rx="9" fill="#FFFFFF"/><rect x="34" y="24" width="28" height="36" rx="5" fill="#1FA866" fill-opacity="0.12" stroke="#1FA866"/><circle cx="48" cy="42" r="9" stroke="#1FA866"/><path d="M48 37v10M43 42h10" stroke="#1FA866"/><rect x="40" y="68" width="16" height="4" rx="2" fill="#111111" stroke="none"/></svg>`);

      return `
        <article class="temu-rea-card">
          <div class="temu-card-visual">
            ${productSvg}
            <span class="temu-card-badge-tl" style="background: ${originType === 'propio' ? '#111111' : '#1FA866'};">
              ${originType === 'propio' ? 'Inventario Propio' : 'Dropi'} • ${this.escapeHtml(originCity)}
            </span>
            <span class="temu-card-badge-bl">
              R: Recurso • ${this.escapeHtml(p.sku)}
            </span>
            ${canEdit ? `
              <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 0.3rem;">
                <button onclick="window.consoleApp.openAdminProdModal('${p.id}')" title="Editar Producto y Especificaciones" style="background: #FFFFFF; border: 1px solid #111111; color: #111111; font-weight: 700; border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 0.7rem;">
                  ✏️
                </button>
                <button onclick="window.consoleApp.deleteAdminProduct('${p.id}')" title="Eliminar Producto" style="background: #FFFFFF; border: 1px solid var(--data-crimson); color: var(--data-crimson); border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 0.7rem;">
                  🗑️
                </button>
              </div>
            ` : ''}
          </div>

          <div class="temu-card-body">
            <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted);">
              ${this.escapeHtml(p.category || 'General')}
            </div>
            <h3 class="temu-card-title">${this.escapeHtml(p.name)}</h3>
            <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.35;">
              ${this.escapeHtml(p.specifications || p.description || 'Estándar verificado')}
            </div>

            <!-- Precio Estándar + Botón Ovalado de Carrito (Estilo Temu) -->
            <div class="temu-price-cart-row">
              <div>
                <div style="font-size: 0.66rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Precio estándar</div>
                <div class="temu-standard-price">$${(p.suggested_price || 0).toLocaleString()} <span style="font-size: 0.72rem; font-weight: 700; color: #525860;">COP</span></div>
                <div class="temu-price-sub">Base: $${(p.cost_dropi || 0).toLocaleString()} • Margen ${margin}% • ${p.stock} uds</div>
              </div>
              <button
                type="button"
                class="temu-cart-oval-btn"
                onclick="window.consoleApp.addToCart('${p.id}')"
                title="E: Evento — Agregar al Carrito Multi-Origen"
                aria-label="Agregar ${this.escapeHtml(p.name)} al carrito"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <circle cx="9" cy="20" r="1.5"/>
                  <circle cx="17" cy="20" r="1.5"/>
                  <path d="M3 4h2l2.4 10.5a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.7L20.5 7H7"/>
                  <path d="M13 10.5h4M15 8.5v4"/>
                </svg>
              </button>
            </div>

            <!-- Estrellas y Evaluación Separada Proveedor vs Especificaciones -->
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.72rem; color: #111111; background: #F8F8F6; padding: 0.38rem 0.55rem; border-radius: 6px;">
              <span>★★★★★ <b>${specQ}</b> Especif.</span>
              <span style="color: #525860;">Prov. ${punct}★ / Rec. ${cond}★</span>
            </div>

            <!-- Alianzas para la Distribución (Agente REA) -->
            <div class="temu-alliance-footer">
              <div><strong style="color: #1FA866;">A • Agente Origen:</strong> ${this.escapeHtml(p.supplier)}</div>
              <div style="color: #525860; margin-top: 0.15rem;">${this.escapeHtml(distAlliances)}</div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  renderMultiOriginCartSection() {
    const groups = this.getCartGroups();
    const totalProducts = groups.reduce((acc, g) => acc + g.subtotalProducts, 0);
    const totalShipping = groups.reduce((acc, g) => acc + g.carrier.cost, 0);
    const grandTotal = totalProducts + totalShipping;
    const totalItemsQty = this.cart.reduce((acc, i) => acc + i.qty, 0);

    return `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem;">
        <div>
          <span class="hero-tag" style="font-size: 0.7rem;">Vista Única Agrupada por Origen</span>
          <h3 style="color: var(--text-main); font-size: 1.25rem;">🛒 Carrito Multi-Origen (${totalItemsQty} ítem${totalItemsQty === 1 ? '' : 's'} • ${groups.length} envío${groups.length === 1 ? '' : 's'})</h3>
          <p style="color: var(--text-muted); font-size: 0.84rem;">Los productos se agrupan automáticamente por bodega/ciudad de origen con su transportadora (cobertura, costo y tiempo), total combinado y 1 guía por envío tras la compra.</p>
        </div>
        <div style="display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center;">
          <input type="text" id="cart-customer-name" class="form-control" value="${this.escapeHtml(this.cartCustomerName || '')}" placeholder="Nombre del cliente..." oninput="window.consoleApp.cartCustomerName = this.value" style="width: 190px; padding: 0.45rem 0.75rem; font-size: 0.82rem;">
          <select id="cart-dest-city" class="form-control" onchange="window.consoleApp.onCartDestChange(this.value)" style="width: auto; padding: 0.45rem 0.75rem; font-size: 0.82rem;">
            ${['Bogotá D.C.', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Cartagena'].map(c => `<option value="${c}" ${this.cartDestinationCity === c ? 'selected' : ''}>Destino: ${c}</option>`).join('')}
          </select>
          <select id="cart-carrier-priority" class="form-control" onchange="window.consoleApp.onCartPriorityChange(this.value)" style="width: auto; padding: 0.45rem 0.75rem; font-size: 0.82rem;">
            <option value="balanced" ${this.carrierPriority === 'balanced' ? 'selected' : ''}>Transportadora: Equilibrio Óptimo</option>
            <option value="coverage" ${this.carrierPriority === 'coverage' ? 'selected' : ''}>Priorizar Mayor Cobertura</option>
            <option value="cheapest" ${this.carrierPriority === 'cheapest' ? 'selected' : ''}>Priorizar Menor Costo</option>
            <option value="fastest" ${this.carrierPriority === 'fastest' ? 'selected' : ''}>Priorizar Menor Tiempo</option>
          </select>
        </div>
      </div>

      ${this.lastCheckoutSummary ? `
        <div style="background: rgba(31, 168, 102, 0.08); border: 1.5px solid var(--accent-1); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="font-size: 0.88rem; color: var(--text-main);">
            <b>✓ Compra ${this.lastCheckoutSummary.checkoutGroupId} confirmada:</b> Se generaron <b>${this.lastCheckoutSummary.shipments.length} guía(s) independiente(s)</b> (${this.lastCheckoutSummary.shipments.map(s => s.id).join(', ')}) por un total combinado de <b>$${this.lastCheckoutSummary.grandTotal.toLocaleString()} COP</b>.
          </div>
          <button class="btn-primary-large" onclick="window.consoleApp.openModuleFull('shipping-tracker', true)" style="font-size: 0.84rem; padding: 0.5rem 1rem;">
            Ver Guías, Seguimiento y Avisos →
          </button>
        </div>
      ` : ''}

      ${groups.length === 0 ? `
        <div style="padding: 2rem; text-align: center; background: #F8F8F6; border: 1px dashed var(--border-subtle); border-radius: 8px; color: var(--text-muted); font-size: 0.88rem;">
          Agrega productos (por ejemplo, uno de Dropi Medellín y otro de Inventario Propio o Cali) con <b>"+ Agregar al Carrito Multi-Origen"</b> para ver cómo se agrupan por origen en esta sola vista.
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${groups.map((grp, idx) => `
            <div style="background: #F8F8F6; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 1rem 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.55rem;">
                <div>
                  <span style="font-size: 0.72rem; font-weight: 800; color: var(--accent-1); text-transform: uppercase;">Envío #${idx + 1} (Genera 1 Guía Propia)</span>
                  <div style="font-size: 0.96rem; font-weight: 800; color: var(--text-main);">
                    ${grp.originType === 'propio' ? '🏢 Inventario Propio' : '📦 Dropi'}: ${this.escapeHtml(grp.originLabel)} → ${this.escapeHtml(this.cartDestinationCity)}
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                  <select class="form-control" onchange="window.consoleApp.overrideGroupCarrier('${this.escapeHtml(grp.originKey)}', this.value)" style="width: auto; padding: 0.35rem 0.65rem; font-size: 0.78rem; background: #FFFFFF;">
                    ${grp.carrierOptions.map(co => `<option value="${co.name}" ${grp.carrier.name === co.name ? 'selected' : ''}>${co.name} (${co.coverage}% • $${co.cost.toLocaleString()} • ${co.estimatedTime})</option>`).join('')}
                  </select>
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.45rem; margin-bottom: 0.75rem;">
                ${grp.items.map(it => `
                  <div style="display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.84rem;">
                    <div>
                      <strong style="color: var(--text-main);">${this.escapeHtml(it.product.name)}</strong>
                      <span style="color: var(--text-dim); font-size: 0.75rem;"> ($${Number(it.product.suggested_price).toLocaleString()} c/u)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <button type="button" class="btn-secondary" onclick="window.consoleApp.updateCartQty('${it.product.id}', -1)" style="padding: 2px 8px; font-size: 0.78rem;">-</button>
                      <b style="min-width: 18px; text-align: center;">${it.qty}</b>
                      <button type="button" class="btn-secondary" onclick="window.consoleApp.updateCartQty('${it.product.id}', 1)" style="padding: 2px 8px; font-size: 0.78rem;">+</button>
                      <strong style="min-width: 95px; text-align: right; color: var(--text-main); font-family: monospace;">$${it.lineTotal.toLocaleString()}</strong>
                    </div>
                  </div>
                `).join('')}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; font-size: 0.8rem; color: var(--text-muted);">
                <span>Transportadora asignada: <b style="color: var(--text-main);">${grp.carrier.name}</b> • Cobertura <b style="color: var(--accent-1);">${grp.carrier.coverage}%</b> • Tiempo estimado <b style="color: var(--text-main);">${grp.carrier.estimatedTime}</b></span>
                <span>Subtotal productos: <b>$${grp.subtotalProducts.toLocaleString()}</b> + Flete envío #${idx + 1}: <b style="color: var(--accent-1);">$${grp.carrier.cost.toLocaleString()} COP</b></span>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="margin-top: 1.25rem; background: #111111; color: #FFFFFF; border-radius: 8px; padding: 1.15rem 1.4rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; gap: 1.75rem; flex-wrap: wrap; font-size: 0.85rem;">
            <div>
              <div style="opacity: 0.7; font-size: 0.72rem;">Subtotal Productos</div>
              <strong style="font-family: monospace; font-size: 1rem;">$${totalProducts.toLocaleString()} COP</strong>
            </div>
            <div>
              <div style="opacity: 0.7; font-size: 0.72rem;">Total Fletes (${groups.length} envío${groups.length === 1 ? '' : 's'})</div>
              <strong style="font-family: monospace; font-size: 1rem;">$${totalShipping.toLocaleString()} COP</strong>
            </div>
            <div>
              <div style="color: var(--accent-1-bright); font-size: 0.72rem; font-weight: 700;">TOTAL COMBINADO</div>
              <strong style="font-family: monospace; font-size: 1.2rem; color: var(--accent-1-bright);">$${grandTotal.toLocaleString()} COP</strong>
            </div>
          </div>
          <button type="button" id="btn-confirm-multi-checkout" onclick="window.consoleApp.executeMultiOriginCheckout()" style="background: var(--accent-1); color: #FFFFFF; border: none; border-radius: 6px; padding: 0.75rem 1.35rem; font-weight: 800; font-size: 0.9rem; cursor: pointer;">
            ✓ Comprar y Generar ${groups.length} Guía${groups.length === 1 ? '' : 's'}
          </button>
        </div>
      `}
    `;
  }

  refreshCartSection() {
    const qty = this.cart.reduce((s, i) => s + i.qty, 0);
    const cartBox = document.getElementById('multi-origin-cart-section');
    if (cartBox) cartBox.innerHTML = this.renderMultiOriginCartSection();
    const cartCountEl = document.getElementById('market-cart-count');
    if (cartCountEl) cartCountEl.textContent = String(qty);
    const tabBadgeEl = document.getElementById('erp-tab-badge-marketplace-carrito');
    if (tabBadgeEl) tabBadgeEl.textContent = String(qty);
  }

  addToCart(productId) {
    const prod = this.products.find(p => p.id === productId || p.dropi_product_id === productId);
    if (!prod) return;
    this.lastCheckoutSummary = null;
    const existing = this.cart.find(c => c.productId === prod.id);
    if (existing) {
      existing.qty += 1;
    } else {
      this.cart.push({ productId: prod.id, qty: 1, snapshot: prod });
    }
    this.refreshCartSection();
    this.showToast('🛒 Carrito Multi-Origen', `"${prod.name}" agregado (${prod.origin_type === 'propio' ? 'Inventario Propio' : 'Dropi'} • ${prod.origin_city || 'Medellín'}).`, 'success');
  }

  updateCartQty(productId, delta) {
    const idx = this.cart.findIndex(c => c.productId === productId);
    if (idx === -1) return;
    this.cart[idx].qty += delta;
    if (this.cart[idx].qty <= 0) {
      this.cart.splice(idx, 1);
    }
    this.refreshCartSection();
  }

  onCartDestChange(city) {
    this.cartDestinationCity = city;
    this.refreshCartSection();
  }

  onCartPriorityChange(priority) {
    this.carrierPriority = priority;
    this.carrierOverrides = {};
    this.refreshCartSection();
  }

  overrideGroupCarrier(originKey, carrierName) {
    this.carrierOverrides[originKey] = carrierName;
    this.refreshCartSection();
  }

  async executeMultiOriginCheckout() {
    const groups = this.getCartGroups();
    if (groups.length === 0) return;

    const customerName = document.getElementById('cart-customer-name')?.value.trim() || this.cartCustomerName || 'Cliente Marketplace';
    const btn = document.getElementById('btn-confirm-multi-checkout');
    if (btn) {
      btn.disabled = true;
      btn.textContent = `Generando ${groups.length} guía(s)...`;
    }

    try {
      const attrCtx = window.EasyGrowAttribution ? window.EasyGrowAttribution.getAttributionContext() : null;
      const orderIdempotencyKey = 'PED-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const payload = {
        customerName,
        destinationCity: this.cartDestinationCity,
        orderIdempotencyKey,
        attributionContext: attrCtx,
        groups: groups.map(g => ({
          originLabel: g.originLabel,
          originType: g.originType,
          originCity: g.originCity,
          carrierName: g.carrier.name,
          carrierCoverage: g.carrier.coverage,
          shippingCost: g.carrier.cost,
          estimatedTime: g.carrier.estimatedTime,
          items: g.items.map(it => ({ productId: it.product.id, qty: it.qty }))
        }))
      };

      const res = await fetch('/api/shipping/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        this.cart = [];
        this.carrierOverrides = {};
        this.lastCheckoutSummary = data;
        await this.loadProducts();
        await this.loadShipments();
        await this.loadStation5Workspace();
        await this.loadMetrics();
        await window.EasyGrowCRM.syncWithServer(false);
        this.renderMarketplaceCatalog();
        this.refreshCartSection();
        this.showToast('✓ Compra & Guías Generadas', `${data.shipments.length} guía(s) independiente(s) creadas: ${data.shipments.map(s => s.id).join(', ')}.`, 'success');
      } else {
        alert(data.error || 'No se pudo completar la compra.');
      }
    } catch (e) {
      alert('Error de conexión procesando el checkout multi-origen.');
    } finally {
      if (btn) {
        btn.disabled = false;
      }
    }
  }

  filterMarketOrigin(origin) {
    this.marketOriginFilter = origin;
    if (origin !== 'all') this.marketCategoryFilter = 'all';
    document.querySelectorAll('#marketplace-category-tabs .temu-pill').forEach(btn => {
      const bOrig = btn.getAttribute('data-orig');
      const bCat = btn.getAttribute('data-cat');
      const isRec = origin === 'all' && this.marketCategoryFilter === 'all' && bCat === 'all';
      btn.classList.toggle('active', isRec || (bOrig && bOrig === origin));
    });
    this.renderMarketplaceCatalog();
  }

  filterMarketCategory(category) {
    this.marketCategoryFilter = category;
    if (category !== 'all') this.marketOriginFilter = 'all';
    document.querySelectorAll('#marketplace-category-tabs .temu-pill').forEach(btn => {
      const bCat = btn.getAttribute('data-cat');
      btn.classList.toggle('active', Boolean(bCat) && bCat === category);
    });
    this.renderMarketplaceCatalog();
  }

  renderMarketplaceCatalog() {
    const grid = document.getElementById('marketplace-products-grid');
    if (grid) grid.innerHTML = this.renderMarketplaceProductsCards();
  }

  prepareOrder(id) {
    this.addToCart(id);
    this.setModuleSubTab('marketplace', 'carrito');
  }

  // --- Seguimiento, Transportadoras, Avisos y Evaluaciones (Estación 01) ---
  setCarrierSimRoute(field, value) {
    if (field === 'origin') this.simOriginCity = value;
    else if (field === 'dest') this.simDestCity = value;
    else if (field === 'priority') this.carrierPriority = value;
    this.openModuleFull('shipping-tracker', false);
  }

  async advanceShipment(shipmentId) {
    try {
      const res = await fetch(`/api/shipping/shipments/${shipmentId}/advance`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.shipment) {
        await this.loadShipments();
        const latestNotice = data.shipment.notifications && data.shipment.notifications[0];
        this.showToast(latestNotice ? `🔔 ${latestNotice.title}` : '✓ Seguimiento actualizado', latestNotice ? latestNotice.message : 'Estado de guía actualizado.', 'success');
        this.openModuleFull('shipping-tracker', false);
      }
    } catch (e) {
      alert('Error al actualizar seguimiento.');
    }
  }

  openShipmentEvalModal(shipmentId) {
    const shipment = this.shipments.find(s => s.id === shipmentId);
    if (!shipment) return;
    const backdrop = document.getElementById('shipment-eval-modal-backdrop');
    if (!backdrop) return;
    backdrop.style.display = 'flex';

    document.getElementById('eval-shipment-id').value = shipment.id;
    document.getElementById('eval-modal-guide-meta').textContent = `Guía ${shipment.id} • Origen: ${shipment.origin_label} → ${shipment.destination_city}`;
    const specsList = (shipment.items || []).map(it => `${it.name}: ${it.specifications || 'Estándar'}`).join(' | ');
    document.getElementById('eval-product-specs-preview').textContent = `Especificaciones base a verificar: ${specsList}`;

    if (shipment.eval) {
      document.getElementById('eval-punctuality').value = String(shipment.eval.punctuality || 5);
      document.getElementById('eval-condition').value = String(shipment.eval.receivedCondition || 5);
      document.getElementById('eval-spec-quality').value = String(shipment.eval.specQuality || 5);
      document.getElementById('eval-notes').value = shipment.eval.notes || '';
    } else {
      document.getElementById('eval-punctuality').value = '5';
      document.getElementById('eval-condition').value = '5';
      document.getElementById('eval-spec-quality').value = '5';
      document.getElementById('eval-notes').value = '';
    }
  }

  closeShipmentEvalModal() {
    const backdrop = document.getElementById('shipment-eval-modal-backdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  async submitShipmentEvaluation(e) {
    e.preventDefault();
    const shipmentId = document.getElementById('eval-shipment-id')?.value;
    const evalData = {
      punctuality: Number(document.getElementById('eval-punctuality')?.value || 5),
      receivedCondition: Number(document.getElementById('eval-condition')?.value || 5),
      specQuality: Number(document.getElementById('eval-spec-quality')?.value || 5),
      notes: document.getElementById('eval-notes')?.value || ''
    };

    try {
      const res = await fetch(`/api/shipping/shipments/${shipmentId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evalData)
      });
      const data = await res.json();
      if (data.success) {
        this.closeShipmentEvalModal();
        await this.loadProducts();
        await this.loadShipments();
        this.showToast('⭐ Evaluación Guardada', 'Puntajes de proveedor (puntualidad/estado) y calidad (especificaciones) actualizados.', 'success');
        this.openModuleFull('shipping-tracker', false);
      } else {
        alert(data.error || 'Error guardando evaluación.');
      }
    } catch (err) {
      alert('Error de conexión al guardar evaluación.');
    }
  }

  // --- Hybrid Product Publish / Edit Modal Management ---
  openAdminProdModal(prodId = null) {
    if (!this.currentUser) return;
    const isAdmin = this.currentUser.role === 'admin';

    const backdrop = document.getElementById('admin-prod-modal-backdrop');
    if (!backdrop) return;
    backdrop.style.display = 'flex';

    const titleElem = document.getElementById('admin-prod-modal-title');
    const originTypeSel = document.getElementById('admin-prod-origin-type');
    const originCitySel = document.getElementById('admin-prod-origin-city');
    const idInput = document.getElementById('admin-prod-id');
    const nameInput = document.getElementById('admin-prod-name');
    const skuInput = document.getElementById('admin-prod-sku');
    const costInput = document.getElementById('admin-prod-cost');
    const priceInput = document.getElementById('admin-prod-price');
    const stockInput = document.getElementById('admin-prod-stock');
    const catInput = document.getElementById('admin-prod-category');
    const suppInput = document.getElementById('admin-prod-supplier');
    const specsInput = document.getElementById('admin-prod-specs');
    const descInput = document.getElementById('admin-prod-desc');

    if (originTypeSel) {
      const dropiOpt = originTypeSel.querySelector('option[value="dropi"]');
      if (dropiOpt) dropiOpt.disabled = !isAdmin;
      originTypeSel.value = isAdmin ? 'dropi' : 'propio';
    }

    if (prodId) {
      const prod = this.products.find(p => p.id === prodId || p.dropi_product_id === prodId);
      if (prod) {
        if (titleElem) titleElem.textContent = 'Editar Producto (' + (prod.origin_type === 'propio' ? 'Inventario Propio' : 'Dropi') + ')';
        if (idInput) idInput.value = prod.id;
        if (originTypeSel) originTypeSel.value = prod.origin_type || 'dropi';
        if (originCitySel) originCitySel.value = prod.origin_city || 'Medellín';
        if (nameInput) nameInput.value = prod.name;
        if (skuInput) skuInput.value = prod.sku || '';
        if (costInput) costInput.value = prod.cost_dropi;
        if (priceInput) priceInput.value = prod.suggested_price;
        if (stockInput) stockInput.value = prod.stock;
        if (catInput) catInput.value = prod.category;
        if (suppInput) suppInput.value = prod.supplier;
        if (specsInput) specsInput.value = prod.specifications || '';
        if (descInput) descInput.value = prod.description || '';
        return;
      }
    }

    if (titleElem) titleElem.textContent = isAdmin ? 'Publicar Producto (Dropi / Inventario Propio)' : 'Publicar Producto en Inventario Propio';
    if (idInput) idInput.value = '';
    if (originCitySel) originCitySel.value = isAdmin ? 'Medellín' : 'Bogotá D.C.';
    if (nameInput) nameInput.value = '';
    if (skuInput) skuInput.value = '';
    if (costInput) costInput.value = '';
    if (priceInput) priceInput.value = '';
    if (stockInput) stockInput.value = '50';
    if (catInput) catInput.value = 'Tecnología';
    if (suppInput) suppInput.value = isAdmin ? 'Dropi Tech Hub Colombia' : (this.currentUser.companyName || 'Mi Bodega Propia');
    if (specsInput) specsInput.value = '';
    if (descInput) descInput.value = '';
  }

  closeAdminProdModal() {
    const backdrop = document.getElementById('admin-prod-modal-backdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  async submitAdminProduct(e) {
    e.preventDefault();
    const id = document.getElementById('admin-prod-id')?.value;
    const productData = {
      origin_type: document.getElementById('admin-prod-origin-type')?.value || 'propio',
      origin_city: document.getElementById('admin-prod-origin-city')?.value || 'Medellín',
      name: document.getElementById('admin-prod-name')?.value,
      sku: document.getElementById('admin-prod-sku')?.value,
      cost_dropi: Number(document.getElementById('admin-prod-cost')?.value),
      suggested_price: Number(document.getElementById('admin-prod-price')?.value),
      stock: Number(document.getElementById('admin-prod-stock')?.value),
      category: document.getElementById('admin-prod-category')?.value,
      supplier: document.getElementById('admin-prod-supplier')?.value,
      specifications: document.getElementById('admin-prod-specs')?.value,
      description: document.getElementById('admin-prod-desc')?.value
    };

    try {
      const url = id ? `/api/marketplace/products/${id}` : '/api/marketplace/products';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      const data = await res.json();
      if (data.success) {
        this.closeAdminProdModal();
        this.showToast('✓ Catálogo Estación 01', id ? 'Producto actualizado.' : `Publicado en ${productData.origin_type === 'dropi' ? 'Red Dropi' : 'Inventario Propio'}.`, 'success');
        await this.loadProducts();
        if (this.activeModuleId === 'marketplace') {
          this.openModuleFull('marketplace', false);
        }
      } else {
        alert(data.error || 'Error al guardar el producto.');
      }
    } catch (err) {
      alert('Error de conexión con el servidor.');
    }
  }

  async deleteAdminProduct(prodId) {
    if (!confirm('¿Estás seguro de eliminar este producto del catálogo?')) return;
    try {
      const res = await fetch(`/api/marketplace/products/${prodId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.showToast('🗑️ Eliminado', 'Producto removido del catálogo.', 'warn');
        await this.loadProducts();
        if (this.activeModuleId === 'marketplace') {
          this.openModuleFull('marketplace', false);
        }
      } else {
        alert(data.error || 'No tienes permisos para eliminar este producto.');
      }
    } catch (e) {}
  }

  // --- Asistente IA: Importación de Inventario Excel Habitual -> Plantilla EasyGrow ---
  openInventoryExcelModal() {
    const backdrop = document.getElementById('inventory-excel-modal-backdrop');
    if (!backdrop) return;
    backdrop.style.display = 'flex';
  }

  closeInventoryExcelModal() {
    const backdrop = document.getElementById('inventory-excel-modal-backdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  loadSampleInventoryExcel() {
    const sampleRows = [
      {
        Ref_Articulo: 'PROP-MOCH-01',
        Producto_Comercial: 'Mochila Antirrobo USB Impermeable',
        Modalidad_Origen: 'Propio',
        Bodega_Ciudad: 'Bogota',
        Proveedor_Bodega: 'Bodega Propia Chapinero',
        Costo_Unitario: '$48.000',
        PVP_Sugerido: '$119.000',
        Unidades_Disp: 28,
        Categoria_Tienda: 'Accesorios',
        Ficha_Tecnica: 'Tela Oxford impermeable • Puerto carga USB • Capacidad 25L • Cierre oculto'
      },
      {
        Ref_Articulo: 'PROP-ARO-02',
        Producto_Comercial: 'Aro de Luz LED Profesional 14"',
        Modalidad_Origen: 'Propio',
        Bodega_Ciudad: 'Cali',
        Proveedor_Bodega: 'Estudio Centro Cali',
        Costo_Unitario: '$42.000',
        PVP_Sugerido: '$94.900',
        Unidades_Disp: 15,
        Categoria_Tienda: 'Tecnología',
        Ficha_Tecnica: 'Diámetro 36cm • 3 tonos 3000K-6500K • Trípode aluminio 2.1m • Control Bluetooth'
      }
    ];
    this.processInventoryExcelDataset(Object.keys(sampleRows[0]), sampleRows);
    this.showToast('🤖 IA EasyGrow', 'Excel habitual analizado. Revisa la adaptación sugerida antes de confirmar.', 'info');
  }

  async validateAndInspectUploadFile(file) {
    if (!file) return { safe: false, error: 'No se seleccionó archivo.' };
    const name = String(file.name || '').trim();
    const maxBytes = 5 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxBytes) {
      return { safe: false, error: 'El archivo debe pesar entre 1 byte y máximo 5 MB.' };
    }
    const baseWithoutExt = name.replace(/\.[^.]+$/, '');
    const dangerousRe = /\.(exe|dll|bat|cmd|ps1|vbs|vbe|js|jse|wsf|wsh|msi|scr|pif|com|hta|jar|sh|php|py|xlsm|xlsb|docm|pptm)$/i;
    if (dangerousRe.test(name) || dangerousRe.test(baseWithoutExt)) {
      return { safe: false, error: 'Archivo bloqueado por filtro anti-troyanos: extensión ejecutable o con macros no permitida.' };
    }
    if (!/\.(xlsx|xls|csv)$/i.test(name)) {
      return { safe: false, error: 'Solo se permiten archivos .xlsx, .xls o .csv verificados.' };
    }

    const arrayBuf = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64Data = btoa(binary);

    const res = await fetch('/api/security/inspect-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: name, size: file.size, base64Data })
    });
    const data = await res.json();
    if (!res.ok || !data.safe) {
      return { safe: false, error: data.error || 'Archivo rechazado por el filtro de seguridad.' };
    }
    return { safe: true, sha256: data.sha256 };
  }

  async onInventoryFileSelected(event) {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;

    const guard = await this.validateAndInspectUploadFile(file);
    if (!guard.safe) {
      input.value = '';
      this.showToast('🛡️ Archivo Bloqueado', guard.error, 'warn');
      alert(`SEGURIDAD EASYGROW:\n${guard.error}`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let headers = [];
        let rows = [];
        if (window.XLSX && !file.name.toLowerCase().endsWith('.csv')) {
          const workbook = window.XLSX.read(e.target.result, { type: 'binary' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
          if (rows.length > 0) headers = Object.keys(rows[0]);
        } else {
          const lines = String(e.target.result).split(/\r?\n/).filter(l => l.trim().length > 0);
          const sep = lines[0].includes(';') ? ';' : ',';
          headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
          rows = lines.slice(1).map(line => {
            const vals = line.split(sep);
            const row = {};
            headers.forEach((h, i) => { row[h] = (vals[i] || '').trim().replace(/^"|"$/g, ''); });
            return row;
          });
        }
        if (rows.length === 0) {
          alert('El archivo no contiene filas de productos.');
          return;
        }
        this.processInventoryExcelDataset(headers, rows);
      } catch (err) {
        alert('Error leyendo el archivo Excel/CSV. Puedes probar con "Cargar Excel Habitual de Prueba".');
      }
    };

    if (file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file, 'utf-8');
    else reader.readAsBinaryString(file);
  }

  inferInventoryColumnMappings(headers) {
    const rules = [
      { key: 'sku', label: 'SKU / Código', regex: /sku|ref|cod|codigo|item/i, reason: 'Identificador único de referencia' },
      { key: 'name', label: 'Nombre del Producto *', regex: /producto|nombre|titulo|desc_corta|articulo/i, reason: 'Título comercial detectado' },
      { key: 'origin_type', label: 'Origen (Dropi/Propio)', regex: /modal|origen|tipo|canal|red/i, reason: 'Normaliza texto a dropi / propio' },
      { key: 'origin_city', label: 'Ciudad de Origen', regex: /ciudad|city|ubicacion|sede|bodega_ciudad/i, reason: 'Normaliza ciudades colombianas' },
      { key: 'supplier', label: 'Bodega / Proveedor', regex: /prov|supplier|almacen|marca|bodega/i, reason: 'Agrupa envíos por mismo origen' },
      { key: 'cost_dropi', label: 'Costo Unitario', regex: /cost|compra|mayorista|base/i, reason: 'Limpia signos $ y separadores' },
      { key: 'suggested_price', label: 'Precio de Venta *', regex: /prec|pvp|venta|valor|sugerido/i, reason: 'Convierte formato moneda a COP' },
      { key: 'stock', label: 'Stock Disponible', regex: /stock|unid|cant|qty|exist/i, reason: 'Convierte a entero disponible' },
      { key: 'category', label: 'Categoría', regex: /cat|linea|grupo|segmento/i, reason: 'Clasifica filtro de catálogo' },
      { key: 'specifications', label: 'Especificaciones Técnicas', regex: /ficha|espec|spec|caract|detalle/i, reason: 'Base para medir calidad del producto' }
    ];

    const matchPriority = ['sku', 'origin_city', 'origin_type', 'specifications', 'cost_dropi', 'suggested_price', 'stock', 'category', 'supplier', 'name'];
    const used = new Set();
    const mapping = {};
    const explanations = {};

    matchPriority.forEach(key => {
      const rule = rules.find(r => r.key === key);
      if (!rule) return;
      const match = headers.find(h => !used.has(h) && rule.regex.test(h)) || '';
      if (match) used.add(match);
      mapping[rule.key] = match;
    });

    rules.forEach(r => {
      explanations[r.key] = { label: r.label, reason: r.reason, matched: mapping[r.key] || '' };
    });
    return { mapping, explanations, rules };
  }

  processInventoryExcelDataset(headers, rows) {
    this.invExcelHeaders = headers;
    this.invExcelRawRows = rows;
    const { mapping, explanations, rules } = this.inferInventoryColumnMappings(headers);
    this.invAiMapping = mapping;

    const reviewStage = document.getElementById('inv-excel-review-stage');
    if (reviewStage) reviewStage.style.display = 'block';

    const matchedCount = Object.values(mapping).filter(Boolean).length;
    const confPct = Math.min(99, Math.round((matchedCount / rules.length) * 100));
    const confBadge = document.getElementById('inv-ai-confidence-badge');
    if (confBadge) confBadge.textContent = `IA adaptó ${matchedCount}/${rules.length} campos • Confianza ${confPct}%`;

    const grid = document.getElementById('inv-ai-mapping-grid');
    if (grid) {
      grid.innerHTML = rules.map(r => {
        const exp = explanations[r.key];
        return `
          <div style="background: #FFFFFF; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 0.6rem 0.75rem;">
            <div style="font-size: 0.73rem; font-weight: 800; color: var(--text-main);">${exp.label}</div>
            <div style="font-size: 0.68rem; color: var(--accent-1); margin-bottom: 0.3rem;">${exp.reason}</div>
            <select class="form-control" style="padding: 0.3rem 0.5rem; font-size: 0.76rem;" onchange="window.consoleApp.onInvMappingChanged('${r.key}', this.value)">
              <option value="">(Valor por defecto)</option>
              ${headers.map(h => `<option value="${this.escapeHtml(h)}" ${mapping[r.key] === h ? 'selected' : ''}>Excel: ${this.escapeHtml(h)}</option>`).join('')}
            </select>
          </div>
        `;
      }).join('');
    }

    this.buildInvPreviewRows();
  }

  onInvMappingChanged(targetKey, sourceHeader) {
    this.invAiMapping[targetKey] = sourceHeader;
    this.buildInvPreviewRows();
  }

  normalizeCityName(raw) {
    const s = String(raw || '').toLowerCase();
    if (s.includes('bog')) return 'Bogotá D.C.';
    if (s.includes('med')) return 'Medellín';
    if (s.includes('cal')) return 'Cali';
    if (s.includes('bar')) return 'Barranquilla';
    if (s.includes('buc')) return 'Bucaramanga';
    return String(raw || '').trim() || 'Bogotá D.C.';
  }

  buildInvPreviewRows() {
    const parseCop = (v) => {
      const digits = String(v ?? '').replace(/[^0-9]/g, '');
      return Number(digits) || 0;
    };
    const isAdmin = this.currentUser && this.currentUser.role === 'admin';
    const m = this.invAiMapping;

    this.invPreviewRows = this.invExcelRawRows.map((row, idx) => {
      const rawOrigin = m.origin_type ? String(row[m.origin_type] || '').toLowerCase() : 'propio';
      const originType = (isAdmin && rawOrigin.includes('dropi')) ? 'dropi' : 'propio';
      return {
        sku: (m.sku && row[m.sku]) ? String(row[m.sku]).trim() : `INV-${Date.now().toString().slice(-3)}-${idx + 1}`,
        name: (m.name && row[m.name]) ? String(row[m.name]).trim() : `Producto ${idx + 1}`,
        origin_type: originType,
        origin_city: this.normalizeCityName(m.origin_city ? row[m.origin_city] : ''),
        supplier: (m.supplier && row[m.supplier]) ? String(row[m.supplier]).trim() : ((this.currentUser && this.currentUser.companyName) || 'Mi Bodega Propia'),
        cost_dropi: parseCop(m.cost_dropi ? row[m.cost_dropi] : 0),
        suggested_price: parseCop(m.suggested_price ? row[m.suggested_price] : 0),
        stock: Math.max(0, parseInt(String(m.stock ? row[m.stock] : '10').replace(/[^0-9]/g, ''), 10) || 0),
        category: (m.category && row[m.category]) ? String(row[m.category]).trim() : 'General',
        specifications: (m.specifications && row[m.specifications]) ? String(row[m.specifications]).trim() : 'Especificación estándar EasyGrow'
      };
    });

    this.renderInvPreviewTable();
  }

  renderInvPreviewTable() {
    const tbody = document.getElementById('inv-preview-tbody');
    const countSpan = document.getElementById('inv-preview-row-count');
    if (countSpan) countSpan.textContent = String(this.invPreviewRows.length);
    if (!tbody) return;

    const isAdmin = this.currentUser && this.currentUser.role === 'admin';
    tbody.innerHTML = this.invPreviewRows.map((r, i) => `
      <tr style="border-bottom: 1px solid var(--border-subtle);">
        <td style="padding: 0.4rem;"><input type="text" value="${this.escapeHtml(r.sku)}" onchange="window.consoleApp.updateInvPreviewCell(${i}, 'sku', this.value)" style="width: 90px; padding: 0.25rem 0.4rem; border: 1px solid var(--border-subtle); border-radius: 4px; font-size: 0.76rem;"></td>
        <td style="padding: 0.4rem;"><input type="text" value="${this.escapeHtml(r.name)}" onchange="window.consoleApp.updateInvPreviewCell(${i}, 'name', this.value)" style="width: 155px; padding: 0.25rem 0.4rem; border: 1px solid var(--border-subtle); border-radius: 4px; font-size: 0.76rem;"></td>
        <td style="padding: 0.4rem;">
          <select onchange="window.consoleApp.updateInvPreviewCell(${i}, 'origin_type', this.value)" style="padding: 0.25rem; border: 1px solid var(--border-subtle); border-radius: 4px; font-size: 0.76rem;">
            <option value="propio" ${r.origin_type === 'propio' ? 'selected' : ''}>Propio</option>
            ${isAdmin ? `<option value="dropi" ${r.origin_type === 'dropi' ? 'selected' : ''}>Dropi</option>` : ''}
          </select>
        </td>
        <td style="padding: 0.4rem;"><input type="text" value="${this.escapeHtml(r.origin_city)}" onchange="window.consoleApp.updateInvPreviewCell(${i}, 'origin_city', this.value)" style="width: 95px; padding: 0.25rem 0.4rem; border: 1px solid var(--border-subtle); border-radius: 4px; font-size: 0.76rem;"></td>
        <td style="padding: 0.4rem;"><input type="text" value="${this.escapeHtml(r.supplier)}" onchange="window.consoleApp.updateInvPreviewCell(${i}, 'supplier', this.value)" style="width: 120px; padding: 0.25rem 0.4rem; border: 1px solid var(--border-subtle); border-radius: 4px; font-size: 0.76rem;"></td>
        <td style="padding: 0.4rem;"><input type="number" value="${r.cost_dropi}" onchange="window.consoleApp.updateInvPreviewCell(${i}, 'cost_dropi', Number(this.value))" style="width: 75px; padding: 0.25rem 0.4rem; border: 1px solid var(--border-subtle); border-radius: 4px; font-size: 0.76rem;"></td>
        <td style="padding: 0.4rem;"><input type="number" value="${r.suggested_price}" onchange="window.consoleApp.updateInvPreviewCell(${i}, 'suggested_price', Number(this.value))" style="width: 75px; padding: 0.25rem 0.4rem; border: 1px solid var(--border-subtle); border-radius: 4px; font-size: 0.76rem;"></td>
        <td style="padding: 0.4rem;"><input type="number" value="${r.stock}" onchange="window.consoleApp.updateInvPreviewCell(${i}, 'stock', Number(this.value))" style="width: 55px; padding: 0.25rem 0.4rem; border: 1px solid var(--border-subtle); border-radius: 4px; font-size: 0.76rem;"></td>
        <td style="padding: 0.4rem;"><input type="text" value="${this.escapeHtml(r.specifications)}" onchange="window.consoleApp.updateInvPreviewCell(${i}, 'specifications', this.value)" style="width: 170px; padding: 0.25rem 0.4rem; border: 1px solid var(--border-subtle); border-radius: 4px; font-size: 0.76rem;"></td>
        <td style="padding: 0.4rem;"><button type="button" onclick="window.consoleApp.removeInvPreviewRow(${i})" style="background: transparent; border: none; color: var(--data-crimson); cursor: pointer; font-weight: 700;">✕</button></td>
      </tr>
    `).join('');
  }

  updateInvPreviewCell(idx, field, val) {
    if (this.invPreviewRows[idx]) {
      this.invPreviewRows[idx][field] = val;
    }
  }

  removeInvPreviewRow(idx) {
    this.invPreviewRows.splice(idx, 1);
    this.renderInvPreviewTable();
  }

  async confirmInventoryImport() {
    if (this.invPreviewRows.length === 0) {
      alert('No hay filas de productos para importar.');
      return;
    }
    const btn = document.getElementById('btn-confirm-inv-import');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Confirmando e importando plantilla EasyGrow...';
    }

    try {
      const res = await fetch('/api/marketplace/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: this.invPreviewRows })
      });
      const data = await res.json();
      if (data.success) {
        this.closeInventoryExcelModal();
        this.showToast('✓ Inventario Importado', `${data.importedCount} productos adaptados e incorporados tras tu confirmación.`, 'success');
        await this.loadProducts();
        if (this.activeModuleId === 'marketplace') {
          this.openModuleFull('marketplace', false);
        }
      } else {
        alert(data.error || 'No se pudo completar la importación.');
      }
    } catch (e) {
      alert('Error de conexión importando inventario.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✓ Confirmar Cambios e Importar Inventario a EasyGrow';
      }
    }
  }

  // --- Excel Import Modal & Dynamic Mapper ---
  openExcelModal() {
    const backdrop = document.getElementById('excel-modal-backdrop');
    if (!backdrop) return;
    backdrop.style.display = 'flex';
  }

  closeExcelModal() {
    const backdrop = document.getElementById('excel-modal-backdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  async onExcelFileSelected(event) {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;

    const guard = await this.validateAndInspectUploadFile(file);
    if (!guard.safe) {
      input.value = '';
      this.showToast('🛡️ Archivo Bloqueado', guard.error, 'warn');
      alert(`SEGURIDAD EASYGROW:\n${guard.error}`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        let workbook;
        if (window.XLSX) {
          workbook = window.XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheet];
          this.excelRawRows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
          if (this.excelRawRows.length > 0) {
            this.excelHeaders = Object.keys(this.excelRawRows[0]);
          }
        } else {
          // Fallback simple CSV parsing
          const text = e.target.result;
          const lines = text.split('\n').filter(l => l.trim().length > 0);
          this.excelHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          this.excelRawRows = lines.slice(1).map(line => {
            const values = line.split(',');
            const row = {};
            this.excelHeaders.forEach((h, i) => { row[h] = values[i] ? values[i].trim().replace(/^"|"$/g, '') : ''; });
            return row;
          });
        }

        this.setupExcelColumnSelectors();
        document.getElementById('excel-mapping-section').style.display = 'block';
        this.updateExcelPreview();
      } catch (err) {
        alert('Error al leer el archivo. Asegúrate de subir un formato .xlsx o .csv válido.');
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file, 'utf-8');
    } else {
      reader.readAsBinaryString(file);
    }
  }

  setupExcelColumnSelectors() {
    const selectors = ['map-col-name', 'map-col-phone', 'map-col-value', 'map-col-cost', 'map-col-stage'];
    selectors.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = `<option value="">-- Seleccionar Columna --</option>` + 
        this.excelHeaders.map(h => `<option value="${h}">${h}</option>`).join('');
    });

    // Auto-match intelligent detection
    this.excelHeaders.forEach(h => {
      const lower = h.toLowerCase();
      if (/cliente|nombre|empresa|customer|buyer|destinatario/i.test(lower)) {
        this.setSelectorValue('map-col-name', h);
      } else if (/tel|cel|phone|whatsapp|contacto/i.test(lower)) {
        this.setSelectorValue('map-col-phone', h);
      } else if (/venta|precio|total|valor|ingreso|revenue/i.test(lower)) {
        this.setSelectorValue('map-col-value', h);
      } else if (/costo|cost|compra|proveedor/i.test(lower)) {
        this.setSelectorValue('map-col-cost', h);
      } else if (/etapa|estado|status|fase|stage/i.test(lower)) {
        this.setSelectorValue('map-col-stage', h);
      }
    });
  }

  setSelectorValue(selectorId, val) {
    const sel = document.getElementById(selectorId);
    if (sel && (!sel.value || sel.value === '')) {
      sel.value = val;
    }
  }

  updateExcelPreview() {
    const valCol = document.getElementById('map-col-value')?.value;
    const costCol = document.getElementById('map-col-cost')?.value;

    let totalRevenue = 0;
    let totalCost = 0;

    this.excelRawRows.forEach(row => {
      if (valCol && row[valCol]) {
        const cleaned = String(row[valCol]).replace(/[^0-9.-]+/g, '');
        totalRevenue += Number(cleaned) || 0;
      }
      if (costCol && row[costCol]) {
        const cleaned = String(row[costCol]).replace(/[^0-9.-]+/g, '');
        totalCost += Number(cleaned) || 0;
      }
    });

    const netProfit = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

    const revElem = document.getElementById('calc-preview-revenue');
    const marginElem = document.getElementById('calc-preview-margin');
    const countElem = document.getElementById('calc-preview-count');

    if (revElem) revElem.textContent = `$${totalRevenue.toLocaleString()} COP`;
    if (marginElem) marginElem.textContent = `${marginPct}%`;
    if (countElem) countElem.textContent = this.excelRawRows.length;
  }

  async confirmExcelImport() {
    const nameCol = document.getElementById('map-col-name')?.value;
    const phoneCol = document.getElementById('map-col-phone')?.value;
    const valCol = document.getElementById('map-col-value')?.value;
    const costCol = document.getElementById('map-col-cost')?.value;
    const stageCol = document.getElementById('map-col-stage')?.value;

    if (!nameCol) {
      alert('Por favor selecciona la columna correspondiente al Nombre del Cliente.');
      return;
    }

    const contactsToImport = this.excelRawRows.map(row => {
      let stage = 'closed';
      if (stageCol && row[stageCol]) {
        const s = String(row[stageCol]).toLowerCase();
        if (s.includes('pros') || s.includes('ini') || s.includes('lead')) stage = 'prospects';
        else if (s.includes('neg') || s.includes('cotiz') || s.includes('prop')) stage = 'negotiation';
        else stage = 'closed';
      }

      const val = valCol ? Number(String(row[valCol]).replace(/[^0-9.-]+/g, '')) || 0 : 0;
      const cost = costCol ? Number(String(row[costCol]).replace(/[^0-9.-]+/g, '')) || 0 : 0;

      return {
        name: String(row[nameCol] || 'Cliente Importado').trim(),
        contactPerson: String(row[nameCol] || '').trim(),
        phone: phoneCol ? String(row[phoneCol] || '').trim() : '',
        email: `${String(row[nameCol] || 'cliente').toLowerCase().replace(/[^a-z0-9]/g, '')}@import.co`,
        company: String(row[nameCol] || '').trim(),
        stage,
        value: val,
        cost: cost,
        tags: ['Importación-Excel', 'Ventas-Reales']
      };
    });

    const btn = document.getElementById('btn-confirm-excel-import');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Guardando registros en SQLite y recalculando métricas...';
    }

    try {
      const res = await fetch('/api/crm/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: contactsToImport })
      });
      const data = await res.json();

      if (data.success) {
        this.closeExcelModal();
        this.showToast('✓ Importación Exitosa', `Se han importado ${data.importedCount} clientes y recalculado tus ingresos y rentabilidad.`, 'success');
        await this.loadMetrics();
        await window.EasyGrowCRM.syncWithServer(false);
        this.openModuleFull('crm-pipeline', false);
      } else {
        alert(data.error || 'Error al importar registros.');
      }
    } catch (err) {
      alert('Error de conexión al importar.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✓ Confirmar e Importar al CRM en Tiempo Real';
      }
    }
  }

  // --- Estación 02: Dashboard Seleccionable, Kanban 3D Editable, Fidelización y Fórmulas ---
  getDashboardIndicatorCatalog(periodLabel = 'Todo el historial') {
    const m = this.metrics || {};
    return [
      {
        id: 'ventas',
        label: 'Ventas',
        value: `$${Number(m.totalRevenue || 0).toLocaleString()} COP`,
        sub: `${m.closedCount || 0} ventas cerradas`,
        color: 'var(--accent-1)'
      },
      {
        id: 'conversion',
        label: 'Conversión',
        value: `${Number(m.winRate || 0).toFixed(1)}%`,
        sub: `${m.closedCount || 0} de ${m.totalLeads || 0} oportunidades`,
        color: 'var(--text-main)'
      },
      {
        id: 'compra_promedio',
        label: 'Compra Promedio',
        value: `$${Number(m.avgPurchaseValue || 0).toLocaleString()} COP`,
        sub: `${m.purchasesCount || m.closedCount || 0} compras evaluadas`,
        color: 'var(--text-main)'
      },
      {
        id: 'oportunidades_abiertas',
        label: 'Oportunidades Abiertas',
        value: `${m.openOpportunitiesCount || 0}`,
        sub: `$${Number(m.openOpportunitiesValue || 0).toLocaleString()} COP nominal`,
        color: 'var(--text-main)'
      },
      {
        id: 'ingresos_periodo',
        label: `Ingresos (${periodLabel})`,
        value: `$${Number(m.periodRevenue || 0).toLocaleString()} COP`,
        sub: `Periodo: ${periodLabel}`,
        color: 'var(--usd-green)'
      },
      {
        id: 'proyeccion_ponderada',
        label: 'Proyección Ponderada',
        value: `$${Number(m.weightedPipelineValue || 0).toLocaleString()} COP`,
        sub: 'Fórmula: Valor × Prob. etapa',
        color: 'var(--accent-1)'
      },
      {
        id: 'fidelizacion',
        label: 'Fidelización & Compras',
        value: `${m.customersWithPurchases || 0} clientes`,
        sub: `${m.purchasesCount || 0} compras asociadas`,
        color: 'var(--text-main)'
      }
    ];
  }

  toggleDashboardKPI(kpiId) {
    if (this.selectedDashboardKPIs.includes(kpiId)) {
      if (this.selectedDashboardKPIs.length <= 1) {
        this.showToast('ℹ️ Indicadores', 'Mantén al menos un indicador visible en el dashboard.', 'info');
        return;
      }
      this.selectedDashboardKPIs = this.selectedDashboardKPIs.filter(id => id !== kpiId);
    } else {
      this.selectedDashboardKPIs.push(kpiId);
    }
    this.openModuleFull('crm-pipeline', false);
  }

  async changeMetricsPeriod(nextPeriod) {
    this.metricsPeriod = nextPeriod || 'all';
    await this.loadMetrics();
    this.openModuleFull('crm-pipeline', false);
  }

  renderKanbanCards(list, allStages, currentStageObj) {
    if (!list || list.length === 0) {
      return `
        <div style="padding: 1.75rem 0.9rem; text-align: center; color: var(--text-dim); font-size: 0.8rem; border: 1px dashed var(--border-subtle); background: rgba(255,255,255,0.65); border-radius: 6px;">
          Sin oportunidades en esta etapa
        </div>
      `;
    }

    const stageProb = Number(currentStageObj?.probability || 0);
    return list.map(c => {
      const val = Number(c.value) || 0;
      const weighted = Math.round(val * (stageProb / 100));
      return `
        <div class="kanban-card">
          <div class="card-lead-company">${this.escapeHtml(c.company || c.name)}</div>
          <div class="card-lead-contact">${this.escapeHtml(c.contactPerson || c.contact_person || c.name)} • ${this.escapeHtml(c.phone || 'Sin teléfono')}</div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 0.4rem; margin-bottom: 0.55rem;">
            <span class="card-lead-value" style="margin-bottom: 0;">$${val.toLocaleString()}</span>
            <span style="font-size: 0.72rem; font-family: monospace; color: var(--text-muted);" title="${val.toLocaleString()} × ${stageProb}%">
              Pond: <b style="color: var(--accent-1);">$${weighted.toLocaleString()}</b> (${stageProb}%)
            </span>
          </div>
          <div class="card-tags-list">
            ${(c.tags || []).map(t => `<span class="card-tag">${this.escapeHtml(t)}</span>`).join('')}
          </div>
          <div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; gap: 0.4rem;">
            <select onchange="window.consoleApp.moveContactStage('${c.id}', this.value)" style="flex: 1; background: var(--bg-dark); border: 1px solid var(--border-subtle); color: var(--text-main); font-size: 0.72rem; padding: 3px 6px; border-radius: 4px;">
              ${allStages.map(s => `<option value="${s.slug}" ${c.stage === s.slug ? 'selected' : ''}>${this.escapeHtml(s.name)} (${s.probability}%)</option>`).join('')}
            </select>
            <button onclick="window.consoleApp.openPurchaseRecordModal('${c.id}')" title="Registrar compra asociada a este cliente" style="background: #F4F5F2; border: 1px solid var(--border-subtle); color: var(--text-main); cursor: pointer; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">
              +🧾
            </button>
            <button onclick="window.consoleApp.deleteContact('${c.id}')" title="Eliminar oportunidad" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 0.78rem;" onmouseover="this.style.color='var(--data-crimson)'" onmouseout="this.style.color='var(--text-dim)'">
              ✕
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  async moveContactStage(contactId, newStage) {
    await window.EasyGrowCRM.updateStage(contactId, newStage);
    await this.loadStages();
    await this.loadMetrics();
    this.openModuleFull('crm-pipeline', false);
  }

  async deleteContact(contactId) {
    if (!confirm('¿Deseas eliminar este registro de tu CRM?')) return;
    try {
      await fetch(`/api/crm/contacts/${contactId}`, { method: 'DELETE' });
      await window.EasyGrowCRM.syncWithServer(false);
      await this.loadStages();
      await this.loadMetrics();
      this.openModuleFull('crm-pipeline', false);
    } catch (e) {}
  }

  async addQuickOpportunity() {
    const names = ["Andina Retail", "BioTech Mayorista", "Luminaria Express", "Gadgets Colombia"];
    const people = ["Juliana Botero", "Mario Casas", "Verónica Ruiz", "Felipe Gómez"];
    const rand = Math.floor(Math.random() * names.length);
    const randomVal = Math.floor(2000000 + Math.random() * 10000000);
    const firstStageSlug = (this.stages && this.stages[0]) ? this.stages[0].slug : 'prospects';

    const newContact = {
      name: names[rand],
      contactPerson: people[rand],
      phone: "+57 315 " + Math.floor(1000000 + Math.random() * 9000000),
      email: `${people[rand].toLowerCase().replace(/\s+/g, '.')}@${names[rand].toLowerCase().replace(/\s+/g, '')}.co`,
      company: names[rand],
      stage: firstStageSlug,
      value: randomVal,
      cost: Math.round(randomVal * 0.55),
      tags: ["Oportunidad-Rápida", "Estación-02"],
      attribution: "Ingreso Manual por Consola"
    };

    await window.EasyGrowCRM.create(newContact);
    await this.loadStages();
    await this.loadMetrics();
    this.openModuleFull('crm-pipeline', false);
  }

  // --- Modal Editor de Etapas Kanban y Sugerencias Históricas de Probabilidad ---
  openStagesConfigModal() {
    const backdrop = document.getElementById('stages-config-modal-backdrop');
    if (!backdrop) return;
    backdrop.style.display = 'flex';
    this.renderStagesConfigModalBody();
  }

  closeStagesConfigModal() {
    const backdrop = document.getElementById('stages-config-modal-backdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  renderStagesConfigModalBody() {
    const suggBox = document.getElementById('stages-history-suggestions-box');
    const listBox = document.getElementById('stages-editor-list');
    const hist = this.historyAnalysis;

    if (suggBox) {
      if (hist && hist.suggestions && hist.suggestions.length > 0) {
        suggBox.innerHTML = `
          <div style="background: rgba(31, 168, 102, 0.08); border: 1.5px solid var(--accent-1); border-radius: 8px; padding: 1rem;">
            <div style="font-weight: 800; font-size: 0.88rem; color: var(--text-main); margin-bottom: 0.5rem;">
              💡 Sugerencias de Probabilidad Basadas en Historial de Cierres (${hist.wonCount} ganadas / ${hist.lostCount} perdidas)
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${hist.suggestions.map(s => `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; background: #FFFFFF; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 0.55rem 0.75rem; font-size: 0.8rem;">
                  <div>
                    <strong style="color: var(--text-main);">${this.escapeHtml(s.stageName)}:</strong> Actual <b>${s.currentProbability}%</b> → Sugerido <b style="color: var(--accent-1);">${s.suggestedProbability}%</b>
                    <div style="font-size: 0.72rem; color: var(--text-muted);">${this.escapeHtml(s.reason)}</div>
                  </div>
                  <button type="button" class="btn-primary-large" onclick="window.consoleApp.applySuggestedProbability('${s.stageId}', ${s.suggestedProbability})" style="padding: 0.38rem 0.75rem; font-size: 0.76rem;">
                    ✓ Revisado, Aplicar ${s.suggestedProbability}%
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        suggBox.innerHTML = `
          <div style="background: #F8F8F6; border: 1px dashed var(--border-subtle); border-radius: 8px; padding: 0.85rem 1rem; font-size: 0.8rem; color: var(--text-muted);">
            EasyGrow aplica probabilidades iniciales recomendadas (Nuevo 20%, En progreso 50%, Ganado 100%, Perdido 0%). Cuando tu tienda registre suficientes cierres (≥ 3 oportunidades resueltas en Ganado/Perdido), aquí aparecerán sugerencias revisables antes de aplicarlas.
          </div>
        `;
      }
    }

    if (listBox) {
      listBox.innerHTML = (this.stages || []).map(st => `
        <div style="display: grid; grid-template-columns: 2fr 1.2fr 0.85fr auto auto; gap: 0.6rem; align-items: center; background: #FFFFFF; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.65rem 0.85rem;">
          <input type="text" id="stg-name-${st.id}" class="form-control" value="${this.escapeHtml(st.name)}" placeholder="Nombre de etapa" style="padding: 0.45rem 0.65rem; font-size: 0.84rem;">
          <select id="stg-cat-${st.id}" class="form-control" style="padding: 0.45rem 0.6rem; font-size: 0.82rem;">
            <option value="nuevo" ${st.common_category === 'nuevo' ? 'selected' : ''}>Cat: Nuevo</option>
            <option value="en_progreso" ${st.common_category === 'en_progreso' ? 'selected' : ''}>Cat: En progreso</option>
            <option value="ganado" ${st.common_category === 'ganado' ? 'selected' : ''}>Cat: Ganado</option>
            <option value="perdido" ${st.common_category === 'perdido' ? 'selected' : ''}>Cat: Perdido</option>
          </select>
          <div style="display: flex; align-items: center; gap: 0.25rem;">
            <input type="number" id="stg-prob-${st.id}" class="form-control" min="0" max="100" value="${st.probability}" style="padding: 0.45rem 0.5rem; font-size: 0.84rem;">
            <span style="font-size: 0.8rem; font-weight: 700;">%</span>
          </div>
          <button type="button" class="btn-primary-large" onclick="window.consoleApp.saveStageRow('${st.id}')" style="padding: 0.45rem 0.75rem; font-size: 0.76rem;">
            Guardar
          </button>
          <button type="button" class="btn-secondary" onclick="window.consoleApp.deleteStageRow('${st.id}')" title="Eliminar etapa" style="padding: 0.42rem 0.65rem; font-size: 0.76rem; color: var(--data-crimson);">
            🗑️
          </button>
        </div>
      `).join('');
    }
  }

  async saveStageRow(stageId) {
    const name = document.getElementById(`stg-name-${stageId}`)?.value.trim();
    const common_category = document.getElementById(`stg-cat-${stageId}`)?.value;
    const probability = Number(document.getElementById(`stg-prob-${stageId}`)?.value || 0);

    try {
      const res = await fetch(`/api/crm/stages/${stageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, common_category, probability })
      });
      const data = await res.json();
      if (data.success) {
        await this.loadStages();
        await this.loadMetrics();
        this.renderStagesConfigModalBody();
        this.showToast('✓ Etapa Actualizada', `"${name}" (${probability}%) guardada para tu tienda.`, 'success');
        if (this.activeModuleId === 'crm-pipeline') {
          this.openModuleFull('crm-pipeline', false);
        }
      }
    } catch (e) {}
  }

  async applySuggestedProbability(stageId, probability) {
    try {
      const res = await fetch(`/api/crm/stages/${stageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ probability })
      });
      const data = await res.json();
      if (data.success) {
        await this.loadStages();
        await this.loadMetrics();
        this.renderStagesConfigModalBody();
        this.showToast('✓ Probabilidad Aplicada', `Se aplicó el ajuste sugerido (${probability}%) tras tu revisión.`, 'success');
        if (this.activeModuleId === 'crm-pipeline') {
          this.openModuleFull('crm-pipeline', false);
        }
      }
    } catch (e) {}
  }

  async addNewStageConfig(e) {
    e.preventDefault();
    const name = document.getElementById('new-stage-name')?.value.trim();
    const common_category = document.getElementById('new-stage-category')?.value;
    const probability = Number(document.getElementById('new-stage-prob')?.value || 45);
    if (!name) return;

    try {
      const res = await fetch('/api/crm/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, common_category, probability })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('new-stage-name').value = '';
        await this.loadStages();
        await this.loadMetrics();
        this.renderStagesConfigModalBody();
        this.showToast('✓ Etapa Creada', `Etapa "${name}" agregada al Kanban 3D.`, 'success');
        if (this.activeModuleId === 'crm-pipeline') {
          this.openModuleFull('crm-pipeline', false);
        }
      }
    } catch (err) {}
  }

  async deleteStageRow(stageId) {
    if (!confirm('¿Eliminar esta etapa? Las oportunidades actuales se moverán automáticamente a la primera etapa disponible.')) return;
    try {
      const res = await fetch(`/api/crm/stages/${stageId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await this.loadStages();
        await window.EasyGrowCRM.syncWithServer(false);
        await this.loadMetrics();
        this.renderStagesConfigModalBody();
        if (this.activeModuleId === 'crm-pipeline') {
          this.openModuleFull('crm-pipeline', false);
        }
      } else {
        alert(data.error || 'No se pudo eliminar la etapa.');
      }
    } catch (e) {}
  }

  // --- Fidelización: Tabla Resumen de Cliente y Compras Asociadas ---
  renderLoyaltyAndPurchasesSection(contacts, stages) {
    const purchases = this.purchases || [];
    const stageMap = {};
    stages.forEach(s => { stageMap[s.slug] = s; });

    // Customer summary aggregating associated purchases per customer
    const customerRows = contacts.map(c => {
      const cname = c.contactPerson || c.contact_person || c.name || 'Cliente';
      const linked = purchases.filter(p => p.contact_id === c.id || (p.customer_name || '').toLowerCase() === cname.toLowerCase());
      const totalBought = linked.length > 0
        ? linked.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
        : (stageMap[c.stage]?.common_category === 'ganado' ? (Number(c.value) || 0) : 0);
      const countPurchases = linked.length > 0 ? linked.length : (stageMap[c.stage]?.common_category === 'ganado' ? 1 : 0);
      const avgTicket = countPurchases > 0 ? Math.round(totalBought / countPurchases) : 0;
      const lastOrder = linked[0] || null;
      return {
        id: c.id,
        name: cname,
        company: c.company || c.name,
        stageName: stageMap[c.stage]?.name || c.stage,
        countPurchases,
        totalBought,
        avgTicket,
        lastStatus: lastOrder ? lastOrder.order_status : (countPurchases > 0 ? 'CONFIRMADO' : 'Sin compras aún'),
        lastDelivery: lastOrder ? `${lastOrder.actual_delivery_date} (Est: ${lastOrder.estimated_delivery_date})` : '—'
      };
    });

    return `
      <div class="erp-table-wrapper" style="margin-bottom: 1.25rem;">
        <div class="erp-table-toolbar">
          <strong>1. Resumen de Fidelización por Cliente (${customerRows.length})</strong>
          <button type="button" class="btn-primary-large" onclick="window.consoleApp.openPurchaseRecordModal()" style="font-size: 0.8rem;">
            + Registrar Compra Asociada
          </button>
        </div>
        <div class="erp-table-scroll">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Cliente / Empresa</th>
                <th>Etapa Actual</th>
                <th class="num-col">Compras Asociadas</th>
                <th class="num-col">Total Comprado (COP)</th>
                <th class="num-col">Compra Promedio (COP)</th>
                <th>Última Entrega</th>
              </tr>
            </thead>
            <tbody>
              ${customerRows.length === 0 ? `
                <tr><td colspan="6" style="padding: 1.25rem; text-align: center; color: var(--text-muted);">Aún no hay clientes registrados en esta tienda.</td></tr>
              ` : customerRows.map(cr => `
                <tr>
                  <td><strong>${this.escapeHtml(cr.name)}</strong><div style="font-size: 0.72rem; color: var(--text-dim);">${this.escapeHtml(cr.company)}</div></td>
                  <td>${this.escapeHtml(cr.stageName)}</td>
                  <td class="num-col"><strong>${cr.countPurchases}</strong></td>
                  <td class="num-col" style="color: var(--accent-1); font-weight: 700;">$${cr.totalBought.toLocaleString('es-CO')}</td>
                  <td class="num-col">$${cr.avgTicket.toLocaleString('es-CO')}</td>
                  <td style="font-size: 0.76rem; color: var(--text-muted);">${this.escapeHtml(cr.lastDelivery)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="erp-table-wrapper">
        <div class="erp-table-toolbar">
          <strong>2. Historial Detallado de Compras Asociadas (${purchases.length})</strong>
          <span style="font-size:0.78rem; color:var(--text-muted);">Productos, montos, estado del pedido y fechas estimada vs. real</span>
        </div>
        <div class="erp-table-scroll">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Referencia / Guía</th>
                <th>Historial de Productos</th>
                <th class="num-col">Monto (COP)</th>
                <th>Estado del Pedido</th>
                <th class="num-col">Entrega Estimada</th>
                <th class="num-col">Entrega Real</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${purchases.length === 0 ? `
                <tr><td colspan="8" style="padding: 1.25rem; text-align: center; color: var(--text-muted);">No hay compras asociadas todavía. Se crean al confirmar pedidos o mediante "+ Registrar Compra Asociada".</td></tr>
              ` : purchases.map(p => `
                <tr>
                  <td><strong>${this.escapeHtml(p.customer_name)}</strong></td>
                  <td style="font-size: 0.74rem; color: var(--text-muted);">${this.escapeHtml(p.order_ref)}</td>
                  <td>${this.escapeHtml(p.products_summary)}</td>
                  <td class="num-col" style="color: var(--accent-1); font-weight: 700;">$${Number(p.amount || 0).toLocaleString('es-CO')}</td>
                  <td><span class="erp-status-pill">${this.escapeHtml(p.order_status)}</span></td>
                  <td class="num-col">${this.escapeHtml(p.estimated_delivery_date)}</td>
                  <td class="num-col" style="font-weight: 700; color: ${p.actual_delivery_date === 'Pendiente' ? 'var(--data-amber)' : 'var(--accent-1)'};">${this.escapeHtml(p.actual_delivery_date)}</td>
                  <td>
                    ${p.actual_delivery_date === 'Pendiente'
                      ? `<button type="button" class="btn-secondary" onclick="window.consoleApp.markPurchaseDelivered('${p.id}')" style="padding: 2px 7px; font-size: 0.72rem; border-color: var(--accent-1); color: var(--accent-1);">Marcar Entregado</button>`
                      : `<span class="erp-status-pill ok">Completado</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  openPurchaseRecordModal(contactId = null) {
    const backdrop = document.getElementById('purchase-record-modal-backdrop');
    if (!backdrop) return;
    const contacts = window.EasyGrowCRM.getAll();
    const sel = document.getElementById('pur-contact-id');
    if (sel) {
      if (contacts.length === 0) {
        sel.innerHTML = `<option value="">Cliente Directo Nuevo (Sin CRM previo)</option>`;
      } else {
        sel.innerHTML = contacts.map(c => `<option value="${c.id}" ${contactId === c.id ? 'selected' : ''}>${this.escapeHtml(c.contactPerson || c.contact_person || c.name)} (${this.escapeHtml(c.company || c.name)})</option>`).join('');
      }
    }
    const estInput = document.getElementById('pur-est-date');
    if (estInput) estInput.value = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const actInput = document.getElementById('pur-actual-date');
    if (actInput) actInput.value = '';
    backdrop.style.display = 'flex';
  }

  closePurchaseRecordModal() {
    const backdrop = document.getElementById('purchase-record-modal-backdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  async submitCustomerPurchase(e) {
    e.preventDefault();
    const sel = document.getElementById('pur-contact-id');
    const contactId = sel?.value || '';
    const contact = window.EasyGrowCRM.getById(contactId);
    const customerName = contact ? (contact.contactPerson || contact.contact_person || contact.name) : 'Cliente Directo';
    const productsSummary = document.getElementById('pur-products-summary')?.value.trim();
    const amount = Number(document.getElementById('pur-amount')?.value || 0);
    const orderStatus = document.getElementById('pur-status')?.value || 'CONFIRMADO';
    const estimatedDeliveryDate = document.getElementById('pur-est-date')?.value;
    const actualRaw = document.getElementById('pur-actual-date')?.value;
    const actualDeliveryDate = actualRaw || (orderStatus === 'ENTREGADO' ? new Date().toISOString().slice(0, 10) : 'Pendiente');

    try {
      const res = await fetch('/api/crm/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId,
          customerName,
          productsSummary,
          amount,
          orderStatus,
          estimatedDeliveryDate,
          actualDeliveryDate
        })
      });
      const data = await res.json();
      if (data.success) {
        this.closePurchaseRecordModal();
        await this.loadPurchases();
        await this.loadMetrics();
        this.showToast('🧾 Compra Registrada', `Compra por $${amount.toLocaleString()} COP asociada a ${customerName}.`, 'success');
        if (this.activeModuleId === 'crm-pipeline') {
          this.openModuleFull('crm-pipeline', false);
        }
      }
    } catch (err) {}
  }

  async markPurchaseDelivered(purchaseId) {
    try {
      const res = await fetch(`/api/crm/purchases/${purchaseId}/deliver`, { method: 'PUT' });
      const data = await res.json();
      if (data.success) {
        await this.loadPurchases();
        await this.loadMetrics();
        this.showToast('✓ Entrega Registrada', 'Se actualizó el estado a ENTREGADO con la fecha real de hoy.', 'success');
        this.openModuleFull('crm-pipeline', false);
      }
    } catch (e) {}
  }

  // --- Estación 02: Constructor Visual Seguro de Fórmulas + Dos Espacios Separados ---
  getFormulaVariablesContext(overrides = {}) {
    const m = this.metrics || {};
    return {
      VALOR_OPORTUNIDAD: Number(overrides.VALOR_OPORTUNIDAD ?? this.builderTestVal ?? 1000000),
      PROBABILIDAD_ETAPA: Number(overrides.PROBABILIDAD_ETAPA ?? this.builderTestProb ?? 50),
      VENTAS: Number(m.totalRevenue || 0),
      COSTOS: Number(m.totalCost || 0),
      CONVERSION_PCT: Number(m.winRate || 0),
      COMPRA_PROMEDIO: Number(m.avgPurchaseValue || 0),
      OPORTUNIDADES_ABIERTAS: Number(m.openOpportunitiesCount || 0),
      CARTERA_PONDERADA: Number(m.weightedPipelineValue || 0)
    };
  }

  evaluateFormulaExpression(expr, overrides = {}) {
    const source = String(expr || '').trim();
    if (!source) return { valid: false, error: 'Ingresa una fórmula para validar.' };

    const vars = this.getFormulaVariablesContext(overrides);
    // Strict tokenizer: numbers, identifiers, multi-char comparisons, single-char math/parens/comma
    const tokens = [];
    let i = 0;
    while (i < source.length) {
      const ch = source[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (/[0-9.]/.test(ch)) {
        const match = source.slice(i).match(/^\d+(?:\.\d+)?/);
        if (!match) return { valid: false, error: `Número inválido cerca de "${source.slice(i, i + 8)}".` };
        tokens.push({ type: 'NUM', val: Number(match[0]) });
        i += match[0].length;
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        const match = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
        tokens.push({ type: 'IDENT', val: match[0].toUpperCase() });
        i += match[0].length;
        continue;
      }
      const twoChar = source.slice(i, i + 2);
      if (twoChar === '>=' || twoChar === '<=' || twoChar === '==' || twoChar === '!=') {
        tokens.push({ type: 'OP', val: twoChar });
        i += 2;
        continue;
      }
      if ('+-*/()><,'.includes(ch)) {
        tokens.push({ type: 'OP', val: ch });
        i++;
        continue;
      }
      return { valid: false, error: `Carácter no permitido: "${ch}". Usa únicamente campos, operadores y funciones.` };
    }

    let pos = 0;
    const peek = () => tokens[pos] || null;
    const consume = () => tokens[pos++];

    const parseComparison = () => {
      let left = parseAddSub();
      while (peek() && peek().type === 'OP' && ['>', '<', '>=', '<=', '==', '!='].includes(peek().val)) {
        const op = consume().val;
        const right = parseAddSub();
        if (op === '>') left = left > right ? 1 : 0;
        else if (op === '<') left = left < right ? 1 : 0;
        else if (op === '>=') left = left >= right ? 1 : 0;
        else if (op === '<=') left = left <= right ? 1 : 0;
        else if (op === '==') left = left === right ? 1 : 0;
        else if (op === '!=') left = left !== right ? 1 : 0;
      }
      return left;
    };

    const parseAddSub = () => {
      let left = parseMulDiv();
      while (peek() && peek().type === 'OP' && (peek().val === '+' || peek().val === '-')) {
        const op = consume().val;
        const right = parseMulDiv();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    };

    const parseMulDiv = () => {
      let left = parseUnary();
      while (peek() && peek().type === 'OP' && (peek().val === '*' || peek().val === '/')) {
        const op = consume().val;
        const right = parseUnary();
        if (op === '/') {
          if (right === 0) throw new Error('División entre cero en la vista previa.');
          left = left / right;
        } else {
          left = left * right;
        }
      }
      return left;
    };

    const parseUnary = () => {
      if (peek() && peek().type === 'OP' && (peek().val === '+' || peek().val === '-')) {
        const op = consume().val;
        const v = parseUnary();
        return op === '-' ? -v : v;
      }
      return parsePrimary();
    };

    const parsePrimary = () => {
      const tok = peek();
      if (!tok) throw new Error('Expresión incompleta.');
      if (tok.type === 'NUM') {
        consume();
        return tok.val;
      }
      if (tok.type === 'OP' && tok.val === '(') {
        consume();
        const inner = parseComparison();
        if (!peek() || peek().val !== ')') throw new Error('Falta un paréntesis de cierre ")".');
        consume();
        return inner;
      }
      if (tok.type === 'IDENT') {
        const ident = consume().val;
        if (peek() && peek().type === 'OP' && peek().val === '(') {
          consume();
          const args = [];
          if (!peek() || peek().val !== ')') {
            while (true) {
              args.push(parseComparison());
              if (peek() && peek().type === 'OP' && peek().val === ',') {
                consume();
              } else {
                break;
              }
            }
          }
          if (!peek() || peek().val !== ')') throw new Error(`Falta cerrar paréntesis en función ${ident}(...).`);
          consume();

          if (ident === 'ROUND') {
            if (args.length < 1 || args.length > 2) throw new Error('ROUND requiere 1 o 2 argumentos: ROUND(valor, decimales).');
            const factor = Math.pow(10, args[1] || 0);
            return Math.round(args[0] * factor) / factor;
          }
          if (ident === 'MAX') {
            if (args.length < 1) throw new Error('MAX requiere al menos 1 argumento.');
            return Math.max(...args);
          }
          if (ident === 'MIN') {
            if (args.length < 1) throw new Error('MIN requiere al menos 1 argumento.');
            return Math.min(...args);
          }
          if (ident === 'IF') {
            if (args.length !== 3) throw new Error('IF requiere 3 argumentos: IF(condición, si_verdadero, si_falso).');
            return args[0] ? args[1] : args[2];
          }
          throw new Error(`Función no disponible: ${ident}. Usa ROUND, MAX, MIN o IF.`);
        }

        if (Object.prototype.hasOwnProperty.call(vars, ident)) {
          return vars[ident];
        }
        throw new Error(`Campo desconocido: ${ident}.`);
      }
      throw new Error(`Token inesperado cerca de "${tok.val}".`);
    };

    try {
      const value = parseComparison();
      if (pos < tokens.length) {
        return { valid: false, error: `Operador faltante antes de "${tokens[pos].val}".` };
      }
      if (!Number.isFinite(value)) {
        return { valid: false, error: 'El resultado no es un número finito válido.' };
      }
      return { valid: true, value };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }

  renderFormulasStudioSection(mode = 'all') {
    const previewEval = this.evaluateFormulaExpression(this.builderExpr);
    const fields = [
      'VALOR_OPORTUNIDAD', 'PROBABILIDAD_ETAPA', 'VENTAS', 'COSTOS',
      'CONVERSION_PCT', 'COMPRA_PROMEDIO', 'OPORTUNIDADES_ABIERTAS', 'CARTERA_PONDERADA'
    ];
    const operators = ['+', '-', '*', '/', '(', ')', '>', '<', '=='];
    const funcs = ['ROUND(', 'MAX(', 'MIN(', 'IF('];

    const formatResult = (val, unit) => {
      if (unit === '%') return `${Number(val).toFixed(1)}%`;
      if (unit === 'COP') return `$${Math.round(Number(val)).toLocaleString('es-CO')} COP`;
      return `${Number(val).toLocaleString('es-CO')} ${unit || ''}`.trim();
    };

    const showBuilder = mode === 'all' || mode === 'constructor';
    const showPrivate = mode === 'all' || mode === 'mis_formulas';
    const showCommunity = mode === 'all' || mode === 'comunidad';

    return `
      ${showPrivate ? `
        <div class="erp-table-wrapper" style="margin-bottom: 1.25rem;">
          <div class="erp-table-toolbar">
            <div>
              <strong>Mis Fórmulas Privadas (Por Tienda)</strong>
              <span style="font-size:0.78rem; color:var(--text-muted); margin-left:0.5rem;">Visibles únicamente para tu tienda</span>
            </div>
            <button type="button" class="btn-primary-large" style="font-size:0.8rem;" onclick="window.consoleApp.setModuleSubTab('prospecting', 'constructor')">+ Crear en Constructor</button>
          </div>
          <div class="erp-table-scroll">
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Expresión Sintáctica</th>
                  <th class="num-col">Resultado en Vivo</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                ${this.privateFormulas.length === 0 ? `
                  <tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Sin fórmulas privadas. Crea una en "3. Constructor Visual" o copia una plantilla de "2. Biblioteca Comunidad".</td></tr>
                ` : this.privateFormulas.map(f => {
                  const ev = this.evaluateFormulaExpression(f.expression);
                  return `
                    <tr>
                      <td><strong>${this.escapeHtml(f.name)}</strong></td>
                      <td style="font-size:0.78rem; color:var(--text-muted);">${this.escapeHtml(f.description)}</td>
                      <td><code style="background:#F4F5F2; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${this.escapeHtml(f.expression)}</code></td>
                      <td class="num-col" style="color:var(--accent-1); font-weight:700;">${ev.valid ? formatResult(ev.value, f.unit) : `<span class="erp-status-pill err">${this.escapeHtml(ev.error)}</span>`}</td>
                      <td>
                        <button type="button" class="btn-secondary" style="font-size:0.72rem; padding:0.2rem 0.5rem;" onclick="window.consoleApp.deleteFormula('${f.id}')">Eliminar</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      ${showCommunity ? `
        <div class="erp-table-wrapper" style="margin-bottom: 1.25rem;">
          <div class="erp-table-toolbar">
            <div>
              <strong>Biblioteca de la Comunidad (${this.communityFormulas.length})</strong>
              <span style="font-size:0.78rem; color:var(--text-muted); margin-left:0.5rem;">Plantillas compartidas sin datos de clientes ni ventas</span>
            </div>
          </div>
          <div class="erp-table-scroll">
            <table class="erp-table">
              <thead>
                <tr>
                  <th>Plantilla</th>
                  <th>Autor</th>
                  <th>Descripción</th>
                  <th>Expresión</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                ${this.communityFormulas.map(f => `
                  <tr>
                    <td><strong>${this.escapeHtml(f.name)}</strong></td>
                    <td style="font-size:0.78rem; color:var(--text-muted);">${this.escapeHtml(f.author_name)}</td>
                    <td style="font-size:0.78rem;">${this.escapeHtml(f.description)}</td>
                    <td><code style="background:#F4F5F2; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${this.escapeHtml(f.expression)}</code></td>
                    <td>
                      <button type="button" class="btn-secondary" style="font-size:0.74rem; padding:0.25rem 0.6rem; border-color:var(--accent-1); color:var(--accent-1);" onclick="window.consoleApp.copyCommunityFormula('${f.id}')">Copiar a Mis Fórmulas</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      ${showBuilder ? `
        <div class="erp-table-wrapper">
          <div class="erp-table-toolbar">
            <strong>Constructor Visual de Fórmulas (Validación Sintáctica y Vista Previa)</strong>
            <span class="erp-status-pill ${previewEval.valid ? 'ok' : 'err'}">${previewEval.valid ? 'Sintaxis Válida' : 'Error de Sintaxis'}</span>
          </div>
          <div style="padding: 1.15rem;">
            <div style="display: grid; grid-template-columns: 1.5fr 2fr 0.7fr; gap: 0.75rem; margin-bottom: 1rem;">
              <div>
                <label style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Nombre de Fórmula *</label>
                <input type="text" id="formula-builder-name" class="form-control" value="${this.escapeHtml(this.builderName)}" oninput="window.consoleApp.builderName = this.value" placeholder="Ej: Proyección Ajustada Meta">
              </div>
              <div>
                <label style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Descripción técnica</label>
                <input type="text" id="formula-builder-desc" class="form-control" value="${this.escapeHtml(this.builderDesc)}" oninput="window.consoleApp.builderDesc = this.value" placeholder="Ej: Evalúa meta ponderada con probabilidad...">
              </div>
              <div>
                <label style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Unidad</label>
                <select id="formula-builder-unit" class="form-control" onchange="window.consoleApp.onBuilderUnitChange(this.value)">
                  <option value="COP" ${this.builderUnit === 'COP' ? 'selected' : ''}>COP</option>
                  <option value="%" ${this.builderUnit === '%' ? 'selected' : ''}>%</option>
                  <option value="uds" ${this.builderUnit === 'uds' ? 'selected' : ''}>uds</option>
                </select>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1rem; padding: 0.85rem; background:#F8F9F6; border:1px solid var(--border-subtle); border-radius:6px;">
              <div>
                <div style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.35rem;">Campos disponibles</div>
                <div class="erp-chip-group">
                  ${fields.map(f => `<button type="button" class="erp-chip" onclick="window.consoleApp.insertFormulaToken('${f}')">${f}</button>`).join('')}
                </div>
              </div>
              <div style="display:flex; gap:1.5rem; flex-wrap:wrap;">
                <div>
                  <div style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.35rem;">Operadores</div>
                  <div class="erp-chip-group">
                    ${operators.map(op => `<button type="button" class="erp-chip" onclick="window.consoleApp.insertFormulaToken('${op}')">${op}</button>`).join('')}
                  </div>
                </div>
                <div>
                  <div style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.35rem;">Funciones</div>
                  <div class="erp-chip-group">
                    ${funcs.map(fn => `<button type="button" class="erp-chip active" onclick="window.consoleApp.insertFormulaToken('${fn}')">${fn})</button>`).join('')}
                  </div>
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; align-items: stretch;">
              <div>
                <label style="font-size: 0.74rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Expresión (Validación Sintáctica en Tiempo Real)</label>
                <textarea id="formula-builder-expr" class="form-control" rows="2" oninput="window.consoleApp.onBuilderExprInput(this.value)" style="font-family: monospace; font-size: 0.88rem;">${this.escapeHtml(this.builderExpr)}</textarea>
                <div style="display: flex; gap: 0.75rem; margin-top: 0.55rem; align-items: center; flex-wrap: wrap;">
                  <span style="font-size: 0.74rem; color: var(--text-muted);">Valor referencia <code>VALOR_OPORTUNIDAD</code>:</span>
                  <input type="number" class="form-control" value="${this.builderTestVal}" oninput="window.consoleApp.onBuilderSimChange('val', this.value)" style="width: 120px; font-size: 0.78rem;">
                  <span style="font-size: 0.74rem; color: var(--text-muted);"><code>PROBABILIDAD_ETAPA</code> (%):</span>
                  <input type="number" class="form-control" value="${this.builderTestProb}" min="0" max="100" oninput="window.consoleApp.onBuilderSimChange('prob', this.value)" style="width: 78px; font-size: 0.78rem;">
                </div>
              </div>

              <div id="formula-preview-box" style="background: #FFFFFF; border: 1.5px solid ${previewEval.valid ? 'var(--accent-1)' : 'var(--data-crimson)'}; border-radius: 8px; padding: 0.85rem; display: flex; flex-direction: column; justify-content: center;">
                <div style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: ${previewEval.valid ? 'var(--accent-1)' : 'var(--data-crimson)'};">
                  ${previewEval.valid ? '✓ Validación Correcta • Vista Previa' : '✕ Error de Sintaxis'}
                </div>
                <div id="formula-preview-value" style="font-size: ${previewEval.valid ? '1.35rem' : '0.82rem'}; font-weight: 900; font-family: ${previewEval.valid ? 'monospace' : 'inherit'}; color: ${previewEval.valid ? 'var(--text-main)' : 'var(--data-crimson)'}; margin-top: 0.25rem;">
                  ${previewEval.valid ? formatResult(previewEval.value, this.builderUnit) : this.escapeHtml(previewEval.error)}
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.65rem; margin-top: 1rem; flex-wrap: wrap;">
              <button type="button" class="btn-secondary" onclick="window.consoleApp.saveBuilderFormula('community')" style="font-size: 0.82rem;">
                Compartir Estructura en Comunidad (Sin datos)
              </button>
              <button type="button" class="btn-primary-large" onclick="window.consoleApp.saveBuilderFormula('private')" style="font-size: 0.84rem;">
                Guardar en Mis Fórmulas (Privadas)
              </button>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }

  insertFormulaToken(tok) {
    const input = document.getElementById('formula-builder-expr');
    if (!input) {
      this.builderExpr = `${this.builderExpr} ${tok}`.trim();
      this.updateFormulaPreviewUI();
      return;
    }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const needsSpace = start > 0 && !/\s|\(/.test(input.value[start - 1]);
    const inserted = (needsSpace ? ' ' : '') + tok;
    const nextVal = input.value.slice(0, start) + inserted + input.value.slice(end);
    input.value = nextVal;
    this.builderExpr = nextVal;
    input.focus();
    this.updateFormulaPreviewUI();
  }

  onBuilderExprInput(val) {
    this.builderExpr = val;
    this.updateFormulaPreviewUI();
  }

  onBuilderUnitChange(unit) {
    this.builderUnit = unit;
    this.updateFormulaPreviewUI();
  }

  onBuilderSimChange(kind, val) {
    if (kind === 'val') this.builderTestVal = Number(val) || 0;
    else this.builderTestProb = Number(val) || 0;
    this.updateFormulaPreviewUI();
  }

  updateFormulaPreviewUI() {
    const box = document.getElementById('formula-preview-box');
    const valEl = document.getElementById('formula-preview-value');
    if (!box || !valEl) return;
    const res = this.evaluateFormulaExpression(this.builderExpr);
    box.style.borderColor = res.valid ? 'var(--accent-1)' : 'var(--data-crimson)';
    const titleEl = box.firstElementChild;
    if (titleEl) {
      titleEl.style.color = res.valid ? 'var(--accent-1)' : 'var(--data-crimson)';
      titleEl.textContent = res.valid ? '✓ Validación Correcta • Vista Previa' : '✕ Error de Sintaxis';
    }
    valEl.style.fontSize = res.valid ? '1.35rem' : '0.82rem';
    valEl.style.fontFamily = res.valid ? 'monospace' : 'inherit';
    valEl.style.color = res.valid ? 'var(--text-main)' : 'var(--data-crimson)';
    if (!res.valid) {
      valEl.textContent = res.error;
    } else if (this.builderUnit === '%') {
      valEl.textContent = `${Number(res.value).toFixed(1)}%`;
    } else if (this.builderUnit === 'COP') {
      valEl.textContent = `$${Math.round(Number(res.value)).toLocaleString()} COP`;
    } else {
      valEl.textContent = `${Number(res.value).toLocaleString()} ${this.builderUnit}`;
    }
  }

  async saveBuilderFormula(scope = 'private') {
    const name = (document.getElementById('formula-builder-name')?.value || this.builderName || '').trim();
    const description = (document.getElementById('formula-builder-desc')?.value || this.builderDesc || '').trim() || 'Fórmula personalizada creada con el constructor visual.';
    const expression = (document.getElementById('formula-builder-expr')?.value || this.builderExpr || '').trim();
    const unit = document.getElementById('formula-builder-unit')?.value || this.builderUnit || 'COP';

    if (!name) {
      alert('Escribe un nombre para la fórmula antes de guardarla.');
      return;
    }
    const validation = this.evaluateFormulaExpression(expression);
    if (!validation.valid) {
      alert(`La fórmula tiene un error de validación: ${validation.error}`);
      return;
    }

    try {
      const res = await fetch('/api/crm/formulas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, name, description, expression, unit })
      });
      const data = await res.json();
      if (data.success) {
        this.builderName = '';
        this.builderDesc = '';
        await this.loadFormulas();
        this.showToast(scope === 'private' ? 'Mis Fórmulas' : 'Biblioteca Comunidad', scope === 'private' ? `Fórmula "${name}" guardada en tu espacio privado.` : `Plantilla "${name}" compartida en Comunidad sin datos privados.`, 'success');
        if (this.moduleSubTabs) {
          this.moduleSubTabs['prospecting'] = scope === 'private' ? 'mis_formulas' : 'comunidad';
        }
        if (this.activeModuleId === 'crm-pipeline' || this.activeModuleId === 'prospecting') {
          this.openModuleFull(this.activeModuleId, false);
        }
      }
    } catch (e) {}
  }

  async copyCommunityFormula(formulaId) {
    try {
      const res = await fetch(`/api/crm/formulas/${formulaId}/copy`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await this.loadFormulas();
        this.showToast('Copiada a Mis Fórmulas', `"${data.formula.name}" fue copiada a tu espacio privado.`, 'success');
        if (this.moduleSubTabs) {
          this.moduleSubTabs['prospecting'] = 'mis_formulas';
        }
        if (this.activeModuleId === 'crm-pipeline' || this.activeModuleId === 'prospecting') {
          this.openModuleFull(this.activeModuleId, false);
        }
      }
    } catch (e) {}
  }

  async deleteFormula(formulaId) {
    if (!confirm('¿Eliminar esta fórmula privada de tu espacio?')) return;
    try {
      const res = await fetch(`/api/crm/formulas/${formulaId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await this.loadFormulas();
        if (this.activeModuleId === 'crm-pipeline' || this.activeModuleId === 'prospecting') {
          this.openModuleFull(this.activeModuleId, false);
        }
      }
    } catch (e) {}
  }

  // --- Drawer & Navigation ---
  bindDrawerEvents() {
    const closeBtn = document.getElementById('drawer-close-btn');
    const backdrop = document.getElementById('drawer-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeDrawer());
    if (backdrop) backdrop.addEventListener('click', () => this.closeDrawer());

    const openFullBtn = document.getElementById('btn-drawer-open-full');
    if (openFullBtn) {
      openFullBtn.addEventListener('click', () => {
        this.closeDrawer();
        this.openModuleFull(this.activeModuleId, true);
      });
    }

    const collapseBtn = document.getElementById('sidebar-collapse-toggle');
    const sidebar = document.getElementById('console-sidebar');
    if (collapseBtn && sidebar) {
      collapseBtn.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
          sidebar.classList.remove('mobile-open');
        } else {
          sidebar.classList.toggle('collapsed');
        }
      });
    }

    const mobileBtn = document.getElementById('mobile-menu-toggle');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('mobile-open');
      });

      document.addEventListener('click', (e) => {
        if (window.innerWidth <= 900 && sidebar.classList.contains('mobile-open')) {
          if (!sidebar.contains(e.target) && !mobileBtn.contains(e.target)) {
            sidebar.classList.remove('mobile-open');
          }
        }
      });
    }
  }

  bindGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const sidebar = document.getElementById('console-sidebar');
        if (sidebar) sidebar.classList.remove('mobile-open');
        this.closeDrawer();
        this.closeExcelModal();
        this.closeAdminProdModal();
        this.closeInventoryExcelModal();
        this.closeShipmentEvalModal();
        this.closeStagesConfigModal();
        this.closePurchaseRecordModal();
      }
    });
  }

  openDrawer(moduleId) {
    const mod = this.modulesRegistry.find(m => m.id === moduleId);
    if (!mod) return;

    const drawer = document.getElementById('sliding-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    if (!drawer || !backdrop) return;

    document.getElementById('drawer-station-badge').textContent = mod.stationName;
    document.getElementById('drawer-module-title').textContent = mod.fullName;
    document.getElementById('drawer-module-desc').textContent = mod.summary;

    const kpisBox = document.getElementById('drawer-kpis-container');
    if (kpisBox) {
      kpisBox.innerHTML = (mod.kpis || []).map(k => `
        <div class="drawer-kpi-item">
          <span class="drawer-kpi-val">${k.value}</span>
          <span class="drawer-kpi-lbl">${k.label}</span>
        </div>
      `).join('');
    }

    const subBox = document.getElementById('drawer-subsections-container');
    if (subBox) {
      subBox.innerHTML = (mod.subsections || []).map(s => `
        <div class="drawer-sub-item">
          <span>•</span>
          <span>${s}</span>
        </div>
      `).join('');
    }

    backdrop.classList.add('open');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    this.isDrawerOpen = true;
  }

  closeDrawer() {
    const drawer = document.getElementById('sliding-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    if (drawer) {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) backdrop.classList.remove('open');
    this.isDrawerOpen = false;
  }

  // --- Other Interactive Module Handlers ---
  filterProspectsList() {
    const input = document.getElementById('prospect-search-input');
    const term = (input ? input.value : '').trim().toLowerCase();
    const container = document.getElementById('prospects-table-container');
    if (!container) return;

    const directory = [
      { name: "Andina Logistics & E-com", person: "Andrés Montoya", phone: "+57 311 889 0011", value: 18000000, sector: "Mayoristas / Logística", emp: "25-50", score: "96%" },
      { name: "NovaStore Retail Colombia", person: "Paola Herrera", phone: "+57 321 776 5544", value: 9500000, sector: "Retail / Calzado & Gadgets", emp: "10-20", score: "92%" },
      { name: "BioHealth Distribuciones", person: "Carlos Vives", phone: "+57 300 456 7890", value: 14200000, sector: "Salud / Bienestar", emp: "15-30", score: "94%" },
      { name: "DropiTech Solutions", person: "Valeria Duque", phone: "+57 318 654 3210", value: 22000000, sector: "Dropshipping / Tecnología", emp: "30-60", score: "98%" }
    ];

    const results = term ? directory.filter(d => d.name.toLowerCase().includes(term) || d.sector.toLowerCase().includes(term)) : directory;

    if (results.length === 0) {
      container.innerHTML = `
        <div class="empty-state-card" style="background: var(--bg-dark); border: 1px dashed var(--border-subtle); border-radius: 12px; padding: 2.5rem 1.5rem; text-align: center;">
          <div style="font-size: 1rem; color: var(--text-main); margin-bottom: 0.35rem; font-weight: 700;">No se encontraron prospectos para "${term}"</div>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Prueba con términos como 'Mayoristas', 'Retail', 'Salud' o 'Dropshipping'.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="erp-table">
        <thead>
          <tr>
            <th>Empresa / Razón Social</th>
            <th>Contacto Principal</th>
            <th>Sector</th>
            <th>Tamaño</th>
            <th class="num-col">Valor Potencial (COP)</th>
            <th class="num-col">Afinidad</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(item => `
            <tr>
              <td><strong>${this.escapeHtml(item.name)}</strong></td>
              <td>${this.escapeHtml(item.person)}<br><span style="font-size:0.74rem; color:var(--text-muted);">${this.escapeHtml(item.phone)}</span></td>
              <td>${this.escapeHtml(item.sector)}</td>
              <td>${this.escapeHtml(item.emp)} emp.</td>
              <td class="num-col">$${Number(item.value).toLocaleString('es-CO')}</td>
              <td class="num-col"><span class="erp-status-pill ok">${item.score}</span></td>
              <td>
                <button type="button" class="btn-secondary" style="font-size:0.74rem; padding:0.25rem 0.6rem; border-color:var(--accent-1);" onclick="window.consoleApp.importProspectToCRM('${item.name}', '${item.person}', '${item.phone}', ${item.value})">+ Importar a CRM</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  async importProspectToCRM(company, person, phone, val) {
    const newContact = {
      name: company,
      contactPerson: person,
      phone: phone,
      email: `${person.toLowerCase().replace(/\s+/g, '.')}@${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.co`,
      company: company,
      stage: "negotiation",
      value: val,
      cost: val * 0.5,
      tags: ["Prospecting-Tool", "Verificado"],
      attribution: "EasyGrow Prospecting Tool"
    };

    await window.EasyGrowCRM.create(newContact);
    await this.loadMetrics();
    this.showToast('✓ Prospecto Importado', `${company} agregado a tu etapa de Negociación.`, 'success');
  }

  // =====================================================================
  // Estación 03 Handlers: Google Forms, Clasificación y QRs Dinámicos
  // =====================================================================

  async copyStation3Text(text, label = 'Texto') {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
      this.showToast('📋 Copiado', `${label} copiado al portapapeles.`, 'success');
    } catch (e) {
      this.showToast('📋 Listo para copiar', `${label}: ${text}`, 'info');
    }
  }

  copyGFormsEmbed() {
    const code = document.getElementById('gforms-embed-code')?.textContent || '';
    this.copyStation3Text(code, 'Código <iframe> para web');
  }

  async saveGoogleFormConfig(mode = 'link') {
    const formTitle = document.getElementById('gforms-title-input')?.value.trim() || 'Formulario Google Forms — Captación EasyGrow';
    const googleFormUrl = document.getElementById('gforms-url-input')?.value.trim() || '';

    if (mode === 'link' && !googleFormUrl) {
      alert('Pega la URL de tu Google Form o usa "Autocrear Plantilla Google Forms".');
      return;
    }

    try {
      const res = await fetch('/api/station3/forms/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, formTitle, googleFormUrl })
      });
      const data = await res.json();
      if (data.success) {
        await this.loadStation3Workspace();
        this.showToast(
          mode === 'autocreate' ? '⚡ Google Form Autocreado' : '🔗 Google Form Vinculado',
          'Enlace compartible y código embed web listos para usar.',
          'success'
        );
        this.openModuleFull('forms-surveys', false);
      }
    } catch (e) {}
  }

  async addFormRule() {
    const categoryName = document.getElementById('new-rule-category')?.value.trim();
    const keywords = document.getElementById('new-rule-keywords')?.value.trim();
    if (!categoryName || !keywords) {
      alert('Indica el nombre de la categoría y al menos una palabra clave del requerimiento.');
      return;
    }

    try {
      const res = await fetch('/api/station3/forms/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryName, keywords })
      });
      const data = await res.json();
      if (data.success) {
        await this.loadStation3Workspace();
        this.showToast('✓ Regla Guardada', `Regla "${categoryName}" aplicada a tus respuestas.`, 'success');
        this.openModuleFull('forms-surveys', false);
      }
    } catch (e) {}
  }

  async deleteFormRule(ruleId) {
    try {
      const res = await fetch(`/api/station3/forms/rules/${ruleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await this.loadStation3Workspace();
        this.showToast('Regla Eliminada', 'Se actualizaron las clasificaciones pendientes.', 'info');
        this.openModuleFull('forms-surveys', false);
      }
    } catch (e) {}
  }

  async aiOrganizeFormSubmissions() {
    try {
      const res = await fetch('/api/station3/forms/ai-organize', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await this.loadStation3Workspace();
        const createdCnt = (data.createdRules || []).length;
        this.showToast(
          '🤖 Apoyo IA Aplicado',
          `Se analizaron ${data.totalAnalyzed} respuestas, se ordenaron ${data.updatedRows} filas y se sugirieron ${createdCnt} categorías para tu análisis humano.`,
          'success'
        );
        this.openModuleFull('forms-surveys', false);
      }
    } catch (e) {}
  }

  fillFormSubmissionSample(type) {
    const nameEl = document.getElementById('gf-sub-name');
    const contactEl = document.getElementById('gf-sub-contact');
    const reqEl = document.getElementById('gf-sub-req');

    const samples = {
      mayorista: {
        name: 'Comercializadora Andina S.A.S.',
        contact: 'compras@andinacomercial.co / 315 440 8899',
        req: 'Solicitamos lista de precios mayorista para pedido inicial de 60 unidades (lote mixto) con entrega en Medellín.'
      },
      catalogo: {
        name: 'Camila Orrego',
        contact: 'camila.orrego@correo.co / 300 712 4510',
        req: 'Quiero cotizar precios del catálogo Dropi y saber cuánto tarda el envío contraentrega a Bogotá.'
      },
      especial: {
        name: 'Ferretería El Progreso',
        contact: 'soporte@elprogreso.co / 320 988 1204',
        req: 'Requerimiento especial: necesitamos empaque personalizado, factura electrónica urgente y detalle de garantía de fábrica.'
      }
    };

    const pick = samples[type] || samples.mayorista;
    if (nameEl) nameEl.value = pick.name;
    if (contactEl) contactEl.value = pick.contact;
    if (reqEl) reqEl.value = pick.req;
  }

  async submitGoogleFormResponse() {
    const respondentName = document.getElementById('gf-sub-name')?.value.trim();
    const respondentContact = document.getElementById('gf-sub-contact')?.value.trim() || '';
    const createdDate = document.getElementById('gf-sub-date')?.value;
    const createdTime = document.getElementById('gf-sub-time')?.value;
    const requirementText = document.getElementById('gf-sub-req')?.value.trim();

    if (!respondentName || !requirementText) {
      alert('Ingresa el nombre del remitente y el requerimiento solicitado en el Google Form.');
      return;
    }

    try {
      const res = await fetch('/api/station3/forms/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respondentName,
          respondentContact,
          createdDate,
          createdTime,
          requirementText,
          sourceChannel: 'Google Forms (Enlace Directo)'
        })
      });
      const data = await res.json();
      if (data.success) {
        await this.loadStation3Workspace();
        if (this.moduleSubTabs) this.moduleSubTabs['forms-surveys'] = 'respuestas';
        this.showToast(
          '📥 Respuesta Clasificada',
          `${data.submission.created_date} ${data.submission.created_time} → "${data.submission.matched_category}" (Lista para análisis humano).`,
          'success'
        );
        this.openModuleFull('forms-surveys', false);
      }
    } catch (e) {}
  }

  async saveHumanReview(subId) {
    const matchedCategory = document.getElementById(`sub-cat-${subId}`)?.value;
    const humanStatus = document.getElementById(`sub-status-${subId}`)?.value;
    const humanNotes = document.getElementById(`sub-notes-${subId}`)?.value || '';

    try {
      const res = await fetch(`/api/station3/forms/submissions/${subId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchedCategory, humanStatus, humanNotes })
      });
      const data = await res.json();
      if (data.success) {
        await this.loadStation3Workspace();
        this.showToast('💾 Análisis Humano Guardado', `Estado actualizado a "${humanStatus}".`, 'success');
        this.openModuleFull('forms-surveys', false);
      }
    } catch (e) {}
  }

  async sendReviewedRowToCRM(subId) {
    const sub = this.formSubmissions.find(s => s.id === subId);
    if (!sub) return;
    const category = document.getElementById(`sub-cat-${subId}`)?.value || sub.matched_category;

    const newContact = {
      name: sub.respondent_name,
      contactPerson: sub.respondent_name,
      phone: sub.respondent_contact || '',
      email: sub.respondent_contact && sub.respondent_contact.includes('@') ? sub.respondent_contact : '',
      company: sub.respondent_name,
      stage: 'prospects',
      value: 0,
      cost: 0,
      tags: ['Google-Forms', category],
      attribution: sub.source_channel || 'Estación 03 Google Forms'
    };

    await window.EasyGrowCRM.create(newContact);
    await this.loadMetrics();
    this.showToast('✓ Ficha Creada en CRM', `"${sub.respondent_name}" agregado como prospecto tras revisión humana.`, 'success');
  }

  exportFormSubmissionsToExcel() {
    if (!this.formSubmissions || this.formSubmissions.length === 0) {
      alert('No hay respuestas en la tabla para exportar todavía.');
      return;
    }

    const rows = this.formSubmissions.map(s => ({
      'Fecha Creación': s.created_date,
      'Hora Exacta': s.created_time,
      'Remitente': s.respondent_name,
      'Contacto': s.respondent_contact || '',
      'Canal / QR Origen': s.source_channel,
      'Requerimiento Pedido': s.requirement_text,
      'Clasificación (Regla Usuario)': s.matched_category,
      'Sugerencia IA (Apoyo)': s.ai_suggested_category,
      'Estado Revisión Humana': s.human_status,
      'Notas Análisis Humano': s.human_notes || ''
    }));

    const fileStamp = new Date().toISOString().slice(0, 10);
    if (typeof window.XLSX !== 'undefined') {
      const ws = window.XLSX.utils.json_to_sheet(rows);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Analisis_Humano_Forms');
      window.XLSX.writeFile(wb, `EasyGrow_GoogleForms_Clasificado_${fileStamp}.xlsx`);
      this.showToast('📊 Excel Generado (.xlsx)', `${rows.length} respuestas clasificadas exportadas para análisis humano.`, 'success');
      return;
    }

    // Fallback CSV con BOM UTF-8 compatible con Excel
    const headers = Object.keys(rows[0]);
    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      headers.map(escapeCsv).join(';'),
      ...rows.map(r => headers.map(h => escapeCsv(r[h])).join(';'))
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EasyGrow_GoogleForms_Clasificado_${fileStamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('📊 Tabla Exportada (.csv)', `${rows.length} respuestas descargadas para abrir en Excel.`, 'success');
  }

  buildDeterministicQRPatternSvg(slug, domId = '') {
    const str = String(slug || 'EASYGROW');
    let seed = 2166136261;
    for (let i = 0; i < str.length; i++) {
      seed ^= str.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }

    const size = 21;
    const cell = 6;
    const pad = 12;
    const total = size * cell + pad * 2;
    const rects = [];

    const drawFinder = (ox, oy) => {
      rects.push(`<rect x="${pad + ox * cell}" y="${pad + oy * cell}" width="${7 * cell}" height="${7 * cell}" fill="#111111"/>`);
      rects.push(`<rect x="${pad + (ox + 1) * cell}" y="${pad + (oy + 1) * cell}" width="${5 * cell}" height="${5 * cell}" fill="#FFFFFF"/>`);
      rects.push(`<rect x="${pad + (ox + 2) * cell}" y="${pad + (oy + 2) * cell}" width="${3 * cell}" height="${3 * cell}" fill="#111111"/>`);
    };

    drawFinder(0, 0);
    drawFinder(size - 7, 0);
    drawFinder(0, size - 7);

    const inFinder = (x, y) => (
      (x < 8 && y < 8) ||
      (x >= size - 8 && y < 8) ||
      (x < 8 && y >= size - 8)
    );

    let s = seed >>> 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (inFinder(x, y)) continue;
        if (x >= 9 && x <= 11 && y >= 9 && y <= 11) continue;
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        if ((s & 1) === 1) {
          rects.push(`<rect x="${pad + x * cell}" y="${pad + y * cell}" width="${cell}" height="${cell}" fill="#111111"/>`);
        }
      }
    }

    // Centro identificador verde EasyGrow
    const center = pad + 9 * cell;
    rects.push(`<rect x="${center}" y="${center}" width="${3 * cell}" height="${3 * cell}" rx="4" fill="#1FA866"/>`);
    rects.push(`<circle cx="${center + 1.5 * cell}" cy="${center + 1.5 * cell}" r="${cell * 0.55}" fill="#FFFFFF"/>`);

    return `<svg ${domId ? `id="${domId}"` : ''} xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 ${total} ${total}">${rects.join('')}</svg>`;
  }

  downloadQRCodeSvg(qrId, slug) {
    const svgContent = this.buildDeterministicQRPatternSvg(slug);
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'EasyGrow_QR'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('🖨️ QR Listo para Impresión', `Archivo SVG de ${slug} descargado. Su destino puede cambiar luego sin reimprimirlo.`, 'success');
  }

  async createDynamicQR() {
    const name = document.getElementById('new-qr-name')?.value.trim();
    const placement = document.getElementById('new-qr-placement')?.value || 'Empaque de Producto';
    const campaign = document.getElementById('new-qr-campaign')?.value.trim();
    const destType = document.getElementById('new-qr-dest-type')?.value || 'google_form';
    const targetUrl = document.getElementById('new-qr-url')?.value.trim();

    if (!name || !campaign || !targetUrl) {
      alert('Completa el nombre, campaña y URL de destino del QR dinámico.');
      return;
    }

    try {
      const res = await fetch('/api/station3/qrs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, placement, campaign, destType, targetUrl })
      });
      const data = await res.json();
      if (data.success) {
        await this.loadStation3Workspace();
        if (this.moduleSubTabs) this.moduleSubTabs['qr-generator'] = 'directorio';
        this.showToast('✓ QR Dinámico Generado', `"${name}" (${data.qr.code_slug}) creado y listo para imprimir.`, 'success');
        this.openModuleFull('qr-generator', false);
      }
    } catch (e) {}
  }

  onQrDestTypePresetChange(qrId, destType) {
    const urlEl = document.getElementById(`qr-url-${qrId}`);
    if (!urlEl) return;
    const cfgUrl = (this.station3Config && this.station3Config.google_form_url) || 'https://docs.google.com/forms/d/e/1FAIpQLSeEG_form/viewform';
    if (destType === 'google_form') urlEl.value = cfgUrl;
    else if (destType === 'product') urlEl.value = 'https://easygrow.co/catalogo-dropi';
    else if (destType === 'whatsapp') urlEl.value = 'https://wa.me/573001112233?text=Hola%20quiero%20informacion';
  }

  async updateQRDestination(qrId) {
    const destType = document.getElementById(`qr-dest-type-${qrId}`)?.value;
    const targetUrl = document.getElementById(`qr-url-${qrId}`)?.value.trim();
    const campaign = document.getElementById(`qr-campaign-${qrId}`)?.value.trim();

    if (!targetUrl) {
      alert('Indica la URL de redirección del QR.');
      return;
    }

    try {
      const res = await fetch(`/api/station3/qrs/${qrId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destType, targetUrl, campaign })
      });
      const data = await res.json();
      if (data.success) {
        await this.loadStation3Workspace();
        this.showToast('🔄 Destino Actualizado sin Reimprimir', `El mismo QR ${data.qr.code_slug} ahora redirige a ${targetUrl}.`, 'success');
        this.openModuleFull('qr-generator', false);
      }
    } catch (e) {}
  }

  async simulateAnonymousQRScan(qrId) {
    try {
      const res = await fetch(`/api/station3/qrs/${qrId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isUnique: true, identifiedSubmission: false })
      });
      const data = await res.json();
      if (data.success) {
        await this.loadStation3Workspace();
        this.showToast('📱 Escaneo Anónimo Registrado', `${data.qr.code_slug} sumó +1 escaneo (${data.qr.last_scan_at}) sin identificar persona.`, 'info');
        this.openModuleFull('qr-generator', false);
      }
    } catch (e) {}
  }

  toggleQRQuickForm(qrId) {
    this.openQuickFormQrId = this.openQuickFormQrId === qrId ? null : qrId;
    this.openModuleFull('qr-generator', false);
  }

  async submitQRIdentifiedForm(qrId) {
    const respondentName = document.getElementById(`qr-qf-name-${qrId}`)?.value.trim();
    const respondentContact = document.getElementById(`qr-qf-contact-${qrId}`)?.value.trim() || '';
    const requirementText = document.getElementById(`qr-qf-req-${qrId}`)?.value.trim();

    if (!respondentName || !requirementText) {
      alert('Para identificar a la persona que escaneó el QR, debe completar su nombre y requerimiento en el formulario.');
      return;
    }

    try {
      const res = await fetch(`/api/station3/qrs/${qrId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isUnique: true,
          identifiedSubmission: true,
          respondentName,
          respondentContact,
          requirementText
        })
      });
      const data = await res.json();
      if (data.success) {
        this.openQuickFormQrId = null;
        await this.loadStation3Workspace();
        this.showToast('📝 QR + Google Form Vinculados', `Escaneo contado e ingreso clasificado de "${respondentName}" enviado a la tabla de análisis humano.`, 'success');
        this.openModuleFull('qr-generator', false);
      }
    } catch (e) {}
  }

  testIntentSample(text) {
    const input = document.getElementById('intent-sample-input');
    if (input) input.value = text;
    this.testIntentClassification();
  }

  testIntentClassification() {
    const text = document.getElementById('intent-sample-input')?.value;
    const resDiv = document.getElementById('intent-result-display');
    if (!resDiv) return;

    const analysis = window.EasyGrowCRM.analyzeIntent(text);
    resDiv.style.display = 'block';
    resDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span style="font-weight: 700; color: ${analysis.color}; font-size: 1rem;">
          Clasificación Orbe IA: ${analysis.label}
        </span>
        <span class="topbar-metrics-pill" style="color: ${analysis.color}; border-color: ${analysis.color};">
          Score: ${(analysis.score * 100).toFixed(0)}%
        </span>
      </div>
      <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
        Mensaje evaluado: <em>"${text}"</em>. El orbe categorizó semánticamente esta consulta como <b>${analysis.classification}</b>.
      </p>
    `;
  }

  // =====================================================================
  // Estación 04 Handlers: WhatsApp Embedded Signup v4, Calling API, Bandeja WA/IG/FB, Orbe IA y Calendario
  // =====================================================================

  updateMissedCallPreview(val) {
    const clean = String(val || '');
    const b1 = document.getElementById('ct-missed-preview-bubble');
    const b2 = document.getElementById('wa-missed-preview-bubble');
    if (b1) b1.textContent = clean;
    if (b2) b2.textContent = clean;
  }

  async saveMissedCallSettings(prefix = 'wa-') {
    const enabledEl = document.getElementById(`${prefix}missed-enabled`);
    const modeEl = document.getElementById(`${prefix}reply-mode`);
    const msgEl = document.getElementById(`${prefix}missed-msg`);
    const tplNameEl = document.getElementById(`${prefix}template-name`);
    const tplLangEl = document.getElementById(`${prefix}template-lang`);

    try {
      const res = await fetch('/api/whatsapp/missed-call-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missedCallEnabled: Boolean(enabledEl && enabledEl.checked),
          replyMode: modeEl ? modeEl.value : 'auto_window_or_template',
          messageText: msgEl ? msgEl.value.trim() : '',
          templateName: tplNameEl ? tplNameEl.value.trim() : 'easygrow_missed_call_followup',
          templateLang: tplLangEl ? tplLangEl.value.trim() : 'es'
        })
      });
      const data = await res.json();
      await this.loadWhatsAppConfig();
      if (!data.success) {
        this.showToast('⚠️ Elegibilidad Calling API', data.error || 'No es posible activar seguimiento de llamadas.', 'warn');
        if (['whatsapp-integrations', 'call-tracking'].includes(this.activeModuleId)) {
          this.openModuleFull(this.activeModuleId, false);
        }
        return;
      }
      this.showToast('✓ Reglas Guardadas', 'Configuración de mensaje WhatsApp ante llamada perdida actualizada.', 'success');
      if (['whatsapp-integrations', 'call-tracking'].includes(this.activeModuleId)) {
        this.openModuleFull(this.activeModuleId, false);
      }
    } catch (e) {}
  }

  loadMetaFacebookSdk(appId, version = 'v21.0') {
    return new Promise((resolve, reject) => {
      if (window.FB && typeof window.FB.login === 'function') {
        resolve(window.FB);
        return;
      }
      window.fbAsyncInit = function () {
        window.FB.init({
          appId,
          autoLogAppEvents: true,
          xfbml: true,
          version
        });
        resolve(window.FB);
      };
      const existing = document.getElementById('facebook-jssdk');
      if (existing) {
        existing.remove();
      }
      const js = document.createElement('script');
      js.id = 'facebook-jssdk';
      js.src = 'https://connect.facebook.net/es_LA/sdk.js';
      js.async = true;
      js.defer = true;
      js.onerror = () => reject(new Error('No se pudo cargar el SDK oficial de Meta desde connect.facebook.net.'));
      document.head.appendChild(js);
    });
  }

  async connectWhatsAppEmbeddedSignup() {
    try {
      const startRes = await fetch('/api/whatsapp/embedded-signup/start', { method: 'POST' });
      const startData = await startRes.json();

      if (!startData.success) {
        await this.loadWhatsAppConfig();
        const missingKeys = (startData.missingConfig || []).map(m => m.key).join(', ');
        this.showToast(
          '⚠️ Configuración Meta Pendiente',
          `${startData.error}${missingKeys ? ` Faltan: ${missingKeys}` : ''}`,
          'warn'
        );
        if (this.activeModuleId === 'whatsapp-integrations') {
          this.openModuleFull('whatsapp-integrations', false);
        }
        return;
      }

      const { appId, configId, graphApiVersion } = startData.publicClientConfig || {};
      await this.loadWhatsAppConfig();
      if (this.activeModuleId === 'whatsapp-integrations') {
        this.openModuleFull('whatsapp-integrations', false);
      }

      const FB = await this.loadMetaFacebookSdk(appId, graphApiVersion || 'v21.0');
      let capturedMetaIds = { wabaId: '', phoneNumberId: '' };

      const sessionListener = (event) => {
        if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return;
        try {
          const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (msg && msg.type === 'WA_EMBEDDED_SIGNUP' && msg.event === 'FINISH' && msg.data) {
            capturedMetaIds.wabaId = msg.data.waba_id || '';
            capturedMetaIds.phoneNumberId = msg.data.phone_number_id || '';
          }
        } catch (err) {}
      };
      window.addEventListener('message', sessionListener);

      FB.login((response) => {
        window.removeEventListener('message', sessionListener);
        if (response && response.authResponse && response.authResponse.code) {
          fetch('/api/whatsapp/embedded-signup/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: response.authResponse.code,
              wabaId: capturedMetaIds.wabaId,
              phoneNumberId: capturedMetaIds.phoneNumberId
            })
          })
            .then(r => r.json())
            .then(async (completeData) => {
              await this.loadWhatsAppConfig();
              if (completeData.success) {
                this.showToast('✓ WhatsApp Conectado', `Número ${completeData.integration.display_phone_number} vinculado con Meta Embedded Signup v4.`, 'success');
              } else {
                this.showToast('⚠️ Requiere Atención', completeData.error || 'No se pudo completar el alta en Meta.', 'warn');
              }
              if (this.activeModuleId === 'whatsapp-integrations') {
                this.openModuleFull('whatsapp-integrations', false);
              }
            });
        } else {
          this.loadWhatsAppConfig().then(() => {
            this.showToast('Conexión Cancelada', 'El usuario canceló o no autorizó Meta Embedded Signup v4.', 'warn');
          });
        }
      }, {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3'
        }
      });
    } catch (e) {
      this.showToast('⚠️ Error de Conexión', e.message || 'No se pudo iniciar Meta Embedded Signup v4.', 'warn');
    }
  }

  async testWhatsAppConnection() {
    try {
      const res = await fetch('/api/whatsapp/test-connection', { method: 'POST' });
      const data = await res.json();
      await this.loadWhatsAppConfig();
      if (data.success) {
        this.showToast('✓ Conexión Verificada', 'Meta Graph API confirmó el estado activo del número empresarial.', 'success');
      } else {
        this.showToast('⚠️ Prueba de Conexión', data.error || 'La cuenta no está conectada o requiere atención.', 'warn');
      }
      if (this.activeModuleId === 'whatsapp-integrations') {
        this.openModuleFull('whatsapp-integrations', false);
      }
    } catch (e) {}
  }

  async disconnectWhatsApp() {
    if (!confirm('¿Desconectar el número de WhatsApp Business de esta tienda y eliminar sus credenciales cifradas?')) return;
    try {
      const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await this.loadWhatsAppConfig();
        this.showToast('WhatsApp Desconectado', 'Credenciales eliminadas y estado actualizado a Desconectado.', 'info');
        if (this.activeModuleId === 'whatsapp-integrations') {
          this.openModuleFull('whatsapp-integrations', false);
        }
      }
    } catch (e) {}
  }

  toggleInboxCalendarDrawer() {
    this.showInboxCalendarDrawer = !this.showInboxCalendarDrawer;
    this.openModuleFull('unified-inbox', false);
  }

  openCalendarWithContact(contactName) {
    this.showInboxCalendarDrawer = true;
    this.openModuleFull('unified-inbox', false);
    setTimeout(() => {
      const el = document.getElementById('cal-contact-name');
      if (el && contactName) el.value = contactName;
    }, 180);
  }

  async createCalendarAppointment(contactId = '') {
    const title = document.getElementById('cal-title')?.value.trim();
    const contactName = document.getElementById('cal-contact-name')?.value.trim() || 'Seguimiento';
    const scheduledDate = document.getElementById('cal-date')?.value;
    const scheduledTime = document.getElementById('cal-time')?.value;
    const channel = document.getElementById('cal-channel')?.value || 'WhatsApp';

    if (!title || !scheduledDate || !scheduledTime) {
      alert('Indica título, fecha y hora para agendar en el calendario.');
      return;
    }

    try {
      const res = await fetch('/api/inbox/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, contactName, title, scheduledDate, scheduledTime, channel })
      });
      const data = await res.json();
      if (data.success) {
        await this.loadInboxWorkspace();
        this.showToast('📅 Cita Agendada', `"${title}" guardada para el ${scheduledDate} a las ${scheduledTime}.`, 'success');
        const targetMod = this.activeModuleId === 'operational-calendar' ? 'operational-calendar' : 'unified-inbox';
        this.openModuleFull(targetMod, false);
      }
    } catch (e) {}
  }

  async deleteCalendarAppointment(apptId) {
    try {
      const res = await fetch(`/api/inbox/calendar/${apptId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await this.loadInboxWorkspace();
        const targetMod = this.activeModuleId === 'operational-calendar' ? 'operational-calendar' : 'unified-inbox';
        this.openModuleFull(targetMod, false);
      }
    } catch (e) {}
  }

  toggleInboxIncomingModal() {
    this.showInboxIncomingModal = !this.showInboxIncomingModal;
    this.openModuleFull('unified-inbox', false);
  }

  async submitTestIncomingInboxMessage() {
    const channel = document.getElementById('inb-test-channel')?.value || 'whatsapp';
    const senderName = document.getElementById('inb-test-name')?.value.trim();
    const senderPhone = document.getElementById('inb-test-phone')?.value.trim() || '';
    const body = document.getElementById('inb-test-body')?.value.trim();

    if (!senderName || !body) {
      alert('Ingresa el nombre del cliente y el contenido del mensaje entrante.');
      return;
    }

    try {
      const res = await fetch('/api/inbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, direction: 'incoming', senderName, senderPhone, body })
      });
      const data = await res.json();
      if (data.success) {
        this.showInboxIncomingModal = false;
        this.selectedInboxContactId = data.message.contact_id;
        await this.loadInboxWorkspace();
        await window.EasyGrowCRM.syncWithServer(false);
        this.showToast('🤖 Orbe IA Clasificó Mensaje', `Intención "${data.message.intent_label}". Borrador listo para aprobación humana.`, 'info');
        this.openModuleFull('unified-inbox', false);
      }
    } catch (e) {}
  }

  copyAISuggestionToComposer(msgId) {
    const txt = document.getElementById(`ai-draft-${msgId}`)?.value || '';
    const input = document.getElementById('chat-reply-input');
    if (input) {
      input.value = txt;
      input.focus();
    }
  }

  async approveAndSendAISuggestion(msgId) {
    const editedReply = document.getElementById(`ai-draft-${msgId}`)?.value.trim();
    if (!editedReply) {
      alert('El mensaje aprobado no puede estar vacío.');
      return;
    }

    try {
      const res = await fetch(`/api/inbox/messages/${msgId}/approve-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editedReply })
      });
      const data = await res.json();
      if (data.success) {
        await this.loadInboxWorkspace();
        const del = data.deliveryResult || {};
        this.showToast(
          '✓ Aprobado y Enviado',
          del.sentLive
            ? 'Respuesta enviada oficialmente por Meta WhatsApp API.'
            : `Respuesta aprobada por humano y registrada (${del.deliveryStatus || 'canal pendiente de conexión Meta'}).`,
          del.sentLive ? 'success' : 'info'
        );
        this.openModuleFull('unified-inbox', false);
      }
    } catch (e) {}
  }

  async discardAISuggestion(msgId) {
    try {
      const res = await fetch(`/api/inbox/messages/${msgId}/discard-ai`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await this.loadInboxWorkspace();
        this.openModuleFull('unified-inbox', false);
      }
    } catch (e) {}
  }

  selectInboxContact(contactId) {
    this.selectedInboxContactId = contactId;
    this.openModuleFull('unified-inbox', false);
  }

  setInboxFilter(filter) {
    this.inboxChannelFilter = filter;
    this.openModuleFull('unified-inbox', false);
  }

  async sendInboxReply(contactId = null) {
    const input = document.getElementById('chat-reply-input');
    const text = input ? input.value.trim() : '';
    const targetContactId = contactId || this.selectedInboxContactId;
    const channel = document.getElementById('inbox-send-channel')?.value || 'whatsapp';
    if (!text || !targetContactId) return;

    try {
      const res = await fetch('/api/inbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: targetContactId,
          channel,
          direction: 'outgoing',
          body: text
        })
      });
      const data = await res.json();
      if (data.success) {
        await this.loadInboxWorkspace();
        if (input) input.value = '';
        this.openModuleFull('unified-inbox', false);
      }
    } catch (e) {}
  }

  // =====================================================================
  // Estación 05 Handlers: Parrilla IG/FB/TikTok, Campañas Ads, Permisos,
  // Atribución Checkout y SEO Search Console
  // =====================================================================

  async updateStation5Settings(updates) {
    try {
      const res = await fetch('/api/station5/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        await this.loadStation5Workspace();
        this.showToast('⚙️ Configuración Guardada', 'Preferencias de marketing y atribución actualizadas.', 'success');
        if (['social-planner', 'ad-manager', 'seo-analytics'].includes(this.activeModuleId)) {
          this.openModuleFull(this.activeModuleId, false);
        }
      }
    } catch (e) {}
  }

  async marketingProviderAction(provider, mode) {
    try {
      const actorEmail = this.activeCollaboratorEmail || (this.currentUser && this.currentUser.email) || '';
      const res = await fetch(`/api/station5/integrations/${provider}/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorEmail })
      });
      const data = await res.json();
      await this.loadStation5Workspace();
      if (!data.success) {
        const missing = (data.missingRequirements || []).join(', ');
        this.showToast(
          '⚠️ Integración Requiere Configuración',
          `${data.error}${missing ? ` (${missing})` : ''}`,
          'warn'
        );
      } else {
        this.showToast('✓ Integración Actualizada', `Operación "${mode}" registrada en ${provider}.`, 'success');
      }
      if (['social-planner', 'ad-manager', 'seo-analytics'].includes(this.activeModuleId)) {
        this.openModuleFull(this.activeModuleId, false);
      }
    } catch (e) {}
  }

  buildSocialPreviewHTML(contentText, mediaType, mediaUrl, schedStr, timezone) {
    const s5 = this.station5Data || {};
    const integMap = s5.integrations || {};
    const selectedNets = ['instagram', 'facebook', 'tiktok'].filter(n => this.socialDraftNetworks[n]);
    const cleanText = String(contentText || '').trim() || 'Escribe el texto de tu publicación a la izquierda para previsualizarla aquí...';

    if (selectedNets.length === 0) {
      return '<div style="padding: 1.5rem; text-align: center; color: var(--data-crimson); font-size: 0.84rem;">Selecciona al menos una red (Instagram, Facebook o TikTok).</div>';
    }

    return selectedNets.map(net => {
      const isConn = integMap[net] && integMap[net].status === 'conectado';
      const needsMediaErr = (net === 'instagram' || net === 'tiktok') && mediaType === 'none';
      const isManual = needsMediaErr || this.socialDraftRequiresNativeApp || !isConn;
      let reason = '';
      if (needsMediaErr) reason = 'Formato incompatible con API automática (requiere imagen o video).';
      else if (this.socialDraftRequiresNativeApp) reason = 'Incluye elemento nativo de app; generará recordatorio manual.';
      else if (!isConn) reason = 'Cuenta sin conexión OAuth; generará recordatorio manual al programar.';

      return `
        <div style="background: #F8F8F6; border: 1px solid ${isManual ? '#E2B857' : 'var(--accent-1)'}; border-radius: 10px; padding: 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
            <strong style="text-transform: uppercase; font-size: 0.78rem; color: #111111;">Vista Previa • ${net}</strong>
            <span class="mod-tag" style="font-size: 0.66rem; color: ${isManual ? '#9A7200' : 'var(--accent-1)'};">
              ${isManual ? 'Recordatorio Manual' : 'Auto-Publicación API'}
            </span>
          </div>
          <div style="background: #FFFFFF; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.7rem; font-size: 0.8rem;">
            ${mediaType !== 'none' ? `
              <div style="background: #111111; color: #FFFFFF; font-size: 0.72rem; padding: 0.55rem; border-radius: 6px; margin-bottom: 0.45rem; text-align: center;">
                [${mediaType === 'video' ? '🎬 VIDEO / REEL' : '🖼️ IMAGEN'}] ${mediaUrl ? this.escapeHtml(mediaUrl) : 'Archivo multimedia adjunto'}
              </div>
            ` : ''}
            <div style="color: #111111; line-height: 1.4;">${this.escapeHtml(cleanText)}</div>
            <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 0.4rem;">Programado: ${this.escapeHtml(schedStr)} (${this.escapeHtml(timezone)})</div>
          </div>
          ${reason ? `<div style="font-size: 0.71rem; color: #9A7200; margin-top: 0.35rem;">ℹ️ ${this.escapeHtml(reason)}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  refreshSocialPreviewDOM() {
    const container = document.getElementById('sp-live-preview-container');
    if (!container) return;
    const text = document.getElementById('sp-text')?.value || '';
    const mediaType = document.getElementById('sp-media-type')?.value || this.socialDraftMediaType;
    const mediaUrl = document.getElementById('sp-media-url')?.value || '';
    const dateVal = document.getElementById('sp-date')?.value || new Date().toISOString().slice(0, 10);
    const timeVal = document.getElementById('sp-time')?.value || '18:00';
    const tz = (this.station5Data && this.station5Data.settings && this.station5Data.settings.timezone) || 'America/Bogota';
    container.innerHTML = this.buildSocialPreviewHTML(text, mediaType, mediaUrl, `${dateVal} ${timeVal}`, tz);
  }

  async submitSocialPost(actionMode = 'schedule') {
    const title = document.getElementById('sp-title')?.value.trim() || '';
    const contentText = document.getElementById('sp-text')?.value.trim();
    const mediaType = document.getElementById('sp-media-type')?.value || 'image';
    const mediaUrl = document.getElementById('sp-media-url')?.value.trim() || '';
    const mediaFormatNotes = document.getElementById('sp-format-notes')?.value.trim() || '';
    const requiresNativeApp = Boolean(document.getElementById('sp-native-app')?.checked);
    const dateVal = document.getElementById('sp-date')?.value || new Date().toISOString().slice(0, 10);
    const timeVal = document.getElementById('sp-time')?.value || '18:00';
    const networks = ['instagram', 'facebook', 'tiktok'].filter(n => {
      const id = n === 'instagram' ? 'sp-net-ig' : (n === 'facebook' ? 'sp-net-fb' : 'sp-net-tt');
      return Boolean(document.getElementById(id)?.checked);
    });

    if (!contentText) {
      alert('Escribe el texto de la publicación antes de continuar.');
      return;
    }
    if (networks.length === 0) {
      alert('Selecciona al menos una red social.');
      return;
    }

    const url = this.editingSocialPostId
      ? `/api/station5/social/posts/${this.editingSocialPostId}`
      : '/api/station5/social/posts';
    const method = this.editingSocialPostId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          contentText,
          mediaType,
          mediaUrl,
          mediaFormatNotes,
          requiresNativeApp,
          networks,
          scheduledAt: `${dateVal} ${timeVal}`,
          actionMode
        })
      });
      const data = await res.json();
      if (data.success) {
        this.editingSocialPostId = null;
        if (this.moduleSubTabs) this.moduleSubTabs['social-planner'] = 'parrilla';
        await this.loadStation5Workspace();
        const msg = data.post.status === 'requiere_accion'
          ? 'Publicación guardada en estado "requiere_accion" con recordatorio manual creado.'
          : (data.post.status === 'borrador' ? 'Borrador guardado en la parrilla.' : 'Publicación programada en tu zona horaria.');
        this.showToast('📅 Parrilla Multired', msg, data.post.status === 'requiere_accion' ? 'warn' : 'success');
        this.openModuleFull('social-planner', false);
      } else {
        alert(data.error || 'No se pudo guardar la publicación.');
      }
    } catch (e) {}
  }

  startEditSocialPost(postId) {
    const posts = (this.station5Data && this.station5Data.socialPosts) || [];
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    this.editingSocialPostId = postId;
    if (this.moduleSubTabs) this.moduleSubTabs['social-planner'] = 'programar';
    this.socialDraftMediaType = post.media_type || 'image';
    this.socialDraftRequiresNativeApp = Boolean(post.requires_native_app);
    this.socialDraftNetworks = {
      instagram: (post.networks || []).includes('instagram'),
      facebook: (post.networks || []).includes('facebook'),
      tiktok: (post.networks || []).includes('tiktok')
    };
    this.openModuleFull('social-planner', false);
  }

  cancelEditSocialPost() {
    this.editingSocialPostId = null;
    if (this.moduleSubTabs) this.moduleSubTabs['social-planner'] = 'parrilla';
    this.openModuleFull('social-planner', false);
  }

  async cancelSocialPost(postId) {
    if (!confirm('¿Cancelar y eliminar esta publicación pendiente de la parrilla?')) return;
    try {
      const res = await fetch(`/api/station5/social/posts/${postId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await this.loadStation5Workspace();
        this.showToast('Publicación Cancelada', 'Se eliminó de la parrilla y se limpiaron sus recordatorios pendientes.', 'info');
        this.openModuleFull('social-planner', false);
      }
    } catch (e) {}
  }

  async retrySocialPost(postId) {
    try {
      const res = await fetch(`/api/station5/social/posts/${postId}/retry`, { method: 'POST' });
      const data = await res.json();
      await this.loadStation5Workspace();
      if (data.success) {
        this.showToast('✓ Publicada por API', 'La publicación fue confirmada por la red social.', 'success');
      } else {
        this.showToast('⚠️ Estado Real Registrado', (data.post && data.post.error_log) || 'No se pudo publicar automáticamente; revisa recordatorios o credenciales.', 'warn');
      }
      this.openModuleFull('social-planner', false);
    } catch (e) {}
  }

  async completeSocialReminder(remId) {
    try {
      const res = await fetch(`/api/station5/social/reminders/${remId}`, { method: 'PUT' });
      const data = await res.json();
      if (data.success) {
        await this.loadStation5Workspace();
        this.showToast('✓ Recordatorio Completado', 'Acción manual marcada como completada.', 'success');
        this.openModuleFull('social-planner', false);
      }
    } catch (e) {}
  }

  async switchActiveMarketingCollaborator(email) {
    this.activeCollaboratorEmail = email;
    await this.loadStation5Workspace();
    this.openModuleFull('ad-manager', false);
  }

  async setAdFilter(key, val) {
    this.adFilters[key] = val;
    await this.loadStation5Workspace();
    this.openModuleFull('ad-manager', false);
  }

  applyPermissionPreset(role) {
    const cConn = document.getElementById('perm-can-connect');
    const cView = document.getElementById('perm-can-metrics');
    const cPause = document.getElementById('perm-can-pause');
    const cBudget = document.getElementById('perm-can-budget');
    if (role === 'Solo Lectura / Analista') {
      if (cConn) cConn.checked = false;
      if (cView) cView.checked = true;
      if (cPause) cPause.checked = false;
      if (cBudget) cBudget.checked = false;
    } else if (role === 'Trafficker Operativo') {
      if (cConn) cConn.checked = false;
      if (cView) cView.checked = true;
      if (cPause) cPause.checked = true;
      if (cBudget) cBudget.checked = true;
    } else if (role === 'Administrador Marketing') {
      if (cConn) cConn.checked = true;
      if (cView) cView.checked = true;
      if (cPause) cPause.checked = true;
      if (cBudget) cBudget.checked = true;
    }
  }

  loadCollaboratorIntoForm(email) {
    const collabs = (this.station5Data && this.station5Data.collaborators) || [];
    const col = collabs.find(c => c.collaborator_email === email);
    if (!col) return;
    if (document.getElementById('perm-name')) document.getElementById('perm-name').value = col.collaborator_name;
    if (document.getElementById('perm-email')) document.getElementById('perm-email').value = col.collaborator_email;
    if (document.getElementById('perm-role-preset')) document.getElementById('perm-role-preset').value = col.role_preset || 'Personalizado';
    if (document.getElementById('perm-can-connect')) document.getElementById('perm-can-connect').checked = Boolean(col.can_connect_accounts);
    if (document.getElementById('perm-can-metrics')) document.getElementById('perm-can-metrics').checked = Boolean(col.can_view_metrics);
    if (document.getElementById('perm-can-pause')) document.getElementById('perm-can-pause').checked = Boolean(col.can_pause_resume);
    if (document.getElementById('perm-can-budget')) document.getElementById('perm-can-budget').checked = Boolean(col.can_modify_budget);
  }

  requestSaveCollaboratorPermissions() {
    const collaboratorName = document.getElementById('perm-name')?.value.trim();
    const collaboratorEmail = document.getElementById('perm-email')?.value.trim();
    if (!collaboratorName || !collaboratorEmail) {
      alert('Indica el nombre y correo de la persona que recibirá los permisos.');
      return;
    }
    this.pendingPermConfirm = {
      collaboratorName,
      collaboratorEmail,
      rolePreset: document.getElementById('perm-role-preset')?.value || 'Personalizado',
      canConnectAccounts: Boolean(document.getElementById('perm-can-connect')?.checked),
      canViewMetrics: Boolean(document.getElementById('perm-can-metrics')?.checked),
      canPauseResume: Boolean(document.getElementById('perm-can-pause')?.checked),
      canModifyBudget: Boolean(document.getElementById('perm-can-budget')?.checked)
    };
    this.openModuleFull('ad-manager', false);
  }

  async confirmSaveCollaboratorPermissions() {
    if (!this.pendingPermConfirm) return;
    try {
      const res = await fetch('/api/station5/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.pendingPermConfirm, confirmed: true })
      });
      const data = await res.json();
      if (data.success) {
        const who = this.pendingPermConfirm.collaboratorName;
        this.pendingPermConfirm = null;
        await this.loadStation5Workspace();
        this.showToast('✓ Permisos Confirmados', `Permisos individuales guardados para ${who} y registrados en auditoría.`, 'success');
        this.openModuleFull('ad-manager', false);
      } else {
        alert(data.error || 'No se pudieron guardar los permisos.');
      }
    } catch (e) {}
  }

  requestCampaignAction(campaignId, actionType) {
    const campaigns = (this.station5Data && this.station5Data.campaignsData && this.station5Data.campaignsData.campaigns) || [];
    const c = campaigns.find(x => x.id === campaignId);
    if (!c) return;
    this.pendingCampaignConfirm = {
      campaignId: c.id,
      provider: c.provider,
      accountName: c.account_name,
      campaignName: c.name,
      actionType,
      actionLabel: actionType === 'PAUSE_CAMPAIGN' ? 'Pausar Campaña' : 'Reanudar Campaña',
      currentBudget: c.daily_budget,
      currency: c.currency,
      newBudget: null
    };
    this.openModuleFull('ad-manager', false);
  }

  promptBudgetChange(campaignId) {
    const campaigns = (this.station5Data && this.station5Data.campaignsData && this.station5Data.campaignsData.campaigns) || [];
    const c = campaigns.find(x => x.id === campaignId);
    if (!c) return;
    const raw = prompt(`Nuevo presupuesto diario en ${c.currency} para "${c.name}" (actual: ${c.daily_budget}):`, String(c.daily_budget));
    if (raw === null) return;
    const newBudget = Number(raw);
    if (!newBudget || newBudget <= 0) {
      alert('Ingresa un presupuesto válido mayor a 0.');
      return;
    }
    this.pendingCampaignConfirm = {
      campaignId: c.id,
      provider: c.provider,
      accountName: c.account_name,
      campaignName: c.name,
      actionType: 'MODIFY_BUDGET',
      actionLabel: 'Modificar Presupuesto Diario',
      currentBudget: c.daily_budget,
      currency: c.currency,
      newBudget
    };
    this.openModuleFull('ad-manager', false);
  }

  async confirmExecuteCampaignAction() {
    if (!this.pendingCampaignConfirm) return;
    const reqPayload = {
      actionType: this.pendingCampaignConfirm.actionType,
      newBudget: this.pendingCampaignConfirm.newBudget,
      confirmed: true,
      actorEmail: this.activeCollaboratorEmail || (this.currentUser && this.currentUser.email) || ''
    };
    try {
      const res = await fetch(`/api/station5/campaigns/${this.pendingCampaignConfirm.campaignId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqPayload)
      });
      const data = await res.json();
      this.pendingCampaignConfirm = null;
      await this.loadStation5Workspace();
      if (data.success) {
        this.showToast('✓ Confirmado por Plataforma', 'Cambio aplicado en la cuenta publicitaria y auditado.', 'success');
      } else {
        this.showToast('⚠️ Estado Real Conservado', data.error || 'La plataforma no aceptó la acción.', 'warn');
      }
      this.openModuleFull('ad-manager', false);
    } catch (e) {}
  }

  simulateNavigationTouch(kind) {
    if (!window.EasyGrowAttribution) return;
    if (kind === 'paid') {
      window.EasyGrowAttribution.captureVisit({
        source: 'facebook',
        medium: 'cpc',
        campaign: 'Campana_Meta_Conversion_Dropi',
        campaignId: 'cmp_meta_test_01',
        provider: 'meta_ads'
      });
      this.showToast('🎯 Visita Pagada Capturada', 'Se conservó el primer origen (si era nuevo) y se actualizó última campaña pagada.', 'info');
    } else {
      window.EasyGrowAttribution.captureVisit({
        source: 'directo',
        medium: 'none',
        isDirect: true
      });
      this.showToast('🌐 Visita Directa Posterior', 'El primer origen conocido NO fue sobrescrito por la visita directa.', 'success');
    }
    this.openModuleFull('ad-manager', false);
  }

  resetNavigationAttribution() {
    if (window.EasyGrowAttribution) window.EasyGrowAttribution.reset();
    this.showToast('Sesión Reiniciada', 'Se limpió el origen de navegación de este navegador.', 'info');
    this.openModuleFull('ad-manager', false);
  }

  async updateAttributedOrderStatus(orderKey, orderStatus) {
    try {
      const res = await fetch(`/api/station5/orders/${encodeURIComponent(orderKey)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus })
      });
      const data = await res.json();
      if (data.success) {
        await this.loadStation5Workspace();
        this.showToast('Estado de Orden Actualizado', `Orden ${orderKey} marcada como ${orderStatus} (ROAS e ingresos recalculados).`, 'info');
        this.openModuleFull('ad-manager', false);
      }
    } catch (e) {}
  }

  async applySeoFilters() {
    this.seoFilters.query = document.getElementById('seo-q-filter')?.value || '';
    this.seoFilters.page = document.getElementById('seo-p-filter')?.value || '';
    this.seoFilters.period = document.getElementById('seo-period-filter')?.value || '28d';
    this.seoFilters.device = document.getElementById('seo-device-filter')?.value || 'ALL';
    this.seoFilters.country = document.getElementById('seo-country-filter')?.value || 'ALL';
    await this.loadStation5Workspace();
    this.openModuleFull('seo-analytics', false);
  }

  async createDropiOrderForContact(contactId) {
    const contact = window.EasyGrowCRM.getById(contactId);
    if (!contact) return;
    this.cartCustomerName = contact.contactPerson || contact.contact_person || contact.name || '';
    this.addToCart('prod_12345');
    this.openModuleFull('marketplace', true);
  }

  initModuleInteractivity(moduleId) {
    if (moduleId === 'marketplace') {
      this.renderMarketplaceCatalog();
      this.refreshCartSection();
    }
  }
}

window.EasyGrowConsole = EasyGrowConsoleApp;
