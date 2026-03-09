# 🤖 Design Order Bot — Hướng dẫn cài đặt
## Stack: Railway + Supabase (hoàn toàn free, click-only)

---

## BƯỚC 1 — Tạo Supabase (database)

1. Vào **supabase.com** → Sign up bằng GitHub
2. Bấm **New project** → đặt tên, chọn region **Southeast Asia**
3. Đợi ~1 phút cho project khởi động
4. Vào **SQL Editor** (menu trái) → paste toàn bộ nội dung file `supabase_setup.sql` → bấm **Run**
5. Lấy 2 thông tin từ **Settings → API**:
   - **Project URL** → đây là `SUPABASE_URL`
   - **anon public key** → đây là `SUPABASE_KEY`

---

## BƯỚC 2 — Upload code lên GitHub

1. Vào **github.com** → đăng ký nếu chưa có
2. Bấm **New repository** → đặt tên `design-order-bot` → **Private** → Create
3. Bấm **uploading an existing file**
4. Kéo thả 3 file vào: `index.js`, `handlers.js`, `db.js`, `package.json`
5. Bấm **Commit changes**

---

## BƯỚC 3 — Deploy lên Railway

1. Vào **railway.app** → Sign up bằng GitHub
2. Bấm **New Project → Deploy from GitHub repo**
3. Chọn repo `design-order-bot` vừa tạo
4. Railway sẽ tự detect Node.js và deploy

---

## BƯỚC 4 — Điền Environment Variables

Trong Railway, vào project → **Variables** → thêm từng cái:

| Key | Giá trị |
|-----|---------|
| `BOT_TOKEN` | Token từ @BotFather |
| `SUPABASE_URL` | URL từ Supabase Settings |
| `SUPABASE_KEY` | anon key từ Supabase Settings |
| `GROUP_DESIGN_ID` | Chat ID của group design (số âm, VD: -1001234567890) |
| `ADMIN_IDS` | Telegram user ID của admin (VD: 548811680) |

Sau khi điền xong Railway tự **redeploy** — đợi 1 phút là chạy!

---

## BƯỚC 5 — Test

Nhắn `/help` cho bot trên Telegram → nếu bot trả lời là xong! 🎉

---

## Lệnh đầy đủ

| Lệnh | Ai dùng | Mô tả |
|------|---------|-------|
| `/order [nội dung]` | Người order | Tạo order mới |
| `/xong [ID] [link]` | Designer | Báo xong phần của mình |
| `/publish [ID] [link]` | BTV | Xác nhận bài đã đăng |
| `/xacnhan [ID]` | BTV | Xác nhận không cần link |
| `/mytasks` | Designer | Xem order đang nhận |
| `/order_info [ID]` | Tất cả | Xem chi tiết order |
| `/san_pham` | Tất cả | Xem danh sách loại SP & giá |
| `/them_sp [tên] [giá]` | Admin | Thêm loại sản phẩm |
| `/sua_gia [tên] [giá]` | Admin | Sửa đơn giá |
| `/xoa_sp [tên]` | Admin | Xóa loại sản phẩm |
| `/help` | Tất cả | Xem hướng dẫn |

---

*VC Corp · Content Division · Design Order Bot v1.0*
