/**
 * Türkçe arama normalleştirmesi.
 * - tr-TR küçük harf ("İ" → "i", "I" → "ı"), ardından ı → i: "BIM" ile "bim", "İzmir" ile "izmir" eşleşir.
 * - Aksan/çengel kaldırma (ş→s, ğ→g, ü→u, ö→o, ç→c): "hakedis" yazan "Hakediş" sonucunu bulur.
 * Tarayıcı script'lerinde ve build tarafında (data-search öznitelikleri) aynı fonksiyon kullanılır.
 */
export const foldTr = (s: string): string =>
  s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
