<?php
// =========================================================
// CLIMBORA — Masuk (Login) & Keluar (Logout)
// POST /login.php               body: { email, password }   -> login
// POST /login.php?action=logout                              -> logout
// =========================================================

session_start();
require_once 'db_connect.php';

$action = $_GET['action'] ?? 'login';

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    jsonResponse(['success' => true]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Metode tidak diizinkan.'], 405);
}

$body     = readJsonBody();
$email    = strtolower(trim($body['email'] ?? ''));
$password = $body['password'] ?? '';

if ($email === '' || $password === '') {
    jsonResponse(['success' => false, 'message' => 'Email dan kata sandi wajib diisi.'], 400);
}

$stmt = $conn->prepare('SELECT id, nama, email, password FROM users WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$user || !password_verify($password, $user['password'])) {
    jsonResponse([
        'success' => false,
        'message' => 'Email atau kata sandi salah, atau akun belum terdaftar.'
    ], 401);
}

$_SESSION['user_id']    = $user['id'];
$_SESSION['user_nama']  = $user['nama'];
$_SESSION['user_email'] = $user['email'];

jsonResponse([
    'success' => true,
    'user' => ['id' => $user['id'], 'nama' => $user['nama'], 'email' => $user['email']]
]);