# โรงเรียนสังกัด อปท. ภาคใต้

> เว็บไซต์รวบรวมข้อมูลโรงเรียนภายใต้สังกัดองค์กรปกครองส่วนท้องถิ่น (อปท.)
> ในสังกัด อปท. ภาคใต้ — ตำแหน่ง ระดับชั้นที่เปิดสอน จำนวนนักเรียน/ครู
> ห้องเรียนพิเศษ และจุดเด่นของแต่ละโรงเรียน

🌐 **Live**: <https://natstpt.github.io/phuket-lao-schools/>

---

## ทำอะไรได้บ้าง

หน้าเว็บแบ่งเป็น 2 มุมมอง สลับด้วยแถบ tab ที่ด้านบน

### 🗺️ ภาพรวม (Overview)
- **แผนที่ interactive** ปักหมุดโรงเรียนในภาคใต้
  คลิกหมุดเพื่อดูชื่อ + หน่วยงานต้นสังกัด
- **การ์ดสรุปต่อโรงเรียน** แสดง:
  - ลำดับตามรายชื่อ + สังกัด (เทศบาล / อบจ.)
  - ชื่อโรงเรียน + ระดับชั้นที่เปิดสอน
  - จำนวนนักเรียน + จำนวนครู/บุคลากร
  - ห้องเรียนพิเศษ / หลักสูตรเด่น
  - ข้อมูลน่าสนใจ และรางวัล/จุดเด่น

### 📋 รายละเอียด (Detail)
ตารางแบบ scan ได้รวดเร็ว แต่ละแถวมี:
- ลำดับตามรายชื่อ + ชื่อโรงเรียน
- thumbnail แผนที่ (คลิกเพื่อเปิดใน Google Maps จริง)
- ระดับชั้นแบบ pill — มีอนุบาล / ประถม / ม.ต้น / ม.ปลาย
- ลิงก์เว็บ/Facebook ของโรงเรียน
- คลิกแถวเพื่อขยายดู 6 ฟิลด์รายละเอียดเต็ม

### 🔍 ค้นหา
ช่อง search ที่ด้านบน — กรองได้จาก ชื่อ / ที่อยู่ / หน่วยงาน
ทำงานพร้อมกันทั้ง 2 มุมมอง

---

## เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี | เหตุผล |
|---|---|---|
| **โครงสร้างหน้า** | HTML5 + Vanilla JavaScript | ไม่ต้อง build, deploy ตรง GitHub Pages ได้เลย |
| **CSS framework** | Tailwind CSS (Play CDN) | utility classes ครบ + custom CSS ในไฟล์เดียว |
| **ฟอนต์** | IBM Plex Sans Thai (body) + Fraunces (display) | editorial style — ไทยอ่านสบาย + ฝรั่งมี optical sizing |
| **แผนที่** | Leaflet 1.9.4 + OpenStreetMap tiles | open-source ฟรี — ไม่ต้องใช้ API key |
| **ข้อมูล** | static `data.js` (gen จาก Excel) | ไม่ต้องมี backend / database |
| **Build script** | Python 3 + `openpyxl` | อ่าน xlsx + แปลงเป็น JSON ฝัง JS |

---

## โครงสร้างไฟล์

```
.
├── index.html        — โครงสร้างหน้า + Tailwind config + custom CSS ทั้งหมด
├── app.js            — render การ์ด/ตาราง, init แผนที่, search, tab switching
├── data.js           — ข้อมูลโรงเรียน 10 แห่ง (auto-generated, อย่าแก้มือ)
├── build_data.py     — script ดึงข้อมูลจาก shool.xlsx → data.js
├── shool.xlsx        — ไฟล์ Excel ต้นฉบับ (อยู่ใน .gitignore)
├── README.md
└── .gitignore
```

---

## วิธีรันบนเครื่อง

ต้องมี Python 3 ติดตั้ง:

```bash
python -m http.server 8000
```

แล้วเปิด <http://localhost:8000>

> ห้ามเปิดไฟล์ `index.html` ตรงๆ จาก filesystem (`file://`)
> เพราะ browser จะ block การโหลด `data.js` ด้วยเหตุผลด้าน security

---

## วิธีอัปเดตข้อมูล

ขั้นตอนเมื่อแก้ไข `shool.xlsx`:

```bash
# ครั้งแรกเท่านั้น — ติดตั้ง Python deps
python -m venv .venv

# Windows (Git Bash):
./.venv/Scripts/python -m pip install openpyxl

# macOS/Linux:
source .venv/bin/activate && pip install openpyxl

# ทุกครั้งที่แก้ xlsx:
./.venv/Scripts/python build_data.py     # หรือ python build_data.py
```

สคริปต์จะ:
1. อ่านชีท `Phuket` จาก `shool.xlsx`
2. กรองแถวที่ที่อยู่มีคำว่า "ภูเก็ต"
3. รวมแถวที่ชื่อ + ที่อยู่ตรงกันเป็น 1 record (เก็บลำดับเดิมเป็น array)
4. ดึง lat/lng จาก hyperlink ของคอลัมน์ Google Map
5. parse แหล่งข้อมูล (`facebook.com/foo + example.com`) เป็น `[{url, label}]`
6. เขียนผลลัพธ์ลง `data.js` ในรูปแบบ `const SCHOOLS = [...]`

จากนั้น commit + push → GitHub Pages จะ rebuild อัตโนมัติ ~1 นาที

---

## วิธี deploy บน GitHub Pages

> 🎉 Repo นี้ตั้ง Pages ไว้แล้ว — ทุกครั้งที่ push ขึ้น `main`,
> หน้าเว็บจะอัปเดตอัตโนมัติภายใน 1–2 นาที

ถ้าต้องการ fork ไปทำของตัวเอง:

1. Fork repo นี้ไปยัง account ของคุณ
2. ไปที่ **Settings → Pages**
3. **Source**: เลือก *Deploy from a branch*
4. **Branch**: `main` / folder `/ (root)` → **Save**
5. รอประมาณ 1 นาที จะได้ URL `https://<username>.github.io/<repo-name>/`

---

## โครงสร้างข้อมูลใน `data.js`

แต่ละโรงเรียนมี shape:

```js
{
  id: 1,                                    // running index 1..N
  name: "โรงเรียนเทศบาลเมืองภูเก็ต",
  org: "เทศบาลนครภูเก็ต",                   // หน่วยงานต้นสังกัด
  address: "75 ถ.กรุงเทพ ต.ตลาดเหนือ ...",
  levels: "อ.1 - ม.3",                      // ช่วงระดับชั้นแบบสรุป
  kindergarten: true,                       // boolean ต่อระดับ
  primary: true,
  lower_secondary: true,
  upper_secondary: false,
  google_map: { url, lat, lng },            // ตำแหน่งบนแผนที่
  sources: [{ url, label }, ...],           // ลิงก์เว็บ/Facebook
  vacancy: 2,                               // อัตราว่างรวม
  positions: ["41-2-08-6500-497", ...],     // เลขที่ตำแหน่งทั้งหมด
  seq_numbers: [1, 2],                      // ลำดับเดิมจาก xlsx
  // ── รายละเอียดเชิงคุณภาพ ──
  student_count: "~1,782 คน",
  staff_count: "ครู 74 คน + ผู้ช่วย 5 + จ้างทั่วไป 10",
  special_programs: "เปิด ม.1-ม.3 ห้องเรียนหลากหลาย",
  awards: "โรงเรียนเทศบาลขนาดใหญ่ พื้นที่ 13 ไร่",
  highlights: "ขนาดใหญ่ มีสาระคณิตหลายระดับ",
  extra_sources: "วิกิพีเดีย, mpm.ac.th"
}
```

---

## รายละเอียดของโค้ด

### `index.html`
- โหลดฟอนต์ Google Fonts (preconnect แล้วเพื่อความเร็ว)
- โหลด Leaflet CSS/JS จาก unpkg
- โหลด Tailwind Play CDN + กำหนด `tailwind.config` (paper, ink, ocean, coral)
- custom CSS ทั้งหมดอยู่ใน `<style>` ใน head:
  - `.grain` — SVG noise overlay ทั่วหน้า opacity ต่ำ
  - `.tabs / .tab` — pill-style segmented control
  - `.overview-card / .card-*` — การ์ดในมุมมอง Overview
  - `.schools-table / .lv / .map-thumb` — ตารางในมุมมอง Detail
  - `.expand-toggle / .row-detail` — ระบบขยายแถว
  - `.school-pin-dot / .leaflet-popup-*` — สไตล์หมุดและ popup ของ Leaflet
- markup เป็น 2 view: `#view-overview` และ `#view-detail`
- script tag โหลด `data.js` ก่อน `app.js` (สำคัญ)

### `app.js` — flow หลัก
1. **`DOMContentLoaded`** → เรียก `initMap()` → `setupSearch()` → `setupExpand()` → `setupTabs()` → `render()`
2. **`render()`** ทำสามอย่างพร้อมกัน:
   - render `<article>` ลง `#overview-grid` (Overview cards)
   - render `<tr>` ลง `#rows` (Detail table)
   - update Leaflet markers ผ่าน `updateMap(filtered)`
3. **search input** debounce 90ms → update `state.q` → เรียก `render()` ใหม่
4. **tab switching** อ่าน `location.hash` (`#overview` / `#detail`) — รองรับ back/forward ของ browser
5. **expand toggle** event-delegation ที่ `#rows` — กรอง click ที่ `<a>` ออกเพื่อให้ลิงก์ map/source ทำงานปกติ
6. **map** init ครั้งเดียว ใช้ `L.layerGroup` เก็บหมุด — `clearLayers()` แล้ว add ใหม่ทุกครั้งที่ filter เปลี่ยน

### `build_data.py` — flow หลัก
- ใช้ `openpyxl` อ่าน hyperlink ของ Google Map cell และ source cell
  (ไม่ใช้ pandas เพราะ Python 3.14 ยังไม่มี wheel — และไม่จำเป็น)
- merge แถวที่ `(name, address)` ตรงกัน — เก็บฟิลด์แรกที่ไม่ว่าง, รวม positions, รวม vacancy
- normalize URL (เติม `https://`, strip `www.`, dedup โดยใช้ canonical key)
- เขียน JSON พร้อม `ensure_ascii=False` เพื่อให้ภาษาไทยอ่านได้ในไฟล์ output

---

## เครดิต

- ข้อมูลโรงเรียนรวบรวมจากเว็บไซต์ทางการของ อปท. ในภูเก็ต และเฟซบุ๊กของโรงเรียน
- แผนที่: [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- map library: [Leaflet](https://leafletjs.com/)
- ฟอนต์: [IBM Plex Sans Thai](https://fonts.google.com/specimen/IBM+Plex+Sans+Thai),
  [Fraunces](https://fonts.google.com/specimen/Fraunces) — ทั้งสองเป็น open-source

> ข้อมูลในเว็บไซต์เพื่อการศึกษาและอ้างอิงเท่านั้น
> ผู้ใช้งานควรตรวจสอบความถูกต้องล่าสุดจากแหล่งทางการของหน่วยงานก่อนใช้
