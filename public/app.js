const formatPrice = n => `UGX ${Number(n).toLocaleString("en-UG")}`;
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
let hostels = [...window.DEFAULT_HOSTELS];

const elements = {
  grid: document.querySelector("#hostels"), empty: document.querySelector("#empty"), count: document.querySelector("#resultCount"),
  search: document.querySelector("#search"), price: document.querySelector("#price"), type: document.querySelector("#type"),
  suggestions: document.querySelector("#searchSuggestions"),
  profileDialog: document.querySelector("#profileDialog"), profileForm: document.querySelector("#profileForm"),
  bookingDialog: document.querySelector("#bookingDialog"), bookingForm: document.querySelector("#bookingForm"),
  exploreDialog: document.querySelector("#exploreDialog"), exploreContent: document.querySelector("#exploreContent")
};

function mergedHostels(changes) {
  const map = new Map(window.DEFAULT_HOSTELS.map(h => [h.name, { ...h }]));
  for (const change of changes || []) {
    const current = map.get(change.name) || {};
    const next = { ...current, ...change };
    if (typeof next.types === "string") next.types = next.types.split(",").map(v => v.trim()).filter(Boolean);
    if (typeof next.services === "string") next.services = next.services.split(",").map(v => v.trim()).filter(Boolean);
    if (next.status === "inactive" || next.status === "deleted") map.delete(change.name); else map.set(change.name, next);
  }
  return [...map.values()];
}

async function loadChanges() {
  try {
    const response = await fetch("/api/hostels");
    const data = await response.json();
    hostels = mergedHostels(data.hostels);
  } catch { hostels = [...window.DEFAULT_HOSTELS]; }
  render();
}

function filtered() {
  const query = elements.search.value.trim().toLowerCase();
  const price = Number(elements.price.value || Infinity);
  const type = elements.type.value;
  const services = [...document.querySelectorAll('.service-filter input:checked')].map(i => i.value);
  return hostels.filter(h => {
    const text = `${h.name} ${h.location} ${h.notes || ""}`.toLowerCase();
    const serviceMatches = services.filter(s => (h.services || []).includes(s)).length;
    const servicesPass = services.length === 0 || serviceMatches >= Math.min(2, services.length);
    return (!query || text.includes(query)) && Number(h.minPrice) <= price && (!type || (h.types || []).includes(type)) && servicesPass;
  });
}

function renderSuggestions() {
  const query = elements.search.value.trim().toLowerCase();
  if (!query) { elements.suggestions.hidden = true; elements.suggestions.innerHTML = ""; return; }
  const matches = hostels
    .filter(hostel => `${hostel.name} ${hostel.location || ""}`.toLowerCase().includes(query))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(query)) - Number(!b.name.toLowerCase().startsWith(query)))
    .slice(0, 6);
  if (!matches.length) { elements.suggestions.hidden = true; elements.suggestions.innerHTML = ""; return; }
  elements.suggestions.innerHTML = matches.map(hostel => `<button type="button" role="option" data-name="${escapeHtml(hostel.name)}"><strong>${escapeHtml(hostel.name)}</strong><span>${escapeHtml(hostel.location || "Near Busitema University")}</span></button>`).join("");
  elements.suggestions.hidden = false;
  elements.suggestions.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    elements.search.value = button.dataset.name;
    elements.suggestions.hidden = true;
    render();
    elements.search.focus();
  }));
}

function photoGallery(hostel) {
  const photos = Array.isArray(hostel.photos) ? hostel.photos.filter(url => String(url).startsWith("/photos/")).slice(0, 5) : [];
  if (!photos.length) return '<div class="photo-placeholder" aria-label="Photo coming soon"><svg viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M8 29 32 10l24 19v27H39V39H25v17H8Z"/></svg></div>';
  return `<div class="photo-wrap"><div class="photo-gallery" role="region" aria-label="Photos of ${escapeHtml(hostel.name)}">
    ${photos.map((url, index) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(hostel.name)} photo ${index + 1}" loading="lazy">`).join("")}
  </div>${photos.length > 1 ? `<span class="photo-count">Swipe · ${photos.length} photos</span>` : ""}</div>`;
}

function render() {
  const list = filtered();
  elements.count.textContent = `${list.length} of ${hostels.length} hostels match`;
  elements.empty.hidden = list.length > 0;
  elements.grid.innerHTML = list.map((h, index) => `
    <article class="hostel-card">
      ${photoGallery(h)}
      <div class="card-body">
        <div class="card-top"><div><h3>${escapeHtml(h.name)}</h3><p class="location">${escapeHtml(h.location)}${h.distance ? ` · ${escapeHtml(h.distance)}` : ""}</p></div><span class="status ${String(h.availability).toLowerCase()==="full"?"full":"available"}">${escapeHtml(h.availability || "Available")}</span></div>
        <div class="price">${formatPrice(h.minPrice)}${Number(h.maxPrice)>Number(h.minPrice)?` – ${formatPrice(h.maxPrice)}`:""}<small> / semester</small></div>
        <p>${escapeHtml((h.types || []).join(" · "))}</p>
        <div class="tags">${(h.services || []).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join("") || '<span class="tag">Utilities paid separately</span>'}</div>
        <div class="card-actions"><button class="primary explore" data-index="${hostels.indexOf(h)}">Explore hostel</button></div>
      </div>
    </article>`).join("");
  document.querySelectorAll(".explore").forEach(button => button.addEventListener("click", () => openExplore(hostels[Number(button.dataset.index)])));
}

function profile() { try { return JSON.parse(localStorage.getItem("busitema_student") || "{}"); } catch { return {}; } }
function fill(form, values) { for (const [key, value] of Object.entries(values)) if (form.elements[key]) form.elements[key].value = value || ""; }

function openExplore(hostel) {
  const isFull = String(hostel.availability).toLowerCase() === "full";
  const roomTypes = Array.isArray(hostel.types) ? hostel.types : [];
  const services = Array.isArray(hostel.services) ? hostel.services : [];
  const price = Number(hostel.maxPrice) > Number(hostel.minPrice)
    ? `${formatPrice(hostel.minPrice)}–${formatPrice(hostel.maxPrice)}`
    : formatPrice(hostel.minPrice);
  elements.exploreContent.innerHTML = `
    <div class="explore-gallery">${photoGallery(hostel)}</div>
    <div class="explore-body">
      <p class="eyebrow">HOSTEL DETAILS</p>
      <h2>${escapeHtml(hostel.name)}</h2>
      <p class="explore-location">⌖ ${escapeHtml(hostel.location || "Near Busitema University")}</p>
      ${isFull ? `<div class="occupancy-notice"><strong>Currently fully occupied</strong><span>No rooms are available now. You can still explore the hostel and join the waiting list.</span></div>` : `<div class="availability-notice"><strong>Rooms currently available</strong><span>Send a room request to contact the hostel manager.</span></div>`}
      <section class="detail-section"><h3>Room and price</h3><div class="detail-box">
        ${hostel.distance ? `<p><strong>Distance:</strong> ${escapeHtml(hostel.distance)}</p>` : ""}
        <p><strong>Room type:</strong> ${escapeHtml(roomTypes.join(" & ") || "Contact manager")}</p>
        <p><strong>Price:</strong> ${price} per semester</p>
        ${hostel.rooms ? `<p><strong>Rooms:</strong> ${escapeHtml(hostel.rooms)}</p>` : ""}
      </div></section>
      <section class="detail-section"><h3>Included services</h3><div class="explore-services">${services.map(service => `<span class="detail-service">${escapeHtml(service)}</span>`).join("") || '<span class="detail-service">Utilities paid separately</span>'}</div></section>
      <section class="detail-section"><h3>What you should know</h3><div class="detail-box">
        <p><strong>Gender arrangement:</strong> ${escapeHtml(hostel.gender || "Contact manager")}</p>
        ${hostel.electricity ? `<p><strong>Electricity:</strong> ${escapeHtml(hostel.electricity)}</p>` : ""}
        ${hostel.notes ? `<p><strong>Additional details:</strong> ${escapeHtml(hostel.notes)}</p>` : ""}
      </div></section>
      <div class="explore-actions"><button type="button" class="secondary close-explore">Continue browsing</button><button type="button" class="primary explore-request">${isFull ? "Join waiting list" : "Request room"}</button></div>
    </div>`;
  elements.exploreContent.querySelector(".close-explore").addEventListener("click", () => elements.exploreDialog.close());
  elements.exploreContent.querySelector(".explore-request").addEventListener("click", () => {
    elements.exploreDialog.close();
    openBooking(hostel, isFull);
  });
  elements.exploreDialog.showModal();
}

function openBooking(hostel, waitingList = false) {
  elements.bookingForm.reset(); fill(elements.bookingForm, profile());
  elements.bookingForm.elements.hostelName.value = hostel.name;
  elements.bookingForm.dataset.waitingList = waitingList ? "true" : "false";
  document.querySelector("#bookingTitle").textContent = waitingList ? `Join the waiting list for ${hostel.name}` : `Request a room at ${hostel.name}`;
  elements.bookingForm.querySelector(".dialog-actions .primary").textContent = waitingList ? "Join waiting list" : "Send room request";
  document.querySelector("#bookingMessage").textContent = "";
  elements.bookingDialog.showModal();
}

elements.profileForm.addEventListener("submit", event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(elements.profileForm));
  localStorage.setItem("busitema_student", JSON.stringify(data));
  elements.profileDialog.close();
});

elements.bookingForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = elements.bookingForm.querySelector(".primary");
  const data = Object.fromEntries(new FormData(elements.bookingForm));
  if (elements.bookingForm.dataset.waitingList === "true") data.message = `[Waiting list] ${data.message || "Please contact me when a room becomes available."}`;
  localStorage.setItem("busitema_student", JSON.stringify({ fullName:data.fullName, phone:data.phone, email:data.email }));
  button.disabled = true; document.querySelector("#bookingMessage").textContent = "Sending…";
  try {
    const response = await fetch("/api/bookings", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Request failed");
    document.querySelector("#bookingMessage").textContent = `${elements.bookingForm.dataset.waitingList === "true" ? "Waiting-list request" : "Room request"} received. Reference: ${result.reference}`;
    setTimeout(() => elements.bookingDialog.close(), 1800);
  } catch (error) { document.querySelector("#bookingMessage").textContent = error.message; }
  finally { button.disabled = false; }
});

[elements.price,elements.type,...document.querySelectorAll('.service-filter input')].forEach(el => el.addEventListener("input", render));
elements.search.addEventListener("input", () => { render(); renderSuggestions(); });
elements.search.addEventListener("focus", renderSuggestions);
elements.search.addEventListener("blur", () => setTimeout(() => { elements.suggestions.hidden = true; }, 150));
document.querySelector("#clearFilters").addEventListener("click", () => { elements.search.value="";elements.price.value="";elements.type.value="";elements.suggestions.hidden=true;document.querySelectorAll('.service-filter input').forEach(i=>i.checked=false);render(); });
document.querySelector("#profileBtn").addEventListener("click", () => { elements.profileForm.reset();fill(elements.profileForm,profile());elements.profileDialog.showModal(); });
document.querySelectorAll("[data-close-dialog], .cancel-dialog").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
[elements.profileDialog, elements.bookingDialog, elements.exploreDialog].forEach(dialog => dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); }));
loadChanges();
if (!profile().fullName) setTimeout(() => elements.profileDialog.showModal(), 350);
