const formatPrice = n => `UGX ${Number(n).toLocaleString("en-UG")}`;
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
let hostels = [...window.DEFAULT_HOSTELS];
let quickCategory = "all";

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
    const hostelServices = h.services || [];
    const hostelTypes = h.types || [];
    const isAvailable = String(h.availability || "available").toLowerCase() !== "full";
    const distance = Number.parseFloat(String(h.distance || ""));
    const categoryPass = quickCategory === "all"
      || (quickCategory === "available" && isAvailable)
      || (quickCategory === "budget" && Number(h.minPrice) <= 400000)
      || (quickCategory === "self-contained" && hostelTypes.includes("Self-contained"))
      || (quickCategory === "essentials" && hostelServices.includes("Water") && hostelServices.includes("Electricity"))
      || (quickCategory === "near" && Number.isFinite(distance) && distance <= 2);
    return (!query || text.includes(query)) && Number(h.minPrice) <= price && (!type || hostelTypes.includes(type)) && servicesPass && categoryPass;
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
  return `<div class="photo-wrap"><div class="photo-gallery" role="region" tabindex="0" aria-label="Photos of ${escapeHtml(hostel.name)}. Swipe or use the left and right arrow keys.">
    ${photos.map((url, index) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(hostel.name)} photo ${index + 1}" loading="lazy">`).join("")}
  </div>${photos.length > 1 ? `<button type="button" class="gallery-arrow gallery-prev" aria-label="Previous photo">&#8249;</button><button type="button" class="gallery-arrow gallery-next" aria-label="Next photo">&#8250;</button><span class="photo-count"><b>1</b> / ${photos.length}</span>` : ""}</div>`;
}

function positionGalleryPhotos(root = document) {
  root.querySelectorAll(".photo-gallery img").forEach(image => {
    const position = () => image.classList.toggle("portrait-photo", image.naturalHeight > image.naturalWidth * 1.12);
    if (image.complete && image.naturalWidth) position();
    else image.addEventListener("load", position, { once:true });
  });
}

function activatePhotoGalleries(root = document) {
  root.querySelectorAll(".photo-wrap").forEach(wrap => {
    const gallery = wrap.querySelector(".photo-gallery");
    const images = [...wrap.querySelectorAll(".photo-gallery img")];
    const counter = wrap.querySelector(".photo-count b");
    if (!gallery || images.length < 2) return;
    const updateCounter = () => {
      const page = Math.min(images.length, Math.max(1, Math.round(gallery.scrollLeft / Math.max(gallery.clientWidth, 1)) + 1));
      if (counter) counter.textContent = String(page);
    };
    const move = direction => gallery.scrollBy({ left: direction * gallery.clientWidth, behavior:"smooth" });
    wrap.querySelector(".gallery-prev")?.addEventListener("click", event => { event.stopPropagation(); move(-1); });
    wrap.querySelector(".gallery-next")?.addEventListener("click", event => { event.stopPropagation(); move(1); });
    gallery.addEventListener("scroll", updateCounter, { passive:true });
    gallery.addEventListener("keydown", event => {
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
    });
    updateCounter();
  });
}

function render() {
  const list = filtered();
  elements.count.textContent = `${list.length} of ${hostels.length} hostels match`;
  const heroCount = document.querySelector("#heroResultCount");
  if (heroCount) heroCount.textContent = `${list.length} ${list.length === 1 ? "hostel matches" : "hostels match"} your search and filters.`;
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
  positionGalleryPhotos(elements.grid);
  activatePhotoGalleries(elements.grid);
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
  positionGalleryPhotos(elements.exploreContent);
  activatePhotoGalleries(elements.exploreContent);
  elements.exploreContent.querySelector(".close-explore").addEventListener("click", () => elements.exploreDialog.close());
  elements.exploreContent.querySelector(".explore-request").addEventListener("click", () => {
    elements.exploreDialog.close();
    openBooking(hostel, isFull);
  });
  elements.exploreDialog.showModal();
}

function openBooking(hostel, waitingList = false) {
  elements.bookingForm.reset(); fill(elements.bookingForm, profile());
  document.querySelector("#bookingTrackLink").hidden = true;
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
    const trackLink = document.querySelector("#bookingTrackLink");
    trackLink.href = result.trackingUrl || `/booking.html?reference=${encodeURIComponent(result.reference)}`;
    trackLink.hidden = false;
  } catch (error) { document.querySelector("#bookingMessage").textContent = error.message; }
  finally { button.disabled = false; }
});

[elements.price,elements.type,...document.querySelectorAll('.service-filter input')].forEach(el => el.addEventListener("input", render));
elements.search.addEventListener("input", () => { render(); renderSuggestions(); });
elements.search.addEventListener("focus", renderSuggestions);
elements.search.addEventListener("blur", () => setTimeout(() => { elements.suggestions.hidden = true; }, 150));
document.querySelector("#clearFilters").addEventListener("click", () => {
  elements.search.value = "";
  elements.price.value = "";
  elements.type.value = "";
  elements.suggestions.hidden = true;
  quickCategory = "all";
  document.querySelectorAll('.service-filter input').forEach(input => input.checked = false);
  document.querySelectorAll(".quick-categories button").forEach(button => button.classList.toggle("active", button.dataset.category === "all"));
  render();
});
document.querySelectorAll(".quick-categories button").forEach(button => button.addEventListener("click", () => {
  quickCategory = button.dataset.category || "all";
  document.querySelectorAll(".quick-categories button").forEach(item => item.classList.toggle("active", item === button));
  render();
  document.querySelector("#hostels")?.scrollIntoView({ behavior:"smooth", block:"start" });
}));
document.querySelector("#profileBtn").addEventListener("click", () => { elements.profileForm.reset();fill(elements.profileForm,profile());elements.profileDialog.showModal(); });
document.querySelectorAll("[data-close-dialog], .cancel-dialog").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
[elements.profileDialog, elements.bookingDialog, elements.exploreDialog].forEach(dialog => dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); }));
loadChanges();
if (!profile().fullName) setTimeout(() => elements.profileDialog.showModal(), 350);
