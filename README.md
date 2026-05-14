# MarketCell — Dijital Pazar Yeri

MarketCell, **Node.js (Express) + PostgreSQL** tabanlı bir REST API ve **ASP.NET Core 8 MVC** ile geliştirilmiş web arayüzünden oluşur. Çok satıcılı sepetler ana sipariş ve satıcı bazlı **alt sipariş**lere bölünür; stok hareketleri **transaction** içinde ve ödeme simülasyonundan sonra atomik olarak uygulanır.

## Teknoloji yığını

| Bileşen | Teknoloji |
|--------|-----------|
| API | Node.js 18+, Express 4, `pg`, `jsonwebtoken`, `cors` |
| Veri | PostgreSQL (tam metin: `tsvector` + GIN, hiyerarşik kategori) |
| Web | ASP.NET Core 8 MVC, Bootstrap 5, oturum + sunucu taraflı HTTP istemcisi |
| Kimlik | JWT access token + refresh token (opaque, SHA-256 ile saklanır) |
| Ödeme | Paycell **simülasyonu** (kart numarası kuralları) |

## Önkoşullar

- [Node.js](https://nodejs.org/) 18+
- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [PostgreSQL](https://www.postgresql.org/) 14+ (önerilir)

## Veritabanı kurulumu

1. Boş bir veritabanı oluşturun, örneğin: `marketcell`.
2. Şema dosyalarını **sırayla** çalıştırın:

```bash
psql -U postgres -d marketcell -f MarketCell_Backend/sql/000_base_schema.sql
psql -U postgres -d marketcell -f MarketCell_Backend/sql/001_marketcell_extensions.sql
psql -U postgres -d marketcell -f MarketCell_Backend/sql/seed_demo.sql
```

`001_marketcell_extensions.sql` dosyası `users`, OTP ve tam metin tetikleyicisini ekler; `orders.user_id` sütununu tanımlar.

## Ortam değişkenleri (Backend)

Kök dizindeki `.env.example` dosyasını `MarketCell_Backend/.env` olarak kopyalayıp değerleri doldurun (bkz. örnek içindeki yorumlar).

## API’yi çalıştırma

```bash
cd MarketCell_Backend
npm install
npm start
```

Varsayılan adres: `http://localhost:3000`

## Web arayüzünü çalıştırma

`frontend/appsettings.json` veya `appsettings.Development.json` içindeki `MarketCellApi:BaseUrl` değerinin API adresiyle eşleştiğinden emin olun (varsayılan `http://localhost:3000`).

```bash
cd frontend
dotnet run --launch-profile https
```

## Demo hesaplar (OTP)

Tüm kullanıcılar için OTP simülasyonu kodu: **1234**.

| GSM | Rol |
|-----|-----|
| `905550000001` | Satıcı (Demo Mağaza 1) |
| `905550000002` | Satıcı (Demo Mağaza 2) |
| `905551112233` | Alıcı |

Giriş: web arayüzünde **Giriş Yap** → telefon → kod gönder → `1234` ile doğrula.

## Paycell ödeme simülasyonu

`POST /api/v1/orders` isteğinde `payment.card_number`:

- **4242** ile başlayan kartlar → ödeme başarılı; sipariş ve alt siparişler oluşturulur, **varyant stokları** düşer.
- **4000** ile başlayan kartlar → HTTP **402**, stok veya sipariş kaydı **olmaz**.

## REST API özeti (`/api/v1`)

| Metot | Yol | Açıklama |
|-------|-----|----------|
| POST | `/auth/register` | OTP oturumu başlatır |
| POST | `/auth/verify-otp` | OTP doğrular, JWT döner |
| POST | `/auth/refresh` | Refresh token ile yeni access token |
| GET | `/categories` | Hiyerarşik kategori ağacı |
| GET | `/products` | `q`, `category_id`, `min_price`, `max_price`, `sort` (price_asc, price_desc, name_asc, name_desc) |
| GET | `/products/:id` | Ürün + varyantlar + birim fiyat |
| GET | `/orders` | Alıcı: kendi siparişleri (JWT) |
| POST | `/orders` | Sipariş oluşturur (`variant_id` + `quantity` satırları, Paycell simülasyonu) |
| GET | `/seller/orders` | Satıcı: kendi mağazasına gelen alt siparişler |
| PATCH | `/seller/orders/:subOrderId` | Alt sipariş durumu: **Ödendi → Hazırlanıyor → Kargoda** |
| POST | `/seller/products` | Satıcı: ürün + varyant oluşturur |

Tam JSON gövdeleri için `MarketCell_Backend/src` altındaki controller ve servis dosyalarına bakın.

## Önemli iş kuralları

1. **Çok satıcı:** Tek `orders` kaydı; her satıcı için bir `sub_orders` ve kalemler `sub_order_items` içinde tutulur.
2. **Stok:** `product_variants.stock_count` üzerinden, `SELECT … FOR UPDATE` + `BEGIN/COMMIT` ile yarış durumları azaltılır.
3. **Varyant:** Beden / renk vb. `product_variants` üzerinden; liste sayfasında stok toplamı gösterilir.
4. **CORS:** Backend `CORS_ORIGINS` ile yapılandırılır (varsayılan yerel ASP.NET portları).

## Sorun giderme

- **422 / veritabanı hatası:** Şema dosyalarının sırası ve PostgreSQL sürümü.
- **401 / sipariş:** `Authorization: Bearer <access_token>` ve alıcı (`buyer`) rolü gerekir.
- **403 / satıcı paneli:** `seller` veya `admin` rolü ve satıcı için `store_id` atanmış olmalı.

## Lisans

Bu depo eğitim / şartname amaçlıdır; üretim kullanımı için güvenlik ve uyumluluk incelemesi yapın.
