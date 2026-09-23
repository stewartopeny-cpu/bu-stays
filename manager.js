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
  select.innerHTML = '<option value="">New hostel</option>' + hostels.map((hostel, index) =>
    `<option value="${index}">${escapeHtml(hostel.name)}${hostel.status === "inactive" ? " · Hidden" : ""}</option>`).join("");
  resetListingActions();
  await loadBookings();
}

function resetListingActions() {
  selectedOriginalName = "";
  document.querySelector("#toggleVisibility").hidden = true;
  document.querySelector("#deleteHostel").hidden = true;
}

function listingPayload(statusOverride) {
  const input = Object.fromEntries(new FormData(form));
  input.minPrice = Number(input.minPrice);
  input.maxPrice = Number(input.maxPrice);
  input.photos = photoUrls;
  input.originalName = selectedOriginalName || input.name;
  if (statusOverride) input.status = statusOverride;
  return input;
}

async function saveListing(input, successMessage) {
  const message = document.querySelector("#saveMessage");
  message.textContent = "Saving…";
  const response = await fetch("/api/manager/hostels", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await response.json();
  message.textContent = response.ok ? successMessage : data.error || "Could not save";
  if (response.ok) await loadDashboard();
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

select.addEventListener("change", () => {
  const selected = select.value;
  form.reset();
  select.value = selected;
  photoUrls = [];
  photoMessage.textContent = "";
  resetListingActions();
  if (selected === "") { renderPhotoPreviews(); return; }
  const hostel = hostels[Number(selected)];
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
  renderPhotoPreviews();
});

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
    form.reset();
    photoUrls = [];
    renderPhotoPreviews();
    await loadDashboard();
  }
});

async function loadBookings() {
  const response = await fetch("/api/manager/bookings");
  const box = document.querySelector("#bookings");
  if (!response.ok) { box.innerHTML = "<p>Bookings will appear after the database is connected.</p>"; return; }
  const data = await response.json();
  box.innerHTML = (data.bookings || []).map(booking => `<div class="booking-row"><strong>${escapeHtml(booking.full_name)}</strong> · ${escapeHtml(booking.hostel_name)}${String(booking.message || "").startsWith("[Waiting list]") ? ' · <span class="waiting-label">Waiting list</span>' : ""}<p>${escapeHtml(booking.phone)}${booking.email ? ` · ${escapeHtml(booking.email)}` : ""}<br>${escapeHtml(booking.room_type)} · Reference ${escapeHtml(booking.reference)}</p><select data-id="${Number(booking.id)}"><option ${booking.status === "pending" ? "selected" : ""}>pending</option><option ${booking.status === "contacted" ? "selected" : ""}>contacted</option><option ${booking.status === "confirmed" ? "selected" : ""}>confirmed</option><option ${booking.status === "cancelled" ? "selected" : ""}>cancelled</option></select></div>`).join("") || "<p>No room requests yet.</p>";
  box.querySelectorAll("select").forEach(status => status.addEventListener("change", () => fetch("/api/manager/bookings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: Number(status.dataset.id), status: status.value })
  })));
}

fetch("/api/manager/hostels").then(response => setLogin(response.status !== 401)).catch(() => setLogin(false));
