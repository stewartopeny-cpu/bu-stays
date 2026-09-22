const formatPrice = n => `UGX ${Number(n).toLocaleString("en-UG")}`;
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
let hostels = [...window.DEFAULT_HOSTELS];

const elements = {
  grid: document.querySelector("#hostels"), empty: document.querySelector("#empty"), count: document.querySelector("#resultCount"),
  search: document.querySelector("#search"), price: document.querySelector("#price"), type: document.querySelector("#type"),
  profileDialog: document.querySelector("#profileDialog"), profileForm: document.querySelector("#profileForm"),
  bookingDialog: document.querySelector("#bookingDialog"), bookingForm: document.querySelector("#bookingForm")
};

function mergedHostels(changes) {
  const map = new Map(window.DEFAULT_HOSTELS.map(h => [h.name, { ...h }]));
  for (const change of changes || []) {
    const current = map.get(change.name) || {};
    const next = { ...current, ...change };
    if (typeof next.types === "string") next.types = next.types.split(",").map(v => v.trim()).filter(Boolean);
    if (typeof next.services === "string") next.services = next.services.split(",").map(v => v.trim()).filter(Boolean);
    if (next.status === "inactive") map.delete(change.name); else map.set(change.name, next);
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

function render() {
  const list = filtered();
  elements.count.textContent = `${list.length} of ${hostels.length} hostels match`;
  elements.empty.hidden = list.length > 0;
  elements.grid.innerHTML = list.map((h, index) => `
    <article class="hostel-card">
      <div class="photo-placeholder" aria-label="Photo coming soon"><svg viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M8 29 32 10l24 19v27H39V39H25v17H8Z"/></svg></div>
      <div class="card-body">
        <div class="card-top"><div><h3>${escapeHtml(h.name)}</h3><p class="location">${escapeHtml(h.location)}${h.distance ? ` · ${escapeHtml(h.distance)}` : ""}</p></div><span class="status ${String(h.availability).toLowerCase()==="full"?"full":"available"}">${escapeHtml(h.availability || "Available")}</span></div>
        <div class="price">${formatPrice(h.minPrice)}${Number(h.maxPrice)>Number(h.minPrice)?` – ${formatPrice(h.maxPrice)}`:""}<small> / semester</small></div>
        <p>${escapeHtml((h.types || []).join(" · "))}</p>
        <div class="tags">${(h.services || []).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join("") || '<span class="tag">Utilities paid separately</span>'}</div>
        <div class="card-actions"><button class="primary book" data-index="${hostels.indexOf(h)}" ${String(h.availability).toLowerCase()==="full"?"disabled":""}>${String(h.availability).toLowerCase()==="full"?"Currently full":"Request room"}</button></div>
      </div>
    </article>`).join("");
  document.querySelectorAll(".book").forEach(button => button.addEventListener("click", () => openBooking(hostels[Number(button.dataset.index)])));
}

function profile() { try { return JSON.parse(localStorage.getItem("busitema_student") || "{}"); } catch { return {}; } }
function fill(form, values) { for (const [key, value] of Object.entries(values)) if (form.elements[key]) form.elements[key].value = value || ""; }

function openBooking(hostel) {
  elements.bookingForm.reset(); fill(elements.bookingForm, profile());
  elements.bookingForm.elements.hostelName.value = hostel.name;
  document.querySelector("#bookingTitle").textContent = `Request a room at ${hostel.name}`;
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
  localStorage.setItem("busitema_student", JSON.stringify({ fullName:data.fullName, phone:data.phone, email:data.email }));
  button.disabled = true; document.querySelector("#bookingMessage").textContent = "Sending…";
  try {
    const response = await fetch("/api/bookings", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Request failed");
    document.querySelector("#bookingMessage").textContent = `Request received. Reference: ${result.reference}`;
    setTimeout(() => elements.bookingDialog.close(), 1800);
  } catch (error) { document.querySelector("#bookingMessage").textContent = error.message; }
  finally { button.disabled = false; }
});

[elements.search,elements.price,elements.type,...document.querySelectorAll('.service-filter input')].forEach(el => el.addEventListener("input", render));
document.querySelector("#clearFilters").addEventListener("click", () => { elements.search.value="";elements.price.value="";elements.type.value="";document.querySelectorAll('.service-filter input').forEach(i=>i.checked=false);render(); });
document.querySelector("#profileBtn").addEventListener("click", () => { elements.profileForm.reset();fill(elements.profileForm,profile());elements.profileDialog.showModal(); });
loadChanges();
if (!profile().fullName) setTimeout(() => elements.profileDialog.showModal(), 350);
