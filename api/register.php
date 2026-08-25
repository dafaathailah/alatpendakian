<?php
// =========================================================
// CLIMBORA — Daftar Akun Baru
// Dipanggil dari #daftar-form (script.js) via fetch POST
// Body JSON: { nama, email, password }
// =========================================================

session_start();
require_once 'db_connect.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Metode tidak diizinkan.'], 405);
}

$body = readJsonBody();
$nama     = trim($body['nama'] ?? '');
$email    = strtolower(trim($body['email'] ?? ''));
$password = $body['password'] ?? '';

if ($nama === '' || $email === '' || $password === '') {
    jsonResponse(['success' => false, 'message' => 'Nama, email, dan kata sandi wajib diisi.'], 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['success' => false, 'message' => 'Format email tidak valid.'], 400);
}

// Cek email sudah terdaftar atau belum
$stmt = $conn->prepare('SELECT id FROM users WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows > 0) {
    $stmt->close();
    jsonResponse([
        'success' => false,
        'message' => 'Email ini sudah terdaftar. Silakan masuk lewat "Masuk di sini".'
    ], 409);
}
$stmt->close();

// Simpan user baru dengan password ter-hash
$hashed = password_hash($password, PASSWORD_DEFAULT);

$stmt = $conn->prepare('INSERT INTO users (nama, email, password) VALUES (?, ?, ?)');
$stmt->bind_param('sss', $nama, $email, $hashed);

if (!$stmt->execute()) {
    $stmt->close();
    jsonResponse(['success' => false, 'message' => 'Gagal menyimpan akun. Coba lagi.'], 500);
}

$userId = $stmt->insert_id;
$stmt->close();

// Langsung login-kan user yang baru daftar
$_SESSION['user_id']    = $userId;
$_SESSION['user_nama']  = $nama;
$_SESSION['user_email'] = $email;

jsonResponse([
    'success' => true,
    'user' => ['id' => $userId, 'nama' => $nama, 'email' => $email]
]);