/* CLIMBORA — logic bersama seluruh halaman (versi SPA single-page)
   Data dioper antar-"halaman" (section) lewat objek state JS, bukan lagi query string,
   karena semua sekarang jadi satu index.html. */

const TICKET_KEY = "climbora_tickets";
const USERS_KEY = "climbora_users";

function saveTicket(t){
  const list = JSON.parse(localStorage.getItem(TICKET_KEY) || "[]");
  list.unshift({ ...t, ownerEmail: state.userEmail || "" });
  localStorage.setItem(TICKET_KEY, JSON.stringify(list));
}
function getTickets(){
  const list = JSON.parse(localStorage.getItem(TICKET_KEY) || "[]");
  return list.filter(t => t.ownerEmail === state.userEmail);
}

function getUsers(){
  return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
}
function saveUsers(list){
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
}

function fmtRupiah(n){
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

const NAMA_BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

/* Format "2026-08-22" -> "22 Agustus 2026" */
function fmtTanggalIndo(dateStr){
  if(!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  if(isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/* Tambahkan sejumlah hari ke "2026-08-22", hasil tetap format "YYYY-MM-DD".
   Pakai komponen UTC eksplisit supaya tidak bergeser karena timezone lokal (WIB dst). */
function addDaysToDateStr(dateStr, days){
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/* ---------- state bersama antar-section ---------- */
const state = {
  user: "",
  userEmail: "",
  currentItem: null,
  booking: {}, // itemName, itemImg, nama, hp, email, tanggal, qty, days, total, metode, trx
  pageHistory: [] // stack nama halaman untuk tombol "Kembali"
};

/* ---------- router sederhana antar section ---------- */
function showPage(page, opts = {}){
  const authPages = ["daftar", "masuk"];

  // catat halaman sebelumnya ke history, kecuali saat navigasi ini
  // sendiri berasal dari tombol "Kembali" (opts.skipHistory)
  if(!opts.skipHistory){
    const currentActive = document.querySelector(".page.active");
    if(currentActive){
      const currentId = currentActive.id.replace("page-", "");
      if(currentId !== page){
        state.pageHistory.push(currentId);
      }
    }
  }

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById("page-" + page);
  if(target) target.classList.add("active");

  const topbar = document.getElementById("topbar");
  topbar.style.display = authPages.includes(page) ? "none" : "flex";

  document.querySelectorAll(".topbar-nav [data-nav]").forEach(el=>{
    el.classList.toggle("active", el.dataset.nav === page);
  });

  updateBackButton(page);
  window.scrollTo(0, 0);
}

/* Tombol kembali cuma tampil di halaman "tengah alur" (booking, pembayaran,
   struk) yang memang punya langkah sebelumnya untuk dituju. Disembunyikan di
   katalog & tiket karena keduanya sudah punya menu navigasi sendiri, dan di
   daftar/masuk karena topbar-nya memang disembunyikan. */
function updateBackButton(page){
  const btn = document.getElementById("btn-back");
  if(!btn) return;
  const hideOn = ["katalog", "tiket", "daftar", "masuk"];
  const shouldShow = !hideOn.includes(page) && state.pageHistory.length > 0;
  btn.classList.toggle("show", shouldShow);
}

function goBack(){
  if(state.pageHistory.length === 0) return;
  const prev = state.pageHistory.pop();
  showPage(prev, { skipHistory: true });
}

function initBackButton(){
  const btn = document.getElementById("btn-back");
  if(!btn) return;
  btn.addEventListener("click", goBack);
}

function loginAs(nama, email){
  state.user = nama;
  state.userEmail = (email || "").toLowerCase();
  document.getElementById("user-label").textContent = "Halo, " + nama;
  showPage("katalog");
}

/* ---------- daftar (buat akun baru) ---------- */
function initDaftar(){
  const form = document.getElementById("daftar-form");
  const errEl = document.getElementById("daftar-error");

  form.addEventListener("submit", e=>{
    e.preventDefault();
    const nama = document.getElementById("daftar-nama").value.trim();
    const email = document.getElementById("daftar-email").value.trim().toLowerCase();
    const password = document.getElementById("daftar-password").value;

    errEl.style.display = "none";
    if(!nama || !email || !password){
      errEl.textContent = "Nama, email, dan kata sandi wajib diisi.";
      errEl.style.display = "block";
      return;
    }

    const users = getUsers();
    if(users.some(u => u.email === email)){
      errEl.textContent = "Email ini sudah terdaftar. Silakan masuk lewat \"Masuk di sini\".";
      errEl.style.display = "block";
      return;
    }

    users.push({ nama, email, password });
    saveUsers(users);
    form.reset();
    loginAs(nama, email);
  });

  document.getElementById("ke-masuk-link").addEventListener("click", e=>{
    e.preventDefault();
    document.getElementById("masuk-error").style.display = "none";
    showPage("masuk");
  });
}

/* ---------- masuk (akun sudah terdaftar) ---------- */
function initMasuk(){
  const form = document.getElementById("masuk-form");
  const errEl = document.getElementById("masuk-error");

  form.addEventListener("submit", e=>{
    e.preventDefault();
    const email = document.getElementById("masuk-email").value.trim().toLowerCase();
    const password = document.getElementById("masuk-password").value;

    errEl.style.display = "none";
    if(!email || !password){
      errEl.textContent = "Email dan kata sandi wajib diisi.";
      errEl.style.display = "block";
      return;
    }

    const users = getUsers();
    const found = users.find(u => u.email === email && u.password === password);
    if(!found){
      errEl.textContent = "Email atau kata sandi salah, atau akun belum terdaftar.";
      errEl.style.display = "block";
      return;
    }

    form.reset();
    loginAs(found.nama, found.email);
  });

  document.getElementById("ke-daftar-link").addEventListener("click", e=>{
    e.preventDefault();
    document.getElementById("daftar-error").style.display = "none";
    showPage("daftar");
  });
}

/* ---------- katalog: kartunya sudah statis di HTML, JS cuma urus filter & klik pesan ---------- */
function initKatalogFilter(){
  const chipsWrap = document.getElementById("filter-chips");
  const cards = document.querySelectorAll("#catalog-grid .card");

  chipsWrap.querySelectorAll(".chip").forEach(chip=>{
    chip.addEventListener("click", ()=>{
      chipsWrap.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active");
      const cat = chip.dataset.cat;
      cards.forEach(card=>{
        card.style.display = (cat === "Semua" || card.dataset.cat === cat) ? "" : "none";
      });
    });
  });
}

function initKatalogOrder(){
  document.querySelectorAll("#catalog-grid [data-order]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const card = btn.closest(".card");
      const imgEl = card.querySelector(".card-img");
      const descEl = card.querySelector(".desc");
      state.currentItem = {
        id: card.dataset.id,
        name: card.dataset.name,
        desc: descEl ? descEl.textContent : "",
        price: parseInt(card.dataset.price, 10) || 0,
        unit: card.dataset.unit || "hari",
        cat: card.dataset.cat,
        img: imgEl ? imgEl.getAttribute("src") : ""
      };
      renderBooking();
      showPage("booking");
    });
  });
}

/* ---------- booking ---------- */
function renderBooking(){
  const item = state.currentItem;
  if(!item) return;

  document.getElementById("sum-img").src = item.img;
  document.getElementById("sum-img").alt = item.name;
  document.getElementById("sum-name").textContent = item.name;
  document.getElementById("sum-price").textContent = fmtRupiah(item.price) + " / hari / unit";

  const form = document.getElementById("booking-form");
  form.reset();
  const qtyInput = document.getElementById("qty");
  const daysInput = document.getElementById("days");
  qtyInput.value = 1;
  daysInput.value = 1;
  const totalEl = document.getElementById("total-amount");
  const subEl = document.getElementById("sub-amount");
  document.getElementById("booking-error").style.display = "none";

  function recalc(){
    const qty = Math.max(1, parseInt(qtyInput.value || "1", 10));
    const days = Math.max(1, parseInt(daysInput.value || "1", 10));
    const sub = item.price * qty * days;
    subEl.textContent = fmtRupiah(sub);
    totalEl.textContent = fmtRupiah(sub);
    return sub;
  }
  qtyInput.oninput = recalc;
  daysInput.oninput = recalc;
  recalc();

  form.onsubmit = e=>{
    e.preventDefault();
    const nama = document.getElementById("nama-booking").value.trim();
    const hp = document.getElementById("hp").value.trim();
    const email = document.getElementById("email-booking").value.trim();
    const tanggal = document.getElementById("tanggal").value;
    const qty = Math.max(1, parseInt(qtyInput.value || "1", 10));
    const days = Math.max(1, parseInt(daysInput.value || "1", 10));
    const errEl = document.getElementById("booking-error");
    if(!nama || !hp || !email || !tanggal){
      errEl.textContent = "Lengkapi semua data terlebih dahulu.";
      errEl.style.display = "block";
      return;
    }
    errEl.style.display = "none";
    const total = item.price * qty * days;
    const tanggalSelesai = addDaysToDateStr(tanggal, days);
    const periode = `${fmtTanggalIndo(tanggal)} – ${fmtTanggalIndo(tanggalSelesai)}`;
    state.booking = {
      item: item.id, itemName: item.name, itemImg: item.img,
      nama, hp, email, tanggal, tanggalSelesai, qty, days, total,
      detail: `${qty} unit x ${days} hari`,
      periode
    };
    renderPembayaran();
    showPage("pembayaran");
  };
}

/* ---------- pembayaran (QRIS langsung) ---------- */
function renderPembayaran(){
  const p = state.booking;
  document.getElementById("pay-item").textContent = p.itemName;
  document.getElementById("pay-detail").textContent = `${p.qty} unit x ${p.days} hari`;
  document.getElementById("pay-total").textContent = fmtRupiah(p.total);
  document.getElementById("pay-error").style.display = "none";

  // trx & metode ditentukan begitu QR ditampilkan, karena satu-satunya metode sekarang QRIS
  const trxId = "CLB-" + Date.now().toString(36).toUpperCase();
  state.booking.metode = "QRIS";
  state.booking.trx = trxId;

  const qrEl = document.getElementById("qris-code");
  qrEl.innerHTML = "";
  if(window.QRCode){
    new QRCode(qrEl, {
      text: `CLIMBORA|QRIS|${trxId}|${p.total}`,
      width: 176,
      height: 176,
      colorDark: "#15588C",
      colorLight: "#ffffff"
    });
  }

  document.getElementById("confirm-pay-btn").onclick = ()=>{
    renderStruk();
    showPage("struk");
  };
}

/* ---------- struk ---------- */
function renderStruk(){
  const p = state.booking;
  document.getElementById("st-trx").textContent = p.trx;
  document.getElementById("st-item").textContent = p.itemName;
  document.getElementById("st-nama").textContent = p.nama;
  document.getElementById("st-tanggal").textContent = fmtTanggalIndo(p.tanggal);
  document.getElementById("st-detail").textContent = p.detail || `${p.qty} unit x ${p.days} hari`;
  document.getElementById("st-periode").textContent = p.periode || `${fmtTanggalIndo(p.tanggal)} – ${fmtTanggalIndo(p.tanggalSelesai || addDaysToDateStr(p.tanggal, p.days))}`;
  document.getElementById("st-metode").textContent = p.metode;
  document.getElementById("st-total").textContent = fmtRupiah(p.total);
  document.getElementById("st-code").textContent = p.trx;

  // Simpan ke "Tiket Saya" begitu notifikasi pembayaran berhasil ini ditampilkan
  const existing = getTickets();
  if(p.trx && !existing.some(t => t.trx === p.trx)){
    saveTicket({
      trx: p.trx, itemName: p.itemName, nama: p.nama, tanggal: p.tanggal,
      detail: p.detail || `${p.qty} unit x ${p.days} hari`,
      periode: p.periode || `${fmtTanggalIndo(p.tanggal)} – ${fmtTanggalIndo(p.tanggalSelesai || addDaysToDateStr(p.tanggal, p.days))}`,
      metode: p.metode, total: p.total, savedAt: Date.now()
    });
  }

  if(window.JsBarcode){
    JsBarcode("#barcode", p.trx, { format:"CODE128", width:2, height:60, displayValue:false, background:"#ffffff", lineColor:"#15588C" });
  }

  document.getElementById("download-pdf").onclick = ()=>{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:"pt", format:[320, 480] });
    doc.setFillColor(234,246,255);
    doc.rect(0,0,320,480,"F");
    doc.setTextColor(47,143,224);
    doc.setFontSize(16);
    doc.text("CLIMBORA", 160, 40, { align:"center" });
    doc.setTextColor(22,40,59);
    doc.setFontSize(10);
    doc.text("Bukti Booking Persewaan Alat Pendakian", 160, 58, { align:"center" });
    doc.setDrawColor(150,190,225);
    doc.line(24,72,296,72);

    const lines = [
      ["No. Transaksi", p.trx],
      ["Item", p.itemName],
      ["Nama Penyewa", p.nama],
      ["No. HP", p.hp],
      ["Email", p.email],
      ["Tanggal Ambil", fmtTanggalIndo(p.tanggal)],
      ["Jumlah", p.detail || `${p.qty} unit x ${p.days} hari`],
      ["Periode Sewa", p.periode || `${fmtTanggalIndo(p.tanggal)} – ${fmtTanggalIndo(p.tanggalSelesai || addDaysToDateStr(p.tanggal, p.days))}`],
      ["Metode Bayar", p.metode],
      ["Total Bayar", fmtRupiah(p.total)],
    ];
    let y = 96;
    doc.setFontSize(10);
    lines.forEach(([label, val])=>{
      doc.setTextColor(91,124,153);
      doc.text(label, 24, y);
      doc.setTextColor(22,40,59);
      doc.text(String(val), 296, y, { align:"right" });
      y += 22;
    });

    const svg = document.getElementById("barcode");
    if(svg){
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const svgBlob = new Blob([svgData], {type:"image/svg+xml;charset=utf-8"});
      const url = URL.createObjectURL(svgBlob);
      img.onload = function(){
        const canvas = document.createElement("canvas");
        canvas.width = 500; canvas.height = 120;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,20,10,460,90);
        const pngUrl = canvas.toDataURL("image/png");
        doc.addImage(pngUrl, "PNG", 40, y+10, 240, 48);
        doc.setFontSize(9);
        doc.setTextColor(91,124,153);
        doc.text(p.trx, 160, y+70, { align:"center" });
        doc.save(`Booking-${p.trx}.pdf`);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else {
      doc.save(`Booking-${p.trx}.pdf`);
    }
  };

  document.getElementById("to-tiket-btn").onclick = ()=>{
    renderTiket();
    showPage("tiket");
  };
}

/* ---------- tiket ---------- */
function renderTiket(){
  const list = document.getElementById("ticket-list");
  const empty = document.getElementById("ticket-empty");
  const tickets = getTickets();

  if(tickets.length === 0){
    list.style.display = "none";
    empty.style.display = "block";
    return;
  }
  list.style.display = "flex";
  empty.style.display = "none";

  list.innerHTML = tickets.map((t,i) => `
    <button type="button" class="ticket-item" data-idx="${i}">
      <div class="ticket-item-main">
        <h4>${t.itemName}</h4>
        <p>${t.nama} • ${fmtTanggalIndo(t.tanggal)}</p>
      </div>
      <div class="ticket-item-side">
        <span class="ticket-code-mini">${t.trx}</span>
        <span class="ticket-arrow">›</span>
      </div>
    </button>
  `).join("");

  const overlay = document.getElementById("ticket-detail");
  function openDetail(t){
    document.getElementById("d-trx").textContent = t.trx;
    document.getElementById("d-item").textContent = t.itemName;
    document.getElementById("d-nama").textContent = t.nama;
    document.getElementById("d-tanggal").textContent = fmtTanggalIndo(t.tanggal);
    document.getElementById("d-detail").textContent = t.detail;
    document.getElementById("d-periode").textContent = t.periode || "-";
    document.getElementById("d-metode").textContent = t.metode;
    document.getElementById("d-total").textContent = fmtRupiah(t.total);
    document.getElementById("d-code").textContent = t.trx;
    overlay.style.display = "flex";
    if(window.JsBarcode){
      JsBarcode("#d-barcode", t.trx, { format:"CODE128", width:2, height:60, displayValue:false, background:"#ffffff", lineColor:"#15588C" });
    }
  }

  list.querySelectorAll(".ticket-item").forEach(btn=>{
    btn.addEventListener("click", ()=> openDetail(tickets[+btn.dataset.idx]));
  });
  document.getElementById("close-detail").onclick = ()=>{
    overlay.style.display = "none";
  };
  overlay.onclick = (e)=>{
    if(e.target === overlay) overlay.style.display = "none";
  };
}

/* ---------- navigasi topbar ---------- */
function initNav(){
  document.querySelectorAll("[data-nav]").forEach(el=>{
    el.addEventListener("click", (e)=>{
      e.preventDefault();
      const page = el.dataset.nav;
      if(page === "tiket") renderTiket();
      showPage(page);
    });
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  initDaftar();
  initMasuk();
  initNav();
  initBackButton();
  initKatalogFilter();
  initKatalogOrder();
  showPage("daftar");
});