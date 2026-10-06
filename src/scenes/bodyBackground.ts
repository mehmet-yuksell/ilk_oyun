/**
 * Sahnenin arkaplan degradesini `<body>`ye de uygular -- Phaser'ın Scale.FIT modu 20:9 gibi uzun
 * telefonlarda canvas'ı üstten/alttan "letterbox" bantlarıyla bırakır (sabit 540x960 mantıksal
 * çözünürlük korunduğu için). Bu bantlar document.body'nin arkaplanıdır; onu oyun sahnesinin
 * degradesiyle eşleyince bantlar ayrı bir "siyah çerçeve" gibi değil, sahnenin doğal bir uzantısı
 * gibi okunur (bkz. Faz 4 kararları).
 */
export function syncBodyBackground(topHex: string, bottomHex: string): void {
  document.body.style.background = `linear-gradient(180deg, ${topHex} 0%, ${bottomHex} 100%)`;
}
