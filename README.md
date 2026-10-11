# TikTok Live Monitor → ADB Reboot + Shutdown PC

Tự động phát hiện phiên TikTok Live kết thúc, reboot điện thoại Android qua ADB, sau đó tắt máy tính.

---

## Tải về

### Cách 1 — Clone bằng Git
```bash
git clone https://github.com/swtneko/tiktok-live-adb-shutdown.git
cd tiktok-live-adb-shutdown
npm install tiktok-live-connector
```

### Cách 2 — Tải ZIP (không cần Git)
1. Vào https://github.com/swtneko/tiktok-live-adb-shutdown
2. Bấm nút **Code** (màu xanh) → **Download ZIP**
3. Giải nén ra thư mục bất kỳ
4. Mở CMD trong thư mục đó:
   ```bash
   npm install tiktok-live-connector
   ```

---

## Yêu cầu

- **PC**: Windows 10/11
- **Node.js** v18 trở lên → https://nodejs.org
- **ADB** (Android Debug Bridge) → https://developer.android.com/tools/releases/platform-tools
  - Giải nén và thêm vào PATH, hoặc để `adb.exe` cùng thư mục với script
- **Điện thoại Android 11+** có bật Developer Options

---

## Cài đặt

### 1. Cài Node.js
1. Vào https://nodejs.org → tải bản **LTS**
2. Chạy file cài đặt, bấm Next liên tục
3. Kiểm tra:
   ```
   node -v
   npm -v
   ```

### 2. Cài ADB (Platform Tools)
1. Vào https://developer.android.com/tools/releases/platform-tools
2. Tải **SDK Platform Tools for Windows**
3. Giải nén vào ví dụ `C:\platform-tools\`
4. Thêm vào PATH:
   - Windows + R → gõ `sysdm.cpl` → Advanced → Environment Variables
   - Chọn `Path` → Edit → New → nhập `C:\platform-tools`
   - OK hết → mở CMD mới
5. Kiểm tra:
   ```
   adb version
   ```

### 3. Cài package
```bash
npm install tiktok-live-connector
```

---

## Kết nối ADB qua USB

### Bước 1 — Bật Developer Options
Settings → About phone → tap **Build number** 7 lần → thấy thông báo "You are now a developer"

### Bước 2 — Bật USB Debugging
Settings → Developer Options → **USB Debugging** → bật lên

### Bước 3 — Cắm cáp USB vào PC
Điện thoại hiện hộp thoại **"Allow USB debugging?"** → tap **Allow**

### Bước 4 — Kiểm tra kết nối
```
adb devices
```
Thấy dòng như này là thành công ✅
```
List of devices attached
R3CN801234X     device
```

### Bước 5 — Chạy tool
```bash
node win-android.js new.world.015
```
Script tự detect thiết bị USB, không cần truyền IP.

---

## Kết nối ADB Wireless (Android 11+)

### Bước 1 — Bật Developer Options
Settings → About phone → tap **Build number** 7 lần → Developer Options được mở

### Bước 2 — Bật Wireless Debugging
Settings → Developer Options → **Wireless Debugging** → bật lên

### Bước 3 — Pair lần đầu (chỉ làm 1 lần)
1. Tap vào chữ **"Wireless Debugging"** → tap **"Pair device with pairing code"**
2. Màn hình hiện:
   ```
   Wi-Fi pairing code
   Port: 37458        ← port pair
   Code: 123456       ← mã 6 chữ số
   ```
3. Trên PC mở CMD:
   ```
   adb pair 192.168.x.x:37458
   ```
   Nhập code `123456` → Enter

### Bước 4 — Connect (mỗi lần dùng)
1. Vào màn hình **Wireless Debugging**, thấy:
   ```
   IP address & Port
   192.168.x.x:45678   ← port connect (khác port pair)
   ```
2. Trên PC:
   ```
   adb connect 192.168.x.x:45678
   ```
3. Kiểm tra:
   ```
   adb devices
   ```
   Thấy `192.168.x.x:45678   device` là thành công ✅

> **Lưu ý:** Port connect thay đổi mỗi lần tắt/bật Wireless Debugging. Port pair chỉ dùng 1 lần đầu.

---

## Chạy

```bash
# Tự động detect thiết bị
node win-android.js <tiktok_username>

# Chỉ định IP:PORT
node win-android.js <tiktok_username> 192.168.x.x:45678
```

**Ví dụ:**
```bash
node win-android.js new.world.015
node win-android.js new.world.015 192.168.1.101:45678
```

---

## Luồng hoạt động

```
Kết nối TikTok Live WebSocket
        ↓
   Nhận event streamEnd
        ↓
   Chờ 5 giây xác nhận
        ↓
   adb reboot điện thoại
        ↓
   Chờ 60 giây
        ↓
   shutdown /s /t 0  (tắt PC)
```

---

## Xử lý các trường hợp

| Tình huống | Hành động |
|---|---|
| Nhận `streamEnd` | Reboot điện thoại → tắt PC |
| WebSocket bị drop | Tự reconnect tối đa 5 lần |
| Reconnect 5 lần thất bại | Coi như stream kết thúc → reboot + tắt PC |
| Lỗi `not live` / `room_not_found` | Reboot + tắt PC ngay |

---

## Log

Mọi hoạt động được ghi vào file `tiktok_adb_shutdown.log` cùng thư mục.

```
2026-09-03T07:01:13.122Z [INFO ] TikTok Live Monitor khởi động
2026-09-03T07:01:13.122Z [INFO ]   Username   : @new.world.015
2026-09-03T07:01:13.122Z [INFO ]   ADB target : 192.168.1.101:45678
2026-09-03T07:01:17.980Z [INFO ] 🟢 Đã kết nối live @new.world.015 | roomId: 760847...
2026-09-03T07:01:24.508Z [INFO ] 🔴 streamEnd — stream đã kết thúc.
2026-09-03T07:01:29.520Z [INFO ] 🔄 Gửi lệnh reboot tới: 192.168.1.101:45678
2026-09-03T07:01:29.578Z [INFO ] ✅ adb reboot thành công.
2026-09-03T07:01:29.578Z [INFO ] Shutdown máy tính sau 60 giây...
```

---

## Lỗi thường gặp

**`adb: command not found`**
→ Chưa cài ADB hoặc chưa thêm vào PATH. Tải Platform Tools và thêm vào PATH.

**`WebcastPushConnection is not a constructor`**
→ Dùng file `index2.js` (phiên bản mới dùng `TikTokLiveConnection`).

**`failed to connect`**
→ Sai port, thử lại lấy port từ màn hình Wireless Debugging.

**`connection refused`**
→ Wireless Debugging chưa bật hoặc PC và điện thoại khác mạng WiFi.

**Thiết bị không thấy trong `adb devices`**
→ Chạy lại `adb connect IP:PORT` trước khi chạy tool.
