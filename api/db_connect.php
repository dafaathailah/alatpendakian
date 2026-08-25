<?php
// =========================================================
// CLIMBORA — Koneksi Database (mysqli)
// Sesuaikan kredensial di bawah kalau XAMPP kamu beda dari default.
// File ini di-require di setiap endpoint PHP lain.
// =========================================================

// --- Jaga-jaga: pastikan output SELALU JSON bersih, walau ada
//     warning/notice/fatal error PHP yang biasanya bikin respons
//     rusak dan bikin fetch() di JS gagal parse. ---
error_reporting(E_ALL);
ini_set('display_errors', '0');   // jangan tampilkan error mentah ke output
ini_set('log_errors', '1');       // tetap dicatat ke php_error_log
ob_start();                       // tangkap semua output nyasar (warning dll)

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');            // default XAMPP: kosong
define('DB_NAME', 'climbora_db');
define('DB_CHARSET', 'utf8mb4');

header('Content-Type: application/json; charset=utf-8');

/**
 * Helper: buang semua output yang sudah tertampung (warning, notice,
 * HTML error, dll) sebelum kita kirim JSON — supaya respons selalu
 * valid JSON murni.
 */
function clearStrayOutput(): void {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
}

/**
 * Helper: kirim response JSON lalu stop eksekusi.
 */
function jsonResponse(array $payload, int $statusCode = 200): void {
    clearStrayOutput();
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

// Tangkap fatal error PHP (mis. salah jumlah bind_param, typo fungsi, dll)
// dan ubah jadi respons JSON yang jelas, bukan halaman HTML kosong/putih.
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        clearStrayOutput();
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => 'Server error: ' . $err['message'] . ' (baris ' . $err['line'] . ' di ' . basename($err['file']) . ')'
        ]);
    }
});

$conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    jsonResponse([
        'success' => false,
        'message' => 'Koneksi database gagal: ' . $conn->connect_error
    ], 500);
}

$conn->set_charset(DB_CHARSET);

/**
 * Helper: baca body request JSON (dipakai fetch() di script.js)
 * dan kembalikan sebagai array asosiatif.
 */
function readJsonBody(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}