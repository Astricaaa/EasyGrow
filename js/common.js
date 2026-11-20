/**
 * EasyGrow Common Utilities & Shared Event Bus
 * 100% Original Implementation • Enterprise Multi-Tenant Connected
 */

class EasyGrowEventBus {
  constructor() {
    this.events = {};
  }

  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
    return () => this.off(eventName, callback);
  }

  off(eventName, callback) {
    if (!this.events[eventName]) return;
    this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
  }

  emit(eventName, data) {
    if (!this.events[eventName]) return;
    this.events[eventName].forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[EventBus] Error in callback for ${eventName}:`, err);
      }
    });
  }
}

window.EasyGrowEvents = new EasyGrowEventBus();

// Shared CRM Service & Database 360° (Connected with SQLite Server)
class EasyGrowCRMService {
  constructor() {
    this.storageKey = 'easygrow_crm_contacts_v3';
    this.contacts = [];
    this.init();
  }

  async init() {
    // Only sync authenticated CRM data when inside the console
    if (!window.location.pathname.includes('console')) return;
    await this.syncWithServer(false);
  }

  async syncWithServer(emitUpdate = false) {
    try {
      const res = await fetch('/api/crm/contacts');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.contacts)) {
          this.contacts = data.contacts;
          this.saveLocal(emitUpdate);
          return this.contacts;
        }
      }
    } catch (e) {
      // Fallback to local storage if offline
    }

    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        this.contacts = JSON.parse(saved);
      } catch (e) {
        this.contacts = [];
      }
    } else {
      this.contacts = [];
    }
    return this.contacts;
  }

  saveLocal(emitUpdate = true) {
    localStorage.setItem(this.storageKey, JSON.stringify(this.contacts));
    if (emitUpdate && window.EasyGrowEvents) {
      window.EasyGrowEvents.emit('crm:contacts-updated', this.contacts);
    }
  }

  getAll() {
    return [...this.contacts];
  }

  getById(id) {
    return this.contacts.find(c => c.id === id);
  }

  async create(contactData) {
    try {
      const res = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.contacts.unshift(data.contact);
          this.saveLocal();
          return data.contact;
        }
      }
    } catch (e) {}

    // Fallback in-memory
    const newContact = {
      id: 'cnt_' + Date.now(),
      ...contactData,
      createdAt: new Date().toISOString()
    };
    this.contacts.unshift(newContact);
    this.saveLocal();
    return newContact;
  }

  async updateStage(contactId, stage) {
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const idx = this.contacts.findIndex(c => c.id === contactId);
          if (idx !== -1) this.contacts[idx] = data.contact;
          this.saveLocal();
          return data.contact;
        }
      }
    } catch (e) {}

    const contact = this.contacts.find(c => c.id === contactId);
    if (contact) {
      contact.stage = stage;
      this.saveLocal();
    }
    return contact;
  }

  async registerDropiPurchase(order) {
    const customerName = order.customer_name || "Cliente Marketplace";
    const contactData = {
      name: customerName,
      contactPerson: customerName,
      phone: "+57 310 000 0000",
      email: `${customerName.toLowerCase().replace(/\s+/g, '.')}@cliente.co`,
      company: "Venta Directa Dropi",
      stage: "closed",
      value: order.total || 89900,
      cost: (order.total || 89900) * 0.5,
      tags: ["Cliente-Dropi-Activo", "Venta-Confirmada"],
      attribution: "Checkout Inmediato Dropi",
      dropiOrders: [order.order_id],
      timeline: [
        { date: "Hace un momento", type: "dropi", title: `Pedido #${order.order_id} generado en Dropi` }
      ]
    };
    return await this.create(contactData);
  }

  analyzeIntent(text) {
    if (!text || typeof text !== 'string') {
      return { classification: "NEUTRAL", score: 0.5, reason: "Sin texto" };
    }
    const lower = text.toLowerCase();
    const stockKeywords = ["disponible", "disponibilidad", "stock", "tienen", "queda", "tarda", "envío", "cuánto tiempo", "medellín", "bogotá", "cali", "barranquilla"];
    const positiveKeywords = ["comprar", "quiero", "interesa", "precio", "pago", "contraentrega", "dónde pago", "factura", "pedido", "cotización", "separar"];
    const negativeKeywords = ["cancelar", "queja", "reclamo", "demora", "malo", "estafa", "devolución", "garantía", "no llegó", "pésimo"];

    if (stockKeywords.some(kw => lower.includes(kw))) {
      return { classification: "FAQ_STOCK", score: 0.94, label: "Pregunta de Stock / Logística", color: "var(--accent-1)" };
    }
    if (positiveKeywords.some(kw => lower.includes(kw))) {
      return { classification: "POSITIVA", score: 0.96, label: "Alta Intención de Compra", color: "var(--usd-green)" };
    }
    if (negativeKeywords.some(kw => lower.includes(kw))) {
      return { classification: "NEGATIVA", score: 0.91, label: "Atención Prioritaria / Soporte", color: "var(--data-crimson)" };
    }
    return { classification: "NEUTRAL", score: 0.70, label: "Consulta General", color: "var(--text-muted)" };
  }
}

window.EasyGrowCRM = new EasyGrowCRMService();

// Icon Generator
class EasyGrowIconRegistry {
  constructor() {
    this.icons = {
      'shopping-bag': '<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
      'truck': '<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
      'users': '<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      'target': '<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
      'check-square': '<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
      'maximize': '<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
      'message-circle': '<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>',
      'phone-call': '<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M14.05 2a9 9 0 0 1 8 7.94"/><path d="M14.05 6A5 5 0 0 1 18 10"/></svg>',
      'inbox': '<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
      'calendar': '<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
      'trending-up': '<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
      'shield-check': '<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>'
    };
  }

  get(name, size = 18) {
    const raw = this.icons[name] || this.icons['users'];
    return raw.replace(/{size}/g, size);
  }
}

window.EasyGrowIcons = new EasyGrowIconRegistry();

// Estación 05: Rastreador Persistente de Primer Origen y Última Campaña Pagada
class EasyGrowAttributionTracker {
  constructor() {
    this.storageKey = 'easygrow_attribution_v1';
    this.captureCurrentUrl();
  }

  readState() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : { firstOrigin: null, lastPaidCampaign: null, visitsHistory: [] };
    } catch (e) {
      return { firstOrigin: null, lastPaidCampaign: null, visitsHistory: [] };
    }
  }

  writeState(state) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch (e) {}
    return state;
  }

  captureCurrentUrl() {
    if (typeof window === 'undefined' || !window.location) return null;
    const params = new URLSearchParams(window.location.search);
    const hasTracking = params.has('utm_source') || params.has('utm_campaign') || params.has('campaign_id') || params.has('fbclid') || params.has('gclid');
    if (!hasTracking) return this.readState();

    return this.captureVisit({
      source: params.get('utm_source') || (params.has('fbclid') ? 'facebook' : (params.has('gclid') ? 'google' : 'web')),
      medium: params.get('utm_medium') || (params.has('fbclid') || params.has('gclid') ? 'cpc' : 'organic'),
      campaign: params.get('utm_campaign') || '',
      campaignId: params.get('campaign_id') || params.get('utm_id') || '',
      provider: params.has('gclid') ? 'google_ads' : (params.has('fbclid') ? 'meta_ads' : '')
    });
  }

  captureVisit(visit = {}) {
    const state = this.readState();
    const nowIso = visit.timestamp || new Date().toISOString();
    const source = String(visit.source || '').trim().toLowerCase() || 'directo';
    const medium = String(visit.medium || '').trim().toLowerCase() || (source === 'directo' ? 'none' : 'referral');
    const campaign = String(visit.campaign || '').trim();
    const campaignId = String(visit.campaignId || '').trim();
    const isDirect = Boolean(visit.isDirect) || (source === 'directo' && !campaign && !campaignId);

    const isPaid = !isDirect && (
      /cpc|ppc|paid|ads|meta_ads|google_ads|shopping|display/.test(medium) ||
      Boolean(campaignId) ||
      Boolean(visit.fbclid) ||
      Boolean(visit.gclid)
    );

    // Regla estricta: conservar primer origen conocido; visitas directas posteriores JAMÁS sobrescriben el primer origen conocido.
    if (!state.firstOrigin) {
      if (!isDirect) {
        state.firstOrigin = { source, medium, campaign, campaignId, timestamp: nowIso };
      } else {
        state.firstOrigin = { source: 'directo', medium: 'none', campaign: '', campaignId: '', timestamp: nowIso };
      }
    } else if (state.firstOrigin.source === 'directo' && !isDirect) {
      state.firstOrigin = { source, medium, campaign, campaignId, timestamp: nowIso };
    }

    // Regla estricta: actualizar únicamente con campañas pagadas; visitas directas/orgánicas posteriores no borran la última campaña pagada.
    if (isPaid && (campaign || campaignId)) {
      const inferredProvider = visit.provider || (/google|gclid/.test(source + medium) ? 'google_ads' : 'meta_ads');
      state.lastPaidCampaign = {
        provider: inferredProvider,
        accountId: visit.accountId || '',
        campaignId: campaignId || campaign,
        campaignName: campaign || campaignId,
        source,
        medium,
        timestamp: nowIso
      };
    }

    state.visitsHistory = [
      { source, medium, campaign, isDirect, isPaid, timestamp: nowIso },
      ...(Array.isArray(state.visitsHistory) ? state.visitsHistory : [])
    ].slice(0, 15);

    return this.writeState(state);
  }

  getAttributionContext() {
    const s = this.readState();
    return {
      firstOrigin: s.firstOrigin,
      lastPaidCampaign: s.lastPaidCampaign,
      visitsHistory: s.visitsHistory || []
    };
  }

  reset() {
    return this.writeState({ firstOrigin: null, lastPaidCampaign: null, visitsHistory: [] });
  }
}

window.EasyGrowAttribution = new EasyGrowAttributionTracker();
