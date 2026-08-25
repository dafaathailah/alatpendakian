<?php
// =========================================================
// CLIMBORA — Katalog Alat Pendakian
// GET /catalog.php   -> daftar semua alat
// Tidak perlu login.
// =========================================================

require_once 'db_connect.php';

$result = $conn->query(
    'SELECT item_key, name, category, description, price, unit, image
     FROM catalog_items
     ORDER BY category, name'
);

$items = [];
while ($row = $result->fetch_assoc()) {
    $row['price'] = (int) $row['price'];
    $items[] = $row;
}

jsonResponse(['success' => true, 'items' => $items]);