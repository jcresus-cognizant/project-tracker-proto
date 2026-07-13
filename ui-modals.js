// ─────────────────────────────────────────────────────────────────────────────
// Shared modals for the list pages (projects.html, teams.html)
//
// The Add / Edit / Check-in modals on those two pages were identical except for
// the words "project/team" and "People/Members". This generates them from one
// template so the markup isn't copy-pasted. Every element id and onclick name is
// preserved exactly, so the existing page scripts keep working unchanged.
//
// NOTE: dashboard.html keeps its own modals — it's a portfolio view whose Add
// modal has a project/team type toggle and whose Check-in modal uses an item
// picker (checkinItem) instead of a hidden target id, so it isn't the same shape.
// ─────────────────────────────────────────────────────────────────────────────

function listPageModalsHTML(cfg) {
  const { entity, entityCap, peopleLabel, personWord, namePlaceholder, leadPlaceholder } = cfg;

  const editModal = `
  <div class="modal fade" id="editModal" tabindex="-1" aria-hidden="true" aria-label="Edit details">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content" style="border-radius:14px;border:none;">
        <div class="modal-header" style="background:var(--primary);color:white;border-radius:14px 14px 0 0;">
          <h5 class="modal-title">Edit ${entityCap}</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body p-4">
          <input type="hidden" id="editId">
          <div class="row g-3 mb-3">
            <div class="col-md-8"><label class="form-label fw-bold">${entityCap} name</label>
              <input type="text" id="editName"></div>
            <div class="col-md-4"><label class="form-label fw-bold">Lead</label>
              <input type="text" id="editLead"></div>
          </div>
          <div class="mb-3"><label class="form-label fw-bold">Notes</label>
            <textarea id="editNotes" rows="2"></textarea></div>
          <div class="mb-2">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <label class="form-label fw-bold mb-0">${peopleLabel}</label>
              <button type="button" class="btn btn-outline-dark btn-sm" style="border-radius:50px;font-size:0.74rem;" onclick="addEditPersonRow()">+ Add ${personWord}</button>
            </div>
            <div id="editPeopleList" class="d-flex flex-column gap-2"></div>
          </div>
          <div id="editError" class="text-danger mt-2" style="font-size:0.82rem;display:none;"></div>
        </div>
        <div class="modal-footer" style="border-top:1px solid var(--grey-light);">
          <button class="btn-cancel" data-bs-dismiss="modal">Cancel</button>
          <button class="btn-primary-action" onclick="submitEdit()">Save changes</button>
        </div>
      </div>
    </div>
  </div>`;

  const addModal = `
  <div class="modal fade" id="addModal" tabindex="-1" aria-hidden="true" aria-label="Add">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content" style="border-radius:14px;border:none;">
        <div class="modal-header" style="background:var(--primary);color:white;border-radius:14px 14px 0 0;">
          <h5 class="modal-title">Add ${entityCap}</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body p-4">
          <div class="row g-3 mb-3">
            <div class="col-md-8"><label class="form-label fw-bold">${entityCap} name</label>
              <input type="text" id="addName" placeholder="${namePlaceholder}"></div>
            <div class="col-md-4"><label class="form-label fw-bold">Lead</label>
              <input type="text" id="addLead" placeholder="${leadPlaceholder}"></div>
          </div>
          <div class="mb-3"><label class="form-label fw-bold">Notes <span style="font-weight:400;color:var(--grey-dark);">(optional)</span></label>
            <textarea id="addNotes" rows="2" placeholder="Any context…"></textarea></div>
          <div class="mb-2">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <label class="form-label fw-bold mb-0">${peopleLabel}</label>
              <button type="button" class="btn btn-outline-dark btn-sm" style="border-radius:50px;font-size:0.74rem;" onclick="addAddPersonRow()">+ Add ${personWord}</button>
            </div>
            <div id="addPeopleList" class="d-flex flex-column gap-2"></div>
          </div>
          <div id="addError" class="text-danger mt-2" style="font-size:0.82rem;display:none;"></div>
        </div>
        <div class="modal-footer" style="border-top:1px solid var(--grey-light);">
          <button class="btn-cancel" data-bs-dismiss="modal">Cancel</button>
          <button class="btn-primary-action" onclick="submitAdd()">Add ${entity}</button>
        </div>
      </div>
    </div>
  </div>`;

  const ciRow = (field, label, hint) => `
            <div>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="fw-bold mb-0" style="font-size:0.9rem;">${label}</label>
                <small class="text-muted">${hint}</small>
              </div>
              <div class="d-flex gap-2">
                <button class="ci-btn" data-field="${field}" data-val="good"       onclick="setCi('${field}','good')">Good</button>
                <button class="ci-btn" data-field="${field}" data-val="okay"       onclick="setCi('${field}','okay')">Okay</button>
                <button class="ci-btn" data-field="${field}" data-val="struggling" onclick="setCi('${field}','struggling')">Struggling</button>
              </div>
            </div>`;

  const checkinModal = `
  <div class="modal fade" id="checkinModal" tabindex="-1" aria-hidden="true" aria-label="Check in">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content" style="border-radius:14px;border:none;">
        <div class="modal-header" style="background:linear-gradient(90deg,#2E308E,#2f78c4);color:white;border-radius:14px 14px 0 0;">
          <div>
            <h5 class="modal-title mb-0">How's it going?</h5>
            <small id="checkinSubtitle" style="opacity:0.7;">Rate how each area is going right now</small>
          </div>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body p-4">
          <input type="hidden" id="checkinTargetId">
          <div class="mb-4">
            <label class="form-label fw-bold" style="font-size:0.82rem;">Submitting as</label>
            <div id="checkinSelfDisplay" style="font-size:0.88rem;font-weight:600;color:var(--primary);padding:0.45rem 0.75rem;background:#f0f1f8;border-radius:8px;margin-bottom:0.5rem;">Alex Morgan</div>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" id="checkinOnBehalf" onchange="toggleBehalfDropdown()">
              <label class="form-check-label" for="checkinOnBehalf" style="font-size:0.78rem;color:var(--grey-dark);">On behalf of someone else</label>
            </div>
            <select id="checkinBehalfOf" style="display:none;margin-top:0.5rem;border-radius:8px!important;"></select>
          </div>
          <p class="fw-bold mb-3" style="color:var(--primary);">How's each area feeling right now?</p>
          <div class="d-flex flex-column gap-3 mb-4">
            ${DIMENSIONS.map(dim => ciRow(dim, dimLabel(dim), dimHint(dim))).join("")}
          </div>
          <div class="mb-2">
            <label class="form-label fw-bold">Anything else? <span style="font-weight:400;color:var(--grey-dark);">(optional)</span></label>
            <textarea id="checkinNote" rows="2" placeholder="What's changed since your last check-in? Blockers, wins, or context…"></textarea>
          </div>
          <div id="checkinError" class="text-danger" style="font-size:0.82rem;display:none;"></div>
        </div>
        <div class="modal-footer" style="border-top:1px solid var(--grey-light);">
          <button class="btn-cancel" data-bs-dismiss="modal">Cancel</button>
          <button id="checkinSubmitBtn" class="btn-primary-action" onclick="submitCheckin()" disabled>Submit check-in</button>
        </div>
      </div>
    </div>
  </div>`;

  return editModal + addModal + checkinModal;
}

function injectListPageModals(cfg) {
  const host = document.createElement("div");
  host.id = "modalHost";
  host.innerHTML = listPageModalsHTML(cfg);
  document.body.appendChild(host);
}
