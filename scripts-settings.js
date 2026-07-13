// Settings: choose which health areas (dimensions) are tracked.
// `active` is the working selection being edited; nothing is persisted until
// the user presses Save (saveSettings), which writes cpt_dimensions — the same
// store app-data.js reads, so every page picks up the change on its next load.

    let active = [];   // working (unsaved) selection
    let saved  = [];   // last persisted selection, for dirty detection

    function isDirty() {
      return active.join(",") !== saved.join(",");
    }

    function render() {
      document.getElementById("activeCount").textContent = active.length;
      document.getElementById("dimList").innerHTML = DIMENSION_CATALOG.map(d => {
        const on = active.includes(d.key);
        return `<label style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid ${on ? d.color : "var(--grey-light)"};border-radius:12px;padding:13px 15px;margin-bottom:10px;cursor:pointer;">
          <input type="checkbox" ${on ? "checked" : ""} onchange="toggleDim('${d.key}')" style="width:18px;height:18px;flex-shrink:0;">
          <span style="width:12px;height:12px;border-radius:50%;background:${d.color};flex-shrink:0;"></span>
          <span style="flex:1;min-width:0;">
            <span style="font-weight:700;color:var(--primary);font-size:0.9rem;">${d.label}</span>
            <span style="display:block;font-size:0.74rem;color:var(--grey-dark);">${d.hint}</span>
          </span>
          ${on ? `<span style="font-size:0.7rem;font-weight:700;color:${d.color};">ON</span>` : ""}
        </label>`;
      }).join("");
      updateSaveBtn();
    }

    function toggleDim(key) {
      if (active.includes(key)) {
        if (active.length <= 1) { showMsg("Keep at least one health area."); render(); return; }
        active = active.filter(k => k !== key);
      } else {
        // Re-derive in catalog order so the active set stays consistently ordered.
        active = DIMENSION_CATALOG.filter(d => active.includes(d.key) || d.key === key).map(d => d.key);
      }
      render();
    }

    function saveSettings() {
      if (!isDirty()) return;
      saveActiveDimensions(active);
      saved = active.slice();
      showMsg("Saved. Check-ins and dashboards now track these areas.");
      updateSaveBtn();
    }

    function updateSaveBtn() {
      const btn = document.getElementById("saveBtn");
      if (!btn) return;
      const dirty = isDirty();
      btn.disabled = !dirty;
      btn.style.opacity = dirty ? "1" : "0.5";
      btn.style.cursor = dirty ? "pointer" : "not-allowed";
    }

    function showMsg(m) {
      const t = document.getElementById("settingsMsg");
      t.textContent = m;
      t.style.opacity = "1";
      clearTimeout(t._t);
      t._t = setTimeout(() => { t.style.opacity = "0"; }, 3000);
    }

    // ── Init ──
    saved  = loadActiveDimensions();
    active = saved.slice();
    render();
