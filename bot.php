<?php
require 'vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$botToken = $_ENV['BOT_TOKEN'];
$dsn = $_ENV['DB_DSN'];
$dbUser = $_ENV['DB_USER'];
$dbPass = $_ENV['DB_PASS'];

function apiRequest($method, $params = []) {
    global $botToken;
    $url = "https://api.telegram.org/bot$botToken/$method";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $params);
    $res = curl_exec($ch);
    curl_close($ch);
    return json_decode($res, true);
}

$content = file_get_contents("php://input");
$update = json_decode($content, true);

if(!$update) exit;

$chat_id = $update['message']['chat']['id'] ?? null;
$text = $update['message']['text'] ?? '';

if ($text == "/start") {
    apiRequest("sendMessage", [
        "chat_id" => $chat_id,
        "text" => "👋 Привет! Укажи свой ник и страну командой:

/setnick <ник> <страна>"
    ]);
} elseif (str_starts_with($text, "/setnick")) {
    $parts = explode(" ", $text, 3);
    if (count($parts) < 3) {
        apiRequest("sendMessage", [
            "chat_id" => $chat_id,
            "text" => "❌ Используй: /setnick <ник> <страна>"
        ]);
    } else {
        $nick = $parts[1];
        $country = $parts[2];
        apiRequest("sendMessage", [
            "chat_id" => $chat_id,
            "text" => "✅ Твой ник: $nick
🌍 Страна: $country"
        ]);
    }
} else {
    apiRequest("sendMessage", [
        "chat_id" => $chat_id,
        "text" => "⚡ Я понял команду: $text"
    ]);
}
