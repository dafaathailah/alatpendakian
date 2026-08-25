<?php
// =========================================================
// CLIMBORA — Booking (create, confirm pembayaran, daftar tiket)
// POST /booking.php?action=create   body: { item_key, nama, hp, email, tanggal, qty, days }
// POST /booking.php?action=confirm  body: { trx }
// GET  /booking.php?action=tickets  -> daftar tiket yang sudah dibayar (user login)
// Semua aksi butuh sesi login (kecuali tidak ada yang dikecualikan di sini).
// =========================================================

session_start();
require_once 'db_connect.php';

if (!isset($_SESSION['user_id'])) {
    jsonResponse(['success' => false, 'message' => 'Silakan masuk terlebih dahulu.'], 401);
}

$userId = $_SESSION['user_id'];
$action = $_GET['action'] ?? 'create';

$namaBulanIndo = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
$fmtTanggalIndo = function (DateTime $d) use ($namaBulanIndo) {
    return $d->format('j') . ' ' . $namaBulanIndo[(int) $d->format('n') - 1] . ' ' . $d->format('Y');
};

// ---------------------------------------------------------
// action=tickets  (GET)
// ---------------------------------------------------------
if ($action === 'tickets') {
    $stmt = $conn->prepare(
        'SELECT trx_code AS trx, item_name AS itemName, nama_penyewa AS nama,
                tanggal_ambil AS tanggal, detail, periode, metode, total
         FROM bookings
         WHERE user_id = ? AND status = "paid"
         ORDER BY created_at DESC'
    );
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $tickets = [];
    while ($row = $result->fetch_assoc()) {
        $row['total'] = (int) $row['total'];
        $tickets[] = $row;
    }
    $stmt->close();

    jsonResponse(['success' => true, 'tickets' => $tickets]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Metode tidak diizinkan.'], 405);
}

$body = readJsonBody();

// ---------------------------------------------------------
// action=confirm  (POST) — tandai booking sudah dibayar
// ---------------------------------------------------------
if ($action === 'confirm') {
    $trx = trim($body['trx'] ?? '');
    if ($trx === '') {
        jsonResponse(['success' => false, 'message' => 'Kode transaksi tidak valid.'], 400);
    }

    $stmt = $conn->prepare(
        'UPDATE bookings SET status = "paid", metode = "QRIS"
         WHERE trx_code = ? AND user_id = ? AND status = "pending"'
    );
    $stmt->bind_param('si', $trx, $userId);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    if ($affected === 0) {
        jsonResponse(['success' => false, 'message' => 'Booking tidak ditemukan atau sudah dibayar.'], 404);
    }

    $stmt = $conn->prepare('SELECT * FROM bookings WHERE trx_code = ? AND user_id = ?');
    $stmt->bind_param('si', $trx, $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    jsonResponse([
        'success' => true,
        'booking' => [
            'trx'            => $row['trx_code'],
            'itemName'       => $row['item_name'],
            'nama'           => $row['nama_penyewa'],
            'hp'             => $row['hp'],
            'email'          => $row['email'],
            'tanggal'        => $row['tanggal_ambil'],
            'tanggalSelesai' => $row['tanggal_selesai'],
            'qty'            => (int) $row['qty'],
            'days'           => (int) $row['days'],
            'detail'         => $row['detail'],
            'periode'        => $row['periode'],
            'total'          => (int) $row['total'],
            'metode'         => $row['metode']
        ]
    ]);
}

// ---------------------------------------------------------
// action=create  (POST, default) — buat booking baru (status pending)
// ---------------------------------------------------------
$itemKey  = trim($body['item_key'] ?? '');
$nama     = trim($body['nama'] ?? '');
$hp       = trim($body['hp'] ?? '');
$email    = trim($body['email'] ?? '');
$tanggal  = trim($body['tanggal'] ?? '');
$qty      = max(1, (int) ($body['qty'] ?? 1));
$days     = max(1, (int) ($body['days'] ?? 1));

if ($itemKey === '' || $nama === '' || $hp === '' || $email === '' || $tanggal === '') {
    jsonResponse(['success' => false, 'message' => 'Lengkapi semua data terlebih dahulu.'], 400);
}

$dateObj = DateTime::createFromFormat('Y-m-d', $tanggal);
if (!$dateObj) {
    jsonResponse(['success' => false, 'message' => 'Format tanggal tidak valid.'], 400);
}

// Ambil harga & nama item dari database (jangan percaya harga dari client)
$stmt = $conn->prepare('SELECT name, price FROM catalog_items WHERE item_key = ?');
$stmt->bind_param('s', $itemKey);
$stmt->execute();
$item = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$item) {
    jsonResponse(['success' => false, 'message' => 'Item tidak ditemukan.'], 404);
}

$total = $item['price'] * $qty * $days;
$tanggalSelesai = (clone $dateObj)->modify("+{$days} days");
$detail  = "{$qty} unit x {$days} hari";
$periode = $fmtTanggalIndo($dateObj) . ' – ' . $fmtTanggalIndo($tanggalSelesai);
$trxCode = 'CLB-' . strtoupper(base_convert((string) time(), 10, 36)) . strtoupper(substr(bin2hex(random_bytes(2)), 0, 3));

$stmt = $conn->prepare(
    'INSERT INTO bookings
     (trx_code, user_id, item_key, item_name, nama_penyewa, hp, email,
      tanggal_ambil, tanggal_selesai, qty, days, detail, periode, total, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending")'
);
$tanggalSelesaiStr = $tanggalSelesai->format('Y-m-d');

$stmt->bind_param(
    'sisssssssiissi',
    $trxCode,
    $userId,
    $itemKey,
    $item['name'],
    $nama,
    $hp,
    $email,
    $tanggal,
    $tanggalSelesaiStr,
    $qty,
    $days,
    $detail,
    $periode,
    $total
);

if (!$stmt->execute()) {
    $stmt->close();
    jsonResponse(['success' => false, 'message' => 'Gagal membuat booking. Coba lagi.'], 500);
}
$stmt->close();

jsonResponse([
    'success' => true,
    'booking' => [
        'trx'      => $trxCode,
        'itemName' => $item['name'],
        'nama'     => $nama,
        'hp'       => $hp,
        'email'    => $email,
        'tanggal'  => $tanggal,
        'tanggalSelesai' => $tanggalSelesaiStr,
        'qty'      => $qty,
        'days'     => $days,
        'detail'   => $detail,
        'periode'  => $periode,
        'total'    => $total
    ]
]);