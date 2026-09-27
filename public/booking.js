const form = document.querySelector("#trackForm");
const resultBox = document.querySelector("#bookingResult");
const message = document.querySelector("#trackMessage");
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

const statusDetails = {
  pending: ["New request", "Your request has been received and is waiting for manager review."],
  contacted: ["Manager contacted", "The manager is discussing availability with you."],
  room_offered: ["Room offered", "A room is available. Accept it to receive your private move-in code."],
  awaiting_move_in: ["Awaiting move-in", "Keep your private code safe and give it to the manager only when you arrive."],
  checked_in: ["Check-in recorded", "The manager validated your code. Confirm below only if you have moved in."],
  completed: ["Move-in completed", "You and the manager have both confirmed the successful move-in."],
  cancelled: ["Booking cancelled", "This room request is no longer active."],
  expired: ["Offer expired", "The offer was not accepted before its deadline."],
  disputed: ["Confirmation disputed", "Busitema Stays will review this booking before it is counted as completed."]
};

function credentials() {
  return Object.fromEntries(new FormData(form));
}

function actionsFor(booking) {
  if (booking.status === "room_offered") return '<button class="primary booking-action" data-action="accept">Accept room offer</button><button class="secondary booking-action" data-action="cancel">Decline and cancel</button>';
  if (booking.status === "checked_in") return '<button class="primary booking-action" data-action="confirm_move_in">Confirm I moved in</button><button class="secondary booking-action" data-action="dispute">I did not move in</button>';
  if (["pending", "contacted", "awaiting_move_in"].includes(booking.status)) return '<button class="secondary booking-action" data-action="cancel">Cancel room request</button>';
  if (booking.status === "completed") return '<button class="secondary booking-action" data-action="dispute">Report a problem</button>';
  return "";
}

function renderBooking(booking) {
  const [label, description] = statusDetails[booking.status] || statusDetails.pending;
  resultBox.hidden = false;
  resultBox.innerHTML = `
    <div class="booking-status-head"><div><p class="eyebrow">${escapeHtml(booking.reference)}</p><h2>${escapeHtml(booking.hostelName)}</h2></div><span class="booking-status status-${escapeHtml(booking.status)}">${escapeHtml(label)}</span></div>
    <p class="booking-status-copy">${escapeHtml(description)}</p>
    <dl class="booking-summary"><div><dt>Student</dt><dd>${escapeHtml(booking.fullName)}</dd></div><div><dt>Room</dt><dd>${escapeHtml(booking.roomType)}</dd></div><div><dt>Move-in date</dt><dd>${escapeHtml(booking.moveInDate || "Not specified")}</dd></div></dl>
    ${booking.moveInCode ? `<div class="move-code"><span>Your private move-in code</span><strong>${escapeHtml(booking.moveInCode)}</strong><small>Show this code to the hostel manager only when you physically arrive.</small></div>` : ""}
    <div class="booking-actions">${actionsFor(booking)}</div>
    <p id="actionMessage" class="form-message"></p>`;
  resultBox.querySelectorAll(".booking-action").forEach(button => button.addEventListener("click", () => updateBooking(button.dataset.action, button)));
}

async function loadBooking() {
  const data = credentials();
  message.textContent = "Checking…";
  resultBox.hidden = true;
  const response = await fetch(`/api/bookings/track?reference=${encodeURIComponent(data.reference)}&phone=${encodeURIComponent(data.phone)}`);
  const payload = await response.json();
  message.textContent = response.ok ? "" : payload.error || "Could not find booking";
  if (response.ok) renderBooking(payload.booking);
}

async function updateBooking(action, button) {
  const data = credentials();
  const actionMessage = document.querySelector("#actionMessage");
  button.disabled = true;
  actionMessage.textContent = "Updating…";
  const response = await fetch("/api/bookings/track", { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ ...data, action }) });
  const payload = await response.json();
  if (response.ok) renderBooking(payload.booking);
  else { actionMessage.textContent = payload.error || "Could not update booking"; button.disabled = false; }
}

form.addEventListener("submit", event => { event.preventDefault(); loadBooking(); });
const queryReference = new URLSearchParams(location.search).get("reference");
if (queryReference) form.elements.reference.value = queryReference;
