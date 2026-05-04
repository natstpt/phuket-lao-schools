// app.js — render schools as a compact table.
// Depends on `SCHOOLS` from data.js.

(() => {
  "use strict";

  const ARABIC_TO_THAI = ["๐","๑","๒","๓","๔","๕","๖","๗","๘","๙"];
  const toThai = (n) => String(n).replace(/[0-9]/g, (d) => ARABIC_TO_THAI[d]);

  const orgKind = (org) => (org && org.includes("อบจ")) ? "pao" : "municipal";
  const orgDot = (org) => orgKind(org) === "pao" ? "bg-coral" : "bg-ocean";
  const orgPinColor = (org) => orgKind(org) === "pao" ? "#d96847" : "#0f5e5c";

  // ── OSM tile coords for a (lat,lng) at zoom z, plus the pin's pixel
  // position within the tile (so the pin sits exactly on the school).
  function tileFromLatLng(lat, lng, z) {
    const n = Math.pow(2, z);
    const xRaw = ((lng + 180) / 360) * n;
    const yRad = (lat * Math.PI) / 180;
    const yRaw = (1 - Math.log(Math.tan(yRad) + 1 / Math.cos(yRad)) / Math.PI) / 2 * n;
    const x = Math.floor(xRaw);
    const y = Math.floor(yRaw);
    return {
      x, y, z,
      pxPct: (xRaw - x) * 100,   // 0..100 within the tile
      pyPct: (yRaw - y) * 100,
    };
  }

  function tidyLabel(item) {
    if (!item || !item.label) return item ? item.url : "";
    if (item.label.length <= 30) return item.label;
    try {
      return new URL(item.url).hostname.replace(/^www\./, "");
    } catch {
      return item.label.slice(0, 30) + "…";
    }
  }

  function levelChips(s) {
    const items = [
      { key: "kindergarten", label: "อนุบาล" },
      { key: "primary", label: "ประถม" },
      { key: "lower_secondary", label: "ม.ต้น" },
      { key: "upper_secondary", label: "ม.ปลาย" },
    ];
    return `<div class="lv-grid">${items
      .map((l) => `<span class="lv ${s[l.key] ? "on" : ""}">${l.label}</span>`)
      .join("")}</div>`;
  }

  function mapThumb(school) {
    const gm = school.google_map;
    if (!gm || typeof gm.lat !== "number" || typeof gm.lng !== "number") {
      return `<div class="map-thumb no-coords">ไม่มีข้อมูล</div>`;
    }
    const t = tileFromLatLng(gm.lat, gm.lng, 16);
    const tileUrl = `https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`;
    const pinColor = orgPinColor(school.org);
    return `
      <a href="${gm.url}" target="_blank" rel="noopener" class="map-thumb" title="เปิดใน Google Maps">
        <img src="${tileUrl}" alt="" loading="lazy" />
        <svg class="pin" viewBox="0 0 24 24" style="left:${t.pxPct.toFixed(2)}%;top:${t.pyPct.toFixed(2)}%">
          <circle cx="12" cy="12" r="6" fill="${pinColor}" stroke="#fafaf7" stroke-width="2.5"/>
        </svg>
        <span class="map-hint">เปิดแผนที่ ↗</span>
      </a>
    `;
  }

  function sourcesList(school) {
    if (!school.sources || !school.sources.length) {
      return `<span class="text-ink-muted text-sm">—</span>`;
    }
    return `<div class="src-list">${school.sources
      .map((s) => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${tidyLabel(s)} ↗</a>`)
      .join("")}</div>`;
  }

  function seqDisplay(s) {
    if (!s.seq_numbers || !s.seq_numbers.length) return "—";
    return s.seq_numbers.join(", ");
  }

  // Escape HTML special chars so school-supplied text can be safely
  // injected into the DOM via innerHTML.
  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Numbers first (display-styled), then descriptive long-form.
  // Order matches the user's spec for the overview cards.
  const DETAIL_FIELDS = [
    { key: "student_count",    label: "จำนวนนักเรียน",      style: "display" },
    { key: "staff_count",      label: "จำนวนครู / บุคลากร",  style: "display" },
    { key: "special_programs", label: "ห้องเรียนพิเศษ / หลักสูตร" },
    { key: "highlights",       label: "ข้อมูลน่าสนใจ" },
    { key: "awards",           label: "รางวัล / จุดเด่น" },
    { key: "extra_sources",    label: "แหล่งข้อมูลเพิ่มเติม" },
  ];

  // Area / housing fields — comma-separated lists shown as chips.
  // Pair (places + landmarks) and (dorms + rentals) so the 2-col grid reads
  // naturally: left column = "วันธรรมดา/ที่เที่ยว", right column = "ที่พัก".
  const AREA_FIELDS = [
    { key: "nearby_places",  label: "สถานที่ใกล้เคียง" },
    { key: "landmarks",      label: "แลนด์มาร์คใกล้เคียง" },
    { key: "dorms_condos",   label: "หอพัก / คอนโดแนะนำ" },
    { key: "rental_houses",  label: "บ้านเช่าแนะนำ" },
  ];

  function hasAnyDetail(s) {
    return DETAIL_FIELDS.some((f) => s[f.key]) || AREA_FIELDS.some((f) => s[f.key]);
  }

  function chipsHTML(text) {
    if (!text) return "";
    const items = String(text).split(/,\s*/).map((s) => s.trim()).filter(Boolean);
    return `<div class="chip-list">${items.map((it) => `<span class="chip">${esc(it)}</span>`).join("")}</div>`;
  }

  const orgShort = (org) => orgKind(org) === "pao" ? "อบจ." : "เทศบาล";

  // Build a compact summary card (Overview tab).
  function overviewCardHTML(s, idx) {
    const stats = [
      { key: "student_count", label: "จำนวนนักเรียน" },
      { key: "staff_count",   label: "จำนวนครู / บุคลากร" },
    ];
    const longFields = [
      { key: "special_programs", label: "ห้องเรียนพิเศษ / หลักสูตร" },
      { key: "highlights",       label: "ข้อมูลน่าสนใจ" },
      { key: "awards",           label: "รางวัล / จุดเด่น" },
    ];

    const hasStats = stats.some((f) => s[f.key]);
    const hasLong = longFields.some((f) => s[f.key]);

    const statsHTML = hasStats ? `
      <div class="card-section">
        <div class="card-stats">
          ${stats.map((f) => s[f.key]
            ? `<div>
                 <div class="card-label">${f.label}</div>
                 <div class="card-stat-value">${esc(s[f.key])}</div>
               </div>`
            : `<div></div>`).join("")}
        </div>
      </div>` : "";

    const longHTML = hasLong ? `
      <div class="card-section">
        ${longFields.filter((f) => s[f.key]).map((f) => `
          <div>
            <div class="card-label">${f.label}</div>
            <div class="card-text">${esc(s[f.key])}</div>
          </div>
        `).join("")}
      </div>` : "";

    return `
      <a href="#detail" class="overview-card" data-id="${s.id}" style="--d:${(idx * 0.05).toFixed(2)}s">
        <header class="card-head">
          <span class="card-seq">ลำดับ <strong>${seqDisplay(s)}</strong></span>
          <span class="card-org-tag"><span class="dot ${orgDot(s.org)}"></span>${orgShort(s.org)}</span>
        </header>
        <h3 class="card-name">${esc(s.name)}</h3>
        <div class="card-org-name">${esc(s.org || "")}</div>
        ${levelChips(s)}
        ${statsHTML}
        ${longHTML}
      </a>
    `;
  }

  function detailPanelHTML(s) {
    const cells = DETAIL_FIELDS
      .filter((f) => s[f.key])
      .map((f) => {
        const cls = f.style === "display" ? "detail-value display" : "detail-value";
        return `
          <div class="detail-field">
            <div class="detail-label">${f.label}</div>
            <div class="${cls}">${esc(s[f.key])}</div>
          </div>
        `;
      }).join("");

    let areaHTML = "";
    const areaCells = AREA_FIELDS
      .filter((f) => s[f.key])
      .map((f) => `
        <div class="detail-field">
          <div class="detail-label">${f.label}</div>
          ${chipsHTML(s[f.key])}
        </div>
      `).join("");
    if (areaCells) {
      areaHTML = `
        <div class="detail-section-divider">
          <span class="detail-section-title">พื้นที่และที่พักใกล้เคียง</span>
        </div>
        <div class="detail-grid">${areaCells}</div>
      `;
    }

    return `<div class="detail-panel">
      <div class="detail-grid">${cells}</div>
      ${areaHTML}
    </div>`;
  }

  const CHEVRON_SVG =
    `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;

  function rowHTML(s, idx) {
    const expandable = hasAnyDetail(s);
    const toggle = expandable
      ? `<button class="expand-toggle" type="button" aria-expanded="false" aria-label="ดูรายละเอียด">${CHEVRON_SVG}</button>`
      : "";
    const main = `
      <tr class="row-main" data-id="${s.id}" data-expanded="false" style="--d:${(idx * 0.05).toFixed(2)}s">
        <td class="col-seq"><span class="seq-cell">${seqDisplay(s)}</span></td>
        <td>
          <div class="name-display">${esc(s.name)}</div>
          <div class="name-meta"><span class="dot ${orgDot(s.org)}"></span>${esc(s.org || "")}</div>
        </td>
        <td class="col-map">${mapThumb(s)}</td>
        <td class="col-levels">${levelChips(s)}</td>
        <td class="col-sources">${sourcesList(s)}</td>
        <td class="col-expand text-center">${toggle}</td>
      </tr>
    `;
    if (!expandable) return main;
    return main + `
      <tr class="row-detail" data-id="${s.id}" hidden>
        <td colspan="6">${detailPanelHTML(s)}</td>
      </tr>
    `;
  }

  const state = {
    q: "",
    org: "all",          // "all" | "municipal" | "pao"
    levels: new Set(),   // toggleable subset of LEVEL_KEYS
  };

  function matches(s) {
    if (state.org !== "all" && orgKind(s.org) !== state.org) return false;
    for (const lv of state.levels) {
      if (!s[lv]) return false;
    }
    if (state.q) {
      const hay = `${s.name} ${s.address} ${s.org}`.toLowerCase();
      if (!hay.includes(state.q.toLowerCase())) return false;
    }
    return true;
  }

  // School the user clicked from a card; back button uses it to scroll there.
  let lastViewedSchoolId = null;

  // ── Leaflet overview map (lazy-init on first render)
  let mapInstance = null;
  let markerLayer = null;

  function initMap() {
    const el = document.getElementById("overview-map");
    if (!el || !window.L || mapInstance) return;

    mapInstance = L.map(el, {
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView([7.95, 98.4], 11);  // rough center on Phuket island

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapInstance);

    markerLayer = L.layerGroup().addTo(mapInstance);
  }

  function updateMap(schools) {
    if (!mapInstance || !markerLayer) return;
    markerLayer.clearLayers();

    const withCoords = schools.filter(
      (s) => s.google_map && typeof s.google_map.lat === "number" && typeof s.google_map.lng === "number"
    );
    if (!withCoords.length) return;

    const markers = [];
    withCoords.forEach((s) => {
      const color = orgPinColor(s.org);
      const icon = L.divIcon({
        className: "school-pin",
        html: `<span class="school-pin-dot" style="background:${color}"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const m = L.marker([s.google_map.lat, s.google_map.lng], { icon, title: s.name });
      const orgClass = orgDot(s.org);
      m.bindPopup(`
        <div class="map-popup">
          <div class="popup-name">${esc(s.name)}</div>
          <div class="popup-org"><span class="dot ${orgClass}"></span>${esc(s.org || "")}</div>
          <a href="#detail" class="popup-detail-btn" data-id="${s.id}">ดูรายละเอียด →</a>
        </div>
      `);
      markerLayer.addLayer(m);
      markers.push(m);
    });

    if (markers.length === 1) {
      mapInstance.setView(markers[0].getLatLng(), 14);
    } else {
      const group = L.featureGroup(markers);
      mapInstance.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 14 });
    }
  }

  function render() {
    const filtered = SCHOOLS.filter(matches);
    const tbody = document.getElementById("rows");
    const grid = document.getElementById("overview-grid");
    const empty = document.getElementById("empty");
    const overview = document.getElementById("view-overview");
    const detail = document.getElementById("view-detail");
    const count = document.getElementById("result-count");

    if (filtered.length === 0) {
      tbody.innerHTML = "";
      grid.innerHTML = "";
      empty.classList.remove("hidden");
      overview.style.display = "none";
      detail.style.display = "none";
    } else {
      empty.classList.add("hidden");
      overview.style.display = "";
      detail.style.display = "";
      grid.innerHTML = filtered.map((s, i) => overviewCardHTML(s, i)).join("");
      tbody.innerHTML = filtered.map((s, i) => rowHTML(s, i)).join("");
    }

    updateMap(filtered);

    count.textContent =
      filtered.length === SCHOOLS.length
        ? `ทั้งหมด ${SCHOOLS.length} โรงเรียน`
        : `${filtered.length} จาก ${SCHOOLS.length} โรงเรียน`;
  }

  function setupSearch() {
    const input = document.getElementById("q");
    let t;
    input.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.q = input.value.trim();
        render();
      }, 90);
    });
  }

  function setupFilters() {
    const wrap = document.getElementById("filters");
    if (!wrap) return;
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-pill");
      if (!btn) return;
      if (btn.dataset.org) {
        state.org = btn.dataset.org;
        wrap.querySelectorAll("[data-org]").forEach((b) => {
          b.setAttribute("aria-pressed", String(b === btn));
        });
      } else if (btn.dataset.level) {
        const k = btn.dataset.level;
        const pressed = btn.getAttribute("aria-pressed") === "true";
        btn.setAttribute("aria-pressed", String(!pressed));
        if (pressed) state.levels.delete(k);
        else state.levels.add(k);
      }
      render();
    });
  }

  // Switch to detail view, scroll to a school's row, and pop it open.
  function jumpToDetail(id) {
    lastViewedSchoolId = id;
    if (location.hash !== "#detail") {
      location.hash = "#detail";   // hashchange handler swaps views
    }
    // Wait one frame so the detail view is visible before measuring.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const row = document.querySelector(`tr.row-main[data-id="${id}"]`);
      const detail = document.querySelector(`tr.row-detail[data-id="${id}"]`);
      if (!row) return;
      if (detail && detail.hidden) {
        row.dataset.expanded = "true";
        const btn = row.querySelector(".expand-toggle");
        if (btn) btn.setAttribute("aria-expanded", "true");
        detail.hidden = false;
      }
      row.classList.add("flash");
      if (detail) detail.classList.add("flash");
      row.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        row.classList.remove("flash");
        if (detail) detail.classList.remove("flash");
      }, 1700);
    }));
  }

  function setupCardLinks() {
    const grid = document.getElementById("overview-grid");
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".overview-card[data-id]");
      if (!card) return;
      e.preventDefault();
      jumpToDetail(parseInt(card.dataset.id, 10));
    });

    // Map popups are rendered into Leaflet's own DOM tree on demand,
    // so listen at the document level to catch clicks on the popup button.
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".popup-detail-btn[data-id]");
      if (!btn) return;
      e.preventDefault();
      if (mapInstance) mapInstance.closePopup();
      jumpToDetail(parseInt(btn.dataset.id, 10));
    });
  }

  function setupBackButton() {
    const btn = document.getElementById("back-to-overview");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const target = lastViewedSchoolId;
      if (location.hash !== "#overview") location.hash = "#overview";
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (target) {
          const card = document.querySelector(`.overview-card[data-id="${target}"]`);
          if (card) {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      }));
    });
  }

  function setupExpand() {
    const tbody = document.getElementById("rows");
    tbody.addEventListener("click", (e) => {
      // Don't toggle when the user clicked an actual link (map / source).
      if (e.target.closest("a")) return;
      const row = e.target.closest("tr.row-main");
      if (!row) return;
      const id = row.dataset.id;
      const detail = tbody.querySelector(`tr.row-detail[data-id="${id}"]`);
      if (!detail) return;
      const isOpen = row.dataset.expanded === "true";
      row.dataset.expanded = String(!isOpen);
      const btn = row.querySelector(".expand-toggle");
      if (btn) btn.setAttribute("aria-expanded", String(!isOpen));
      detail.hidden = isOpen;
    });
  }

  function setupTabs() {
    const overview = document.getElementById("view-overview");
    const detail = document.getElementById("view-detail");
    const tabs = document.querySelectorAll(".tab");

    function setView(name) {
      const isDetail = name === "detail";
      overview.hidden = isDetail;
      detail.hidden = !isDetail;
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.view === name)));
      // Leaflet needs a nudge after the container becomes visible — its size
      // calc runs once at init and won't notice the show/hide flip.
      if (!isDetail && mapInstance) {
        setTimeout(() => mapInstance.invalidateSize(), 50);
      }
    }

    function viewFromHash() {
      return location.hash === "#detail" ? "detail" : "overview";
    }

    setView(viewFromHash());
    window.addEventListener("hashchange", () => setView(viewFromHash()));
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (typeof SCHOOLS === "undefined" || !Array.isArray(SCHOOLS)) {
      console.error("SCHOOLS data is missing — make sure data.js loads before app.js");
      return;
    }
    initMap();
    setupSearch();
    setupFilters();
    setupExpand();
    setupTabs();
    setupCardLinks();
    setupBackButton();
    render();
  });
})();
