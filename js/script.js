/* CLIMBORA — logic bersama seluruh halaman (versi SPA + backend PHP/MySQL)
   Semua data sekarang lewat fetch() ke folder api/, bukan lagi localStorage. */

const API = {
  register: 'api/register.php',
  login:    'api/login.php',
  logout:   'api/login.php?action=logout',
  catalog:  'api/catalog.php',
  bookingCreate:  'api/booking.php?action=create',
  bookingConfirm: 'api/booking.php?action=confirm',
  bookingTickets: 'api/booking.php?action=tickets'
};

async function apiPost(url, body){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000); // 10 detik
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    const message = err.name === 'AbortError'
      ? 'Server tidak merespons (timeout). Cek apakah MySQL di XAMPP masih hidup.'
      : 'Gagal terhubung ke server. Cek koneksi/Apache-nya.';
    return { success: false, message };
  }
}
async function apiGet(url){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    const message = err.name === 'AbortError'
      ? 'Server tidak merespons (timeout). Cek apakah MySQL di XAMPP masih hidup.'
      : 'Gagal terhubung ke server. Cek koneksi/Apache-nya.';
    return { success: false, message };
  }
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

/* ---------- state bersama antar-section ---------- */
const state = {
  user: "",
  userEmail: "",
  currentItem: null,
  catalogItems: [],
  booking: {}, // trx, itemName, nama, hp, email, tanggal, tanggalSelesai, qty, days, detail, periode, total, metode
  pageHistory: [] // stack nama halaman untuk tombol "Kembali"
};

/* ---------- router sederhana antar section ---------- */
function showPage(page, opts = {}){
  const authPages = ["daftar", "masuk"];

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
  loadCatalog();
}

/* ---------- daftar (buat akun baru) ---------- */
function initDaftar(){
  const form = document.getElementById("daftar-form");
  const errEl = document.getElementById("daftar-error");

  form.addEventListener("submit", async e=>{
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

    const data = await apiPost(API.register, { nama, email, password });
    if(!data.success){
      errEl.textContent = data.message || "Gagal mendaftar. Coba lagi.";
      errEl.style.display = "block";
      return;
    }

    form.reset();
    loginAs(data.user.nama, data.user.email);
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

  form.addEventListener("submit", async e=>{
    e.preventDefault();
    const email = document.getElementById("masuk-email").value.trim().toLowerCase();
    const password = document.getElementById("masuk-password").value;

    errEl.style.display = "none";
    if(!email || !password){
      errEl.textContent = "Email dan kata sandi wajib diisi.";
      errEl.style.display = "block";
      return;
    }

    const data = await apiPost(API.login, { email, password });
    if(!data.success){
      errEl.textContent = data.message || "Email atau kata sandi salah.";
      errEl.style.display = "block";
      return;
    }

    form.reset();
    loginAs(data.user.nama, data.user.email);
  });

  document.getElementById("ke-daftar-link").addEventListener("click", e=>{
    e.preventDefault();
    document.getElementById("daftar-error").style.display = "none";
    showPage("daftar");
  });
}

/* ---------- katalog: ambil dari database, render kartu, lalu pasang filter & klik pesan ---------- */
async function loadCatalog(){
  const grid = document.getElementById("catalog-grid");
  const data = await apiGet(API.catalog);
  if(!data.success){
    grid.innerHTML = `<p style="color:var(--muted);">Gagal memuat katalog.</p>`;
    return;
  }
  state.catalogItems = data.items;
  renderCatalogGrid(data.items);
}

function renderCatalogGrid(items){
  const grid = document.getElementById("catalog-grid");
  grid.innerHTML = items.map(item => `
    <article class="card" data-id="${item.item_key}" data-cat="${item.category}">
      <img class="card-img" src="${item.image}" alt="${item.name}" loading="lazy">
      <div class="card-body">
        <span class="card-tag">${item.category}</span>
        <h3>${item.name}</h3>
        <p class="desc">${item.description}</p>
        <p class="card-stock">● Tersedia</p>
        <div class="card-price"><span class="amount">${fmtRupiah(item.price)}</span><span class="unit">/ ${item.unit} / unit</span></div>
        <button type="button" class="btn btn-primary btn-block" data-order="${item.item_key}">Pesan Sekarang</button>
      </div>
    </article>
  `).join("");

  initKatalogFilter();
  initKatalogOrder();
}

function initKatalogFilter(){
  const chipsWrap = document.getElementById("filter-chips");
  const cards = document.querySelectorAll("#catalog-grid .card");

  chipsWrap.querySelectorAll(".chip").forEach(chip=>{
    chip.onclick = ()=>{
      chipsWrap.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active");
      const cat = chip.dataset.cat;
      cards.forEach(card=>{
        card.style.display = (cat === "Semua" || card.dataset.cat === cat) ? "" : "none";
      });
    };
  });
}

function initKatalogOrder(){
  document.querySelectorAll("#catalog-grid [data-order]").forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.dataset.order;
      const item = state.catalogItems.find(it => it.item_key === key);
      if(!item) return;
      state.currentItem = item;
      renderBooking();
      showPage("booking");
    };
  });
}

/* ---------- booking ---------- */
function renderBooking(){
  const item = state.currentItem;
  if(!item) return;

  document.getElementById("sum-img").src = item.image;
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
  const errEl = document.getElementById("booking-error");
  errEl.style.display = "none";

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

  form.onsubmit = async e=>{
    e.preventDefault();
    const nama = document.getElementById("nama-booking").value.trim();
    const hp = document.getElementById("hp").value.trim();
    const email = document.getElementById("email-booking").value.trim();
    const tanggal = document.getElementById("tanggal").value;
    const qty = Math.max(1, parseInt(qtyInput.value || "1", 10));
    const days = Math.max(1, parseInt(daysInput.value || "1", 10));

    if(!nama || !hp || !email || !tanggal){
      errEl.textContent = "Lengkapi semua data terlebih dahulu.";
      errEl.style.display = "block";
      return;
    }
    errEl.style.display = "none";

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Memproses...";

    const data = await apiPost(API.bookingCreate, {
      item_key: item.item_key, nama, hp, email, tanggal, qty, days
    });

    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;

    if(!data.success){
      errEl.textContent = data.message || "Gagal membuat booking. Coba lagi.";
      errEl.style.display = "block";
      return;
    }

    state.booking = data.booking;
    renderPembayaran();
    showPage("pembayaran");
  };
}

/* ---------- pembayaran (QRIS) ---------- */
function renderPembayaran(){
  const p = state.booking;
  document.getElementById("pay-item").textContent = p.itemName;
  document.getElementById("pay-detail").textContent = `${p.qty} unit x ${p.days} hari`;
  document.getElementById("pay-total").textContent = fmtRupiah(p.total);
  document.getElementById("pay-error").style.display = "none";

  const qrEl = document.getElementById("qris-code");
  qrEl.innerHTML = "";
  if(window.QRCode){
    new QRCode(qrEl, {
      text: `CLIMBORA|QRIS|${p.trx}|${p.total}`,
      width: 176,
      height: 176,
      colorDark: "#15588C",
      colorLight: "#ffffff"
    });
  }

  document.getElementById("confirm-pay-btn").onclick = async ()=>{
    const errEl = document.getElementById("pay-error");
    const data = await apiPost(API.bookingConfirm, { trx: p.trx });
    if(!data.success){
      errEl.textContent = data.message || "Gagal mengonfirmasi pembayaran.";
      errEl.style.display = "block";
      return;
    }
    state.booking = data.booking;
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
  document.getElementById("st-detail").textContent = p.detail;
  document.getElementById("st-periode").textContent = p.periode;
  document.getElementById("st-metode").textContent = p.metode;
  document.getElementById("st-total").textContent = fmtRupiah(p.total);
  document.getElementById("st-code").textContent = p.trx;

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
      ["Jumlah", p.detail],
      ["Periode Sewa", p.periode],
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
    showPage("tiket");
    renderTiket();
  };
}

/* ---------- tiket ---------- */
async function renderTiket(){
  const list = document.getElementById("ticket-list");
  const empty = document.getElementById("ticket-empty");

  const data = await apiGet(API.bookingTickets);
  const tickets = data.success ? data.tickets : [];

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
      if(page === "katalog") loadCatalog();
      showPage(page);
    });
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  initDaftar();
  initMasuk();
  initNav();
  initBackButton();
  showPage("daftar");
});