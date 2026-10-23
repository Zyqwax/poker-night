# Poker Night ♠

Arkadaşlarla özel odalarda oynanan, sahte chip kullanan, kurpiyer botu tarafından yönetilen Texas Hold'em Progressive Web App (PWA) web uygulaması.

---

## 1. Teknoloji Tercihleri ve Gerekçeleri

| Bileşen | Tercih | Gerekçe |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | Hızlı HMR, güçlü tip güvenliği ve mobil PWA için minimal bundle boyutu. |
| **Stil** | Tailwind CSS | Özel lüks poker paleti (bordo keçe, altın sarısı, koyu arka plan) ve sıfır çalışma zamanı CSS yükü. |
| **Animasyon** | Framer Motion | Yalnızca donanım hızlandırmalı `transform` ve `opacity` kullanımı; `prefers-reduced-motion` desteği ile pil ve performans optimizasyonu. |
| **Gerçek Zamanlı İletişim** | Node.js + TypeScript + Socket.IO | Otomatik yeniden bağlanma (reconnection), oda (room) yalıtımı ve düşük gecikmeli çift yönlü mesajlaşma. |
| **Kalıcı Veri** | SQLite (`better-sqlite3`) | Harici veritabanı sunucusu gerektirmeyen, hızlı, ACID uyumlu gömülü veritabanı. Oda, el geçmişi ve istatistikleri kalıcı tutar. |
| **Rastgelelik** | Web Crypto (`getRandomValues`) | `Math.random` yerine tarafsız ve kriptografik güvenli Fisher-Yates deste karıştırma algoritması. |
| **PWA** | `vite-plugin-pwa` (Workbox) | Çevrimdışı varlık önbelleğe alma, bağımsız (standalone) pencere modu, yatay/dikey oryantasyon ve yükleme istemi. |
| **Test** | Vitest | Saf poker motoru, yan pot hesaplamaları, el değerlendirici ve çoklu istemcili WebSocket e2e simülasyonları. |

---

## 2. Monorepo Mimarisi

```
poker-night/
  apps/
    web/          # React + Vite + Tailwind + PWA istemcisi
    server/       # Socket.IO + Express + SQLite sunucusu
  packages/
    shared/       # Ortak tipler, event sabitleri, oda kodu formatlayıcılar
    engine/       # Saf Texas Hold'em oyun motoru, el değerlendirici, pot dağıtımı
```

- **Sunucu Yetkilidir (Server-Authoritative):** Deste karıştırma, bahis doğrulama, pot hesaplama ve sıra yönetimi tamamen sunucu tarafında yapılır. İstemci hile yapamaz.
- **Gizli Bilgi Sızmaz:** Oyunculara yalnızca kendi 2 kapalı kartı socket üzerinden özel olarak gönderilir (`game:hole_cards`). Diğer oyuncuların kartları showdown gerçekleşene kadar ağ trafiğinde yer almaz.
- **i18n Mimarisi:** Tüm kullanıcıya dönük arayüz metinleri tek bir dil dosyasında (`apps/web/src/i18n/tr.ts`) toplanmıştır. Poker terimleri (call, raise, fold, check, all in, blind, flop, turn, river, showdown, side pot, button) evrensel İngilizce halleriyle korunmuştur.

---

## 3. Varsayımlar (Assumptions)

1. **Oda Kodları:** Kullanıcıya `482 913` şeklinde ortadan boşlukla gösterilir, içeride 6 haneli string olarak saklanır (`482913`).
2. **Kopma Toleransı:** Sırası gelen oyuncunun bağlantısı koptuğunda belirlenen süre (varsayılan 60 sn) boyunca beklenir. Süre dolarsa check yapılabiliyorsa check, yapılamıyorsa fold edilir.
3. **Beraberlikte Tekil Chip Dağıtımı:** Beraberlik durumunda pot eşit bölünür, kalan artık chip'ler (odd chips) dealer butonundan saat yönünde sıradaki oyuncudan başlanarak 1'er chip olarak dağıtılır.
4. **Heads-Up (2 Kişilik) Kuralı:** İki kişi kaldığında Dealer butonu aynı zamanda Small Blind'dır ve pre-flop'ta ilk hamleyi yapar, post-flop turlarında ise son hamleyi yapar.
5. **Oda Kapatma:** 30 dakika boyunca içinde bağlı oyuncu kalmayan odalar bellekten ve aktif oturumlardan temizlenir, ancak el kayıtları SQLite'ta saklanmaya devam eder.

---

## 4. Kurulum ve Çalıştırma

### Gereksinimler
- Node.js >= 18.0.0
- pnpm >= 9.0.0

### Bağımlılıkları Yükleme
```bash
pnpm install
```

### Projeyi Derleme
```bash
pnpm build
```

### Testleri Çalıştırma (Engine, Server ve E2E)
```bash
pnpm test
```

### Geliştirme Modunda Çalıştırma (Sunucu + Web)
```bash
# Sunucuyu (port 3001) ve Web istemcisini (port 3000) eşzamanlı başlatır:
pnpm dev
```
Ayrıca ayrı terminallerde çalıştırmak için:
```bash
# Sunucu
pnpm dev:server

# Web İstemcisi
pnpm dev:web
```

Tarayıcınızda `http://localhost:3000` adresini açarak uygulamayı kullanabilirsiniz.

---

## 5. Ekranlar ve Özellikler

1. **Ana Ekran:**
   - 6 haneli kod için otomatik ilerleyen, yapıştırma (paste) destekli kutular.
   - "Oda kur ♠" ve "Katıl" butonları.
   - Nick belirleme ve değiştirme barı.
   - Son oynanan odalar listesi ve El Sıralaması Yardımı modalı.

2. **Lobi (Oda Bekleme):**
   - Kopyalanabilir büyük oda kodu (`482 913`).
   - Oyuncu listesi, hazır durumları, bağlantı göstergeleri ve Kurpiyer botu durumu.
   - Kurucu için oda ayarları paneli (oyuncu sayısı, başlangıç chip, blind, süreler vb.).
   - "Hazırım" butonu ve oyuncu bekleme durumu.

3. **Oyun Masası:**
   - Oval bordo keçe masa, altın çerçeve ve gerçekçi çip göstergeleri.
   - Ortadaki ortak kartlar (Flop, Turn, River) ve pot tutarı.
   - Oyuncuların etrafındaki koltuklar, rozetler (Button, SB, BB) ve "bağlantı koptu" göstergesi.
   - Kullanıcının elindeki 2 kart ve otomatik el tespiti ("Şu an: Flush (As yüksek)").
   - Aksiyon paneli: Fold, Check, Call, All in ve hızlı seçenekli Raise kaydırıcısı (Min, 1/2 pot, Pot).
   - Tam ekran (Fullscreen API), Geçmiş/İstatistik ve Ayarlar butonları.

4. **Geçmiş ve İstatistikler:**
   - Tamamlanan ellerin detaylı özeti ve kazananları.
   - Oyuncu bazında net kazanç, oynanan el, kazanılan el ve fold oranları.
   - Oyuncuların chip değişimini gösteren responsive SVG çizgi grafik.
