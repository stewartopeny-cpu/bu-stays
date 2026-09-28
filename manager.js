const loginView = document.querySelector("#loginView");
const dashboard = document.querySelector("#dashboard");
const form = document.querySelector("#hostelForm");
const select = document.querySelector("#hostelSelect");
const photoFiles = document.querySelector("#photoFiles");
const photoMessage = document.querySelector("#photoMessage");
const photoPreviews = document.querySelector("#photoPreviews");
let hostels = [...window.DEFAULT_HOSTELS];
let photoUrls = [];
let selectedOriginalName = "";

const splitList = value => String(value || "").split(",").map(item => item.trim()).filter(Boolean);

const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[character]));

const setLogin = loggedIn => {
  loginView.hidden = loggedIn;
  dashboard.hidden = !loggedIn;
  document.querySelector("#logout").hidden = !loggedIn;
  if (loggedIn) loadDashboard();
};

document.querySelector("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const message = document.querySelector("#loginMessage");
  message.textContent = "Signing in…";
  const password = new FormData(event.currentTarget).get("password");
  const response = await fetch("/api/manager/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password })
  });
  const result = await response.json();
  if (response.ok) setLogin(true); else message.textContent = result.error || "Sign-in failed";
});

document.querySelector("#logout").addEventListener("click", async () => {
  await fetch("/api/manager/logout", { method: "POST" });
  setLogin(false);
});

async function loadDashboard() {
  const response = await fetch("/api/manager/hostels");
  if (response.status === 401) { setLogin(false); return; }
  const data = await response.json();
  document.querySelector("#dbNotice").hidden = data.database !== false;
  const map = new Map(window.DEFAULT_HOSTELS.map(hostel => [hostel.name, { ...hostel }]));
  for (const change of data.hostels || []) {
    if (change.status === "deleted") map.delete(change.name);
    else map.set(change.name, { ...(map.get(change.name) || {}), ...change });
  }
  hostels = [...map.values()];
  const selectedName = selectedOriginalName;
  select.innerHTML = '<option value="">Add a new hostel</option>' + hostels.map(hostel =>
    `<option value="${escapeHtml(hostel.name)}">${escapeHtml(hostel.name)}${hostel.status === "inactive" ? " · Hidden" : ""}</option>`).join("");
  if (selectedName && hostels.some(hostel => hostel.name === selectedName)) select.value = selectedName;
  else if (selectedName) resetEditor();
  await loadBookings();
}

function resetListingActions() {
  selectedOriginalName = "";
  document.querySelector("#toggleVisibility").hidden = true;
  document.querySelector("#deleteHostel").hidden = true;
}

function setEditorMode(hostel) {
  const editing = Boolean(hostel);
  document.querySelector("#listingFormTitle").textContent = editing ? `Editing ${hostel.name}` : "Add a hostel";
  document.querySelector("#editingNotice").textContent = editing ? "Update the details below, then press Save changes." : "Enter the details for the new hostel.";
  document.querySelector("#saveListing").textContent = editing ? "Save changes" : "Add hostel";
  document.querySelector("#cancelEdit").hidden = !editing;
}

function resetEditor() {
  form.reset();
  select.value = "";
  photoUrls = [];
  photoFiles.value = "";
  photoMessage.textContent = "";
  document.querySelector("#saveMessage").textContent = "";
  resetListingActions();
  setEditorMode(null);
  renderPhotoPreviews();
}

function listingPayload(statusOverride) {
  const input = Object.fromEntries(new FormData(form));
  input.minPrice = Number(input.minPrice);
  input.maxPrice = Number(input.maxPrice);
  input.types = splitList(input.types);
  input.services = splitList(input.services);
  input.photos = photoUrls;
  input.originalName = selectedOriginalName || input.name;
  if (statusOverride) input.status = statusOverride;
  return input;
}

async function saveListing(input, successMessage) {
  const message = document.querySelector("#saveMessage");
  if (!Number.isFinite(input.minPrice) || !Number.isFinite(input.maxPrice) || input.minPrice < 0 || input.maxPrice < input.minPrice) {
    message.textContent = "Check the prices: maximum price must be equal to or higher than minimum price.";
    return false;
  }
  message.textContent = "Saving…";
  const saveButton = document.querySelector("#saveListing");
  saveButton.disabled = true;
  const response = await fetch("/api/manager/hostels", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await response.json().catch(() => ({}));
  saveButton.disabled = false;
  message.textContent = response.ok ? successMessage : data.error || "Could not save";
  if (response.ok) {
    selectedOriginalName = input.name;
    await loadDashboard();
    const saved = hostels.find(hostel => hostel.name === input.name);
    if (saved) populateEditor(saved);
    message.textContent = successMessage;
  }
  return response.ok;
}

function renderPhotoPreviews() {
  photoPreviews.innerHTML = photoUrls.map((url, index) => `
    <figure class="photo-preview">
      <img src="${escapeHtml(url)}" alt="Hostel photo ${index + 1}">
      <button type="button" class="remove-photo" data-index="${index}" aria-label="Remove photo ${index + 1}">Remove</button>
    </figure>`).join("");
  photoPreviews.querySelectorAll(".remove-photo").forEach(button => button.addEventListener("click", async () => {
    const index = Number(button.dataset.index);
    const url = photoUrls[index];
    button.disabled = true;
    photoMessage.textContent = "Removing photo…";
    const response = await fetch("/api/manager/photos", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = await response.json();
    if (!response.ok) { photoMessage.textContent = data.error || "Could not remove photo"; button.disabled = false; return; }
    photoUrls.splice(index, 1);
    photoMessage.textContent = "Photo removed. Save the listing to keep this change.";
    renderPhotoPreviews();
  }));
}

function populateEditor(hostel) {
  form.reset();
  select.value = hostel.name;
  photoUrls = [];
  photoMessage.textContent = "";
  resetListingActions();
  selectedOriginalName = hostel.name;
  for (const [key, value] of Object.entries(hostel)) {
    if (!form.elements[key]) continue;
    form.elements[key].value = Array.isArray(value) ? value.join(", ") : value ?? "";
  }
  photoUrls = Array.isArray(hostel.photos) ? hostel.photos.slice(0, 5) : [];
  const visibilityButton = document.querySelector("#toggleVisibility");
  visibilityButton.hidden = false;
  visibilityButton.textContent = hostel.status === "inactive" ? "Show on public website" : "Hide from public website";
  document.querySelector("#deleteHostel").hidden = false;
  setEditorMode(hostel);
  renderPhotoPreviews();
}

select.addEventListener("change", () => {
  const hostel = hostels.find(item => item.name === select.value);
  if (!hostel) { resetEditor(); return; }
  populateEditor(hostel);
});

document.querySelector("#cancelEdit").addEventListener("click", resetEditor);

document.querySelector("#uploadPhotos").addEventListener("click", async () => {
  const hostelName = form.elements.name.value.trim();
  const files = [...photoFiles.files];
  if (!hostelName) { photoMessage.textContent = "Choose or enter the hostel name first."; return; }
  if (!files.length) { photoMessage.textContent = "Select at least one photo."; return; }
  if (photoUrls.length + files.length > 5) { photoMessage.textContent = "A hostel can have a maximum of five photos."; return; }
  const button = document.querySelector("#uploadPhotos");
  button.disabled = true;
  try {
    for (let index = 0; index < files.length; index += 1) {
      photoMessage.textContent = `Uploading photo ${index + 1} of ${files.length}…`;
      const upload = new FormData();
      upload.append("photo", files[index]);
      const response = await fetch(`/api/manager/photos?hostel=${encodeURIComponent(hostelName)}`, { method: "POST", body: upload });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Photo upload failed");
      photoUrls.push(data.url);
      renderPhotoPreviews();
    }
    photoFiles.value = "";
    photoMessage.textContent = "Photos uploaded. Now save the listing.";
  } catch (error) {
    photoMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  await saveListing(listingPayload(), "Listing and photos saved successfully.");
});

document.querySelector("#toggleVisibility").addEventListener("click", async () => {
  if (!selectedOriginalName) return;
  const isHidden = form.elements.status.value === "inactive";
  const nextStatus = isHidden ? "active" : "inactive";
  await saveListing(listingPayload(nextStatus), nextStatus === "inactive" ? "Hostel removed from the public website." : "Hostel is visible on the public website again.");
});

document.querySelector("#deleteHostel").addEventListener("click", async () => {
  if (!selectedOriginalName) return;
  if (!confirm(`Permanently delete ${selectedOriginalName}? This cannot be undone.`)) return;
  const message = document.querySelector("#saveMessage");
  message.textContent = "Deleting…";
  const response = await fetch("/api/manager/hostels", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: selectedOriginalName, photos: photoUrls })
  });
  const data = await response.json();
  message.textContent = response.ok ? "Hostel permanently deleted." : data.error || "Could not delete hostel";
  if (response.ok) {
    resetEditor();
    await loadDashboard();
  }
});

async function loadBookings() {
  const response = await fetch("/api/manager/bookings");
  const box = document.querySelector("#bookings");
  if (!response.ok) { box.innerHTML = "<p>Bookings will appear after the database is connected.</p>"; return; }
  const data = await response.json();
  const bookings = data.bookings || [];
  const labels = { pending:"New request", contacted:"Contacted", room_offered:"Room offered", awaiting_move_in:"Awaiting move-in", checked_in:"Awaiting student confirmation", completed:"Completed", cancelled:"Cancelled", expired:"Expired", disputed:"Disputed" };
  const stats = { active:bookings.filter(b => ["pending","contacted","room_offered","awaiting_move_in","checked_in"].includes(b.status)).length, completed:bookings.filter(b => b.status === "completed").length, disputed:bookings.filter(b => b.status === "disputed").length };
  document.querySelector("#bookingStats").innerHTML = `<div><strong>${stats.active}</strong><span>Active</span></div><div><strong>${stats.completed}</strong><span>Completed</span></div><div><strong>${stats.disputed}</strong><span>Disputed</span></div>`;
  box.innerHTML = bookings.map(booking => {
    const status = booking.status === "confirmed" ? "completed" : booking.status;
    let controls = "";
    if (status === "pending") controls = `<button class="secondary booking-manager-action" data-action="contact" data-id="${Number(booking.id)}">Mark contacted</button>`;
    if (["pending","contacted"].includes(status)) controls += `<button class="primary booking-manager-action" data-action="offer" data-id="${Number(booking.id)}">Offer room</button>`;
    if (status === "awaiting_move_in") controls = `<form class="check-in-form" data-id="${Number(booking.id)}"><input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="6-digit code" required><button class="primary">Check in</button></form>`;
    if (status === "disputed") controls = `<button class="primary booking-manager-action" data-action="resolve_complete" data-id="${Number(booking.id)}">Resolve as completed</button><button class="secondary booking-manager-action" data-action="resolve_cancel" data-id="${Number(booking.id)}">Resolve as cancelled</button>`;
    if (!["completed","cancelled","expired","disputed"].includes(status)) controls += `<button class="secondary booking-manager-action" data-action="cancel" data-id="${Number(booking.id)}">Cancel</button>`;
    return `<article class="booking-row"><div class="booking-row-head"><strong>${escapeHtml(booking.full_name)} · ${escapeHtml(booking.hostel_name)}</strong><span class="booking-status status-${escapeHtml(status)}">${escapeHtml(labels[status] || status)}</span></div>${String(booking.message || "").startsWith("[Waiting list]") ? '<span class="waiting-label">Waiting list</span>' : ""}<p><a href="tel:${escapeHtml(booking.phone)}">${escapeHtml(booking.phone)}</a>${booking.email ? ` · ${escapeHtml(booking.email)}` : ""}<br>${escapeHtml(booking.room_type)} · Reference <strong>${escapeHtml(booking.reference)}</strong></p><div class="manager-booking-actions">${controls}</div><p class="form-message booking-action-message" data-message-id="${Number(booking.id)}"></p></article>`;
  }).join("") || "<p>No room requests yet.</p>";
  box.querySelectorAll(".booking-manager-action").forEach(button => button.addEventListener("click", () => updateBooking(Number(button.dataset.id), button.dataset.action, null, button)));
  box.querySelectorAll(".check-in-form").forEach(checkIn => checkIn.addEventListener("submit", event => { event.preventDefault(); const submit = checkIn.querySelector("button"); updateBooking(Number(checkIn.dataset.id), "check_in", new FormData(checkIn).get("code"), submit); }));
}

async function updateBooking(id, action, code, button) {
  const message = document.querySelector(`[data-message-id="${id}"]`);
  button.disabled = true;
  message.textContent = "Updating…";
  const response = await fetch("/api/manager/bookings", { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ id, action, code }) });
  const data = await response.json();
  if (response.ok) await loadBookings();
  else { message.textContent = data.error || "Could not update booking"; button.disabled = false; }
}

document.querySelector("#refreshBookings").addEventListener("click", loadBookings);

fetch("/api/manager/hostels").then(response => setLogin(response.status !== 401)).catch(() => setLogin(false));
