// app.js — render schools as a compact table.
// Depends on `SCHOOLS` from data.js.

(() => {
  "use strict";

  const ARABIC_TO_THAI = ["๐","๑","๒","๓","๔","๕","๖","๗","๘","๙"];
  const toThai = (n) => String(n).replace(/[0-9]/g, (d) => ARABIC_TO_THAI[d]);

  const orgKind = (org) => (org && org.includes("อบจ")) ? "pao" : "municipal";
  const orgPinColor = (org) => orgKind(org) === "pao" ? "#d96847" : "#0f5e5c";

  // Tiny shape icons used to differentiate เทศบาล vs อบจ. without color —
  // a filled square for เทศบาล (small/local) and a filled triangle for
  // อบจ. (provincial). Both use currentColor so they pick up the muted
  // text color of the surrounding tag.
  const ORG_GLYPH = {
    municipal: `<svg class="org-glyph" viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><rect width="10" height="10" fill="currentColor"/></svg>`,
    pao:       `<svg class="org-glyph" viewBox="0 0 11 10" width="10" height="9" aria-hidden="true"><polygon points="5.5,0 11,10 0,10" fill="currentColor"/></svg>`,
  };
  const orgGlyph = (org) => ORG_GLYPH[orgKind(org)] || "";

  // Overview-map markers are colored by province so the geographic spread
  // is readable at a glance (matches the legend dots on the filter pills).
  const PROVINCE_COLORS = {
    "ภูเก็ต": "#d96847",   // orange (coral)
    "กระบี่":  "#2d7a3a",   // forest green
    "ระนอง":  "#c43d3d",   // muted red
  };
  const provincePinColor = (p) => PROVINCE_COLORS[p] || "#6b6b6b";

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
          <span class="card-org-tag">${orgGlyph(s.org)}${orgShort(s.org)}</span>
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

    // Inline back button — visible inside every expanded detail panel.
    // When the user reached this row by clicking a card, it scrolls back
    // to that exact card; otherwise it scrolls to the top of the overview.
    const backBtn = `
      <div class="detail-back-row">
        <button type="button" class="back-link back-link-inline" data-action="back-to-overview">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          กลับไปหน้าภาพรวม
        </button>
      </div>
    `;

    return `<div class="detail-panel">
      <div class="detail-grid">${cells}</div>
      ${areaHTML}
      ${backBtn}
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
          <div class="name-meta">${orgGlyph(s.org)}${esc(s.org || "")}</div>
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
    province: "all",     // "all" | "ภูเก็ต" | "กระบี่" | "ระนอง"
    levels: new Set(),   // toggleable subset of LEVEL_KEYS
  };

  function matches(s) {
    if (state.province !== "all" && s.province !== state.province) return false;
    for (const lv of state.levels) {
      if (!s[lv]) return false;
    }
    if (state.q) {
      const hay = `${s.name} ${s.address} ${s.org} ${s.province || ""}`.toLowerCase();
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
      const color = provincePinColor(s.province);
      const icon = L.divIcon({
        className: "school-pin",
        html: `<span class="school-pin-dot" style="background:${color}"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const m = L.marker([s.google_map.lat, s.google_map.lng], { icon, title: s.name });
      // Org glyph (square=เทศบาล / triangle=อบจ.) instead of a colored dot,
      // so the popup matches the same iconography used in cards & rows.
      m.bindPopup(`
        <div class="map-popup">
          <div class="popup-name">${esc(s.name)}</div>
          <div class="popup-org">${orgGlyph(s.org)}${esc(s.org || "")}</div>
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

  // ── Ranking view ──────────────────────────────────────────────
  // Rankings are hand-curated content from rankings.js — render once on
  // load, no filtering needed. Each card optionally links to the matching
  // school in the Detail view via fuzzy name match (school_match field).

  function findSchoolByMatch(match) {
    if (!match) return null;
    return SCHOOLS.find((s) => s.name.includes(match)) || null;
  }

  function starsHTML(n, max = 5) {
    const filled = "★".repeat(n);
    const empty  = "☆".repeat(max - n);
    return `<span class="ranking-stars">${filled}</span><span class="ranking-stars-empty">${empty}</span>`;
  }

  function rankingCardHTML(r, idx) {
    const isFeatured = r.medal != null;
    const school = findSchoolByMatch(r.school_match);
    const detailLink = school
      ? `<a href="#detail" class="ranking-detail-link" data-action="ranking-jump" data-id="${school.id}">ดูรายละเอียดในตาราง →</a>`
      : "";
    const prosHTML = r.pros.length
      ? `<div class="ranking-section">
           <div class="ranking-section-label">ข้อดี</div>
           <ul class="ranking-list pros">${r.pros.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
         </div>` : "";
    const consHTML = r.cons.length
      ? `<div class="ranking-section">
           <div class="ranking-section-label">ข้อเสีย</div>
           <ul class="ranking-list cons">${r.cons.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
         </div>` : "";

    return `
      <article class="ranking-card${isFeatured ? " featured" : ""}" style="--d:${(idx * 0.04).toFixed(2)}s">
        <header class="ranking-head">
          <span class="ranking-label">${r.medal ? `<span class="ranking-medal">${r.medal}</span>` : ""}${esc(r.label)}</span>
          <span class="ranking-positions"><strong>${r.positions}</strong>ตำแหน่ง</span>
        </header>
        <h3 class="ranking-school">${esc(r.school_name)}</h3>
        <div class="ranking-meta">
          <div class="ranking-meta-line">
            <span>${esc(r.levels)}</span>·<span>${esc(r.org)}</span>·<span>${esc(r.location)}</span>
          </div>
          <div class="ranking-meta-line">${esc(r.address)}</div>
          <div class="ranking-meta-line">ใช้ ป.โท ${starsHTML(r.pho_stars)}</div>
          ${detailLink}
        </div>
        ${prosHTML}
        ${consHTML}
      </article>
    `;
  }

  function rankingPrinciplesHTML() {
    if (typeof RANKING_PRINCIPLES === "undefined") return "";
    const p = RANKING_PRINCIPLES;
    const candidates = p.candidates.map((c) => `
      <div class="pp-candidate-label">${esc(c.label)}</div>
      <div class="pp-candidate-text">${esc(c.text)}</div>
    `).join("");
    const rules = p.rules.map((r) => `<li>${esc(r)}</li>`).join("");
    return `
      <h3>หลักการ<em>ตัดสินใจ</em></h3>
      <p class="pp-intro">${esc(p.intro)}</p>
      <div class="pp-candidates">${candidates}</div>
      <ol>${rules}</ol>
    `;
  }

  function renderRankings() {
    const list = document.getElementById("rankings-list");
    const principles = document.getElementById("ranking-principles");
    if (!list || typeof RANKINGS === "undefined") return;
    list.innerHTML = RANKINGS.map((r, i) => rankingCardHTML(r, i)).join("");
    if (principles) principles.innerHTML = rankingPrinciplesHTML();
  }

  function setupRankingLinks() {
    // "ดูรายละเอียดในตาราง →" inside a ranking card jumps to the matching
    // school's detail row (same behavior as clicking an overview card).
    const list = document.getElementById("rankings-list");
    if (!list) return;
    list.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-action='ranking-jump']");
      if (!a) return;
      e.preventDefault();
      const id = parseInt(a.dataset.id, 10);
      if (!Number.isNaN(id)) jumpToDetail(id);
    });
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
      if (btn.dataset.province) {
        state.province = btn.dataset.province;
        wrap.querySelectorAll("[data-province]").forEach((b) => {
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

  function goBackToOverview() {
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
  }

  // Used by the empty-state button: clear search + filters, switch to
  // overview, and re-render so the user lands on a fresh full grid.
  function resetFiltersAndGoOverview() {
    state.q = "";
    state.province = "all";
    state.levels.clear();
    const input = document.getElementById("q");
    if (input) input.value = "";
    document.querySelectorAll("[data-province]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.province === "all"))
    );
    document.querySelectorAll("[data-level]").forEach((b) =>
      b.setAttribute("aria-pressed", "false")
    );
    if (location.hash !== "#overview") location.hash = "#overview";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setupBackButton() {
    // Top button (static element)
    const topBtn = document.getElementById("back-to-overview");
    if (topBtn) topBtn.addEventListener("click", goBackToOverview);

    // Inline buttons inside detail panels (rendered dynamically)
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-action='back-to-overview']")) {
        e.preventDefault();
        goBackToOverview();
      }
    });

    // Empty-state reset button — clears filters and returns to overview
    const emptyBtn = document.getElementById("empty-reset");
    if (emptyBtn) emptyBtn.addEventListener("click", resetFiltersAndGoOverview);
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
    const detail   = document.getElementById("view-detail");
    const ranking  = document.getElementById("view-ranking");
    const searchWrap = document.querySelector(".search-wrap");
    const tabs = document.querySelectorAll(".tab");

    function setView(name) {
      overview.hidden = name !== "overview";
      detail.hidden   = name !== "detail";
      if (ranking) ranking.hidden = name !== "ranking";
      // Search bar applies to overview/detail only — hide it on ranking
      // since rankings are static editorial content, not filterable.
      if (searchWrap) searchWrap.style.display = (name === "ranking") ? "none" : "";
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.view === name)));
      // Leaflet needs a nudge after the container becomes visible — its
      // size calc runs once at init and won't notice the show/hide flip.
      if (name === "overview" && mapInstance) {
        setTimeout(() => mapInstance.invalidateSize(), 50);
      }
    }

    function viewFromHash() {
      const h = location.hash;
      if (h === "#detail")  return "detail";
      if (h === "#ranking") return "ranking";
      return "overview";
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
    setupRankingLinks();
    renderRankings();
    render();
  });
})();
