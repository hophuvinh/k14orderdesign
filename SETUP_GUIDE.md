# Design Order Bot — Hướng dẫn Setup Chi Tiết

> **Stack:** Railway (hosting free) + Supabase (database free) + Telegram Bot API
> **Thời gian ước tính:** ~15 phút

---

## Checklist tổng quan

- [ ] Bước 1: Tạo Supabase project + chạy SQL
- [ ] Bước 2: Upload code lên GitHub (private repo)
- [ ] Bước 3: Deploy lên Railway từ GitHub
- [ ] Bước 4: Điền 5 biến môi trường
- [ ] Bước 5: Test bot

---

## BƯỚC 1 — Tạo Supabase Project

**Mục tiêu:** Có được `SUPABASE_URL` và `SUPABASE_KEY`

1. Truy cập **[supabase.com](https://supabase.com)** → bấm **Start your project**
2. Đăng nhập bằng **GitHub** (nhanh nhất)
3. Bấm **New project**:
   - **Name:** `design-order-bot` (hoặc tên tuỳ ý)
   - **Database Password:** đặt mật khẩu bất kỳ (ghi nhớ lại)
   - **Region:** chọn **Southeast Asia (Singapore)**
4. Đợi ~1-2 phút cho project khởi động xong (thanh progress chạy hết)

### Chạy SQL tạo bảng:

5. Ở menu bên trái, bấm **SQL Editor**
6. Bấm **New query**
7. **Copy toàn bộ** nội dung file `supabase_setup.sql` → paste vào editor
8. Bấm **Run** (nút xanh góc phải)
9. Nếu thấy `Success. No rows returned.` → đúng rồi!

### Lấy thông tin kết nối:

10. Vào **Project Settings** (biểu tượng bánh răng góc dưới trái)
11. Chọn **API** trong menu
12. Copy 2 giá trị:
    - **Project URL** → đây là `SUPABASE_URL` (dạng `https://xxxxx.supabase.co`)
    - **anon public** key (ở phần Project API keys) → đây là `SUPABASE_KEY`

> **Lưu tạm** 2 giá trị này vào notepad, sẽ dùng ở Bước 4.

---

## BƯỚC 2 — Upload Code lên GitHub

**Mục tiêu:** Có repo chứa code để Railway deploy

1. Truy cập **[github.com/new](https://github.com/new)**
2. Điền thông tin:
   - **Repository name:** `design-order-bot`
   - **Description:** `VC Corp Design Order Bot`
   - Chọn **Private**
   - ❌ KHÔNG tick "Add a README"
3. Bấm **Create repository**
4. Ở trang repo mới, bấm link **uploading an existing file**
5. **Kéo thả** tất cả các file sau vào:
   - `index.js`
   - `handlers.js`
   - `db.js`
   - `package.json`
   - `.gitignore`
   - `.env.example`
6. Ở ô **Commit message**, ghi: `Initial commit - Design Order Bot v1.0`
7. Bấm **Commit changes**

> **Kiểm tra:** Repo phải có 6 files. KHÔNG upload file `.env` hay `supabase_setup.sql` lên GitHub.

---

## BƯỚC 3 — Deploy lên Railway

**Mục tiêu:** Bot chạy 24/7 trên cloud

1. Truy cập **[railway.app](https://railway.app)** → bấm **Login** → chọn **GitHub**
2. Sau khi login, bấm **New Project**
3. Chọn **Deploy from GitHub repo**
4. Nếu không thấy repo, bấm **Configure GitHub App** → cho phép truy cập repo `design-order-bot`
5. Chọn repo **design-order-bot**
6. Railway sẽ tự detect Node.js và bắt đầu build
7. Build sẽ **fail lần đầu** (vì chưa có env vars) — đây là bình thường!

---

## BƯỚC 4 — Điền Environment Variables

**Mục tiêu:** Cung cấp thông tin để bot kết nối Telegram + Supabase

1. Trong Railway, click vào **service** vừa tạo (hình chữ nhật)
2. Chọn tab **Variables**
3. Bấm **+ New Variable** và thêm lần lượt:

| Variable | Giá trị | Nguồn |
|---|---|---|
| `BOT_TOKEN` | `7xxxxxx:AAHxxxxxxx...` | Từ @BotFather trên Telegram |
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | Từ Bước 1 |
| `SUPABASE_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Từ Bước 1 (anon key) |
| `GROUP_DESIGN_ID` | `-100xxxxxxxxxx` | Chat ID nhóm design (số âm) |
| `ADMIN_IDS` | `548811680` | Telegram user ID của admin |

> **Mẹo:** Nhiều admin thì phân cách bằng dấu phẩy: `548811680,123456789`

4. Sau khi điền xong, Railway sẽ **tự động redeploy**
5. Đợi ~1-2 phút, kiểm tra tab **Deployments** → trạng thái phải là **Active** (xanh lá)

### Nếu deploy fail:

- Bấm vào deployment → xem **Logs**
- Nếu thấy `❌ Thiếu XXX trong environment variables!` → kiểm tra lại tên biến (phải viết ĐÚNG chữ hoa)
- Nếu thấy lỗi khác → chụp ảnh log gửi lại cho mình

---

## BƯỚC 5 — Test Bot

1. Mở Telegram → tìm bot của bạn (theo username đã đặt ở BotFather)
2. Nhắn `/help`
3. Bot trả lời danh sách lệnh → **DONE!** 🎉
4. Thử thêm: nhắn `/san_pham` để xem 4 sản phẩm mẫu đã tạo từ SQL

### Test nâng cao:

- Thêm bot vào group design (dùng group chat ID ở `GROUP_DESIGN_ID`)
- Nhắn `/order Test banner homepage` → bot tạo order + gửi vào group
- Trong group, bấm **✋ Tôi nhận** → designer nhận order
- Nhắn `/xong ORD260310-001 https://link-san-pham.com` → báo hoàn thành

---

## Troubleshooting

| Vấn đề | Giải pháp |
|---|---|
| Bot không trả lời | Kiểm tra Railway logs, đảm bảo deploy thành công |
| "Thiếu BOT_TOKEN" | Kiểm tra tên biến trong Railway Variables (chữ hoa) |
| Bot không gửi vào group | Kiểm tra `GROUP_DESIGN_ID` đúng chưa, bot đã được add vào group chưa |
| Lỗi database | Kiểm tra `SUPABASE_URL` và `SUPABASE_KEY`, đảm bảo đã chạy SQL |
| Railway hết free tier | Railway cho ~500 giờ/tháng miễn phí, đủ chạy 24/7 |

---

## Cách lấy GROUP_DESIGN_ID (nếu chưa có)

1. Thêm bot **@RawDataBot** vào group design
2. Gõ bất kỳ tin nhắn nào trong group
3. @RawDataBot sẽ trả về JSON, tìm dòng `"chat": {"id": -100xxxxxxx}`
4. Copy số đó (bao gồm dấu trừ) → đây là `GROUP_DESIGN_ID`
5. Xong thì kick @RawDataBot khỏi group

## Cách lấy ADMIN_IDS (nếu chưa có)

1. Nhắn cho bot **@userinfobot** trên Telegram
2. Bot trả về `Id: 548811680` → đó là Telegram user ID của bạn

---

*VC Corp · Content Division · Design Order Bot v1.0*
