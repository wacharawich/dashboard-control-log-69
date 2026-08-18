/**
 * ราคาเสนอ/terminal — Google Apps Script (backend)
 * =================================================
 * ใช้คู่กับไฟล์ index.html (วางในโปรเจกต์เดียวกัน)
 *
 * - doGet()         : เสิร์ฟหน้าเว็บจากไฟล์ HTML ชื่อ "index"
 * - getSheetData()  : อ่านข้อมูลจาก Google Sheet (คอลัมน์ A–K) ส่งกลับเป็น JSON
 * - updateStatus()  : เขียนสถานะ (คอลัมน์ K) ของรายการหนึ่งกลับลงชีต
 * - doPost()        : รับคำขอ POST จากเว็บแอปภายนอก (เช่น Convex action)
 *                     body JSON: { regNo: "...", status: "..." }
 *
 * แก้ไขค่าคงที่ด้านล่างถ้าต้องการเปลี่ยน Spreadsheet / ชื่อชีต
 */
var SHEET_ID = "1UtSyrAUOXdtRiztXbN4ntobPeS0fMErUrAIeK4NRxcw";
var SHEET_NAME = "sheet99";

var HEADER_FIRST_CELL = "เลขทะเบียนคุม";

// ค่าที่อนุญาตสำหรับคอลัมน์ K สถานะ
var STATUS_OPTIONS = ["เสนอ", "อนุมัติ", "ไม่อนุมัติ", "รอปรับแผน"];

var THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/**
 * Entry point ของ Web App — เสิร์ฟหน้าเว็บจากไฟล์ HTML "index"
 * (ชื่อไฟล์ต้องเป็น "index" ตัวพิมพ์เล็ก ห้ามเปลี่ยน)
 */
function doGet() {
  var html = HtmlService.createHtmlOutputFromFile("index");
  html.setTitle("ราคาเสนอ/terminal — วิเคราะห์ราคาเสนอ");
  html.addMetaTag("viewport", "width=device-width, initial-scale=1");
  // ALLOWALL เผื่อเปิดหน้าใน iframe (เช่น ฝังในเว็บอื่น) — ถ้าไม่ต้องการให้ฝัง
  // ให้ลบบรรทัดนี้ออก แล้ว Apps Script จะบล็อกการฝังโดยอัตโนมัติ
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

/**
 * รับคำขอ POST จากภายนอก (ใช้โดย Convex action ของเว็บแอปหลัก)
 *
 * ตัวอย่าง body (JSON):
 *   { "regNo": "69-0001", "status": "อนุมัติ" }
 *
 * หมายเหตุ: ต้อง deploy เป็น Web app (Execute as: Me, Who has access: Anyone)
 * แล้วเอา URL ที่ได้ไปตั้งเป็น APPS_SCRIPT_WEB_APP_URL ในเว็บแอปหลัก
 */
function doPost(e) {
  var out = { ok: false, error: "คำขอไม่ถูกต้อง" };
  try {
    var body = JSON.parse(e.postData.contents);
    if (body && body.regNo && body.status) {
      out = updateStatus(body.regNo, body.status);
    } else {
      out = { ok: false, error: "ต้องระบุ regNo และ status ในคำขอ" };
    }
  } catch (err) {
    out = { ok: false, error: "อ่านข้อมูลจากคำขอไม่สำเร็จ: " + err };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * เขียนสถานะ (คอลัมน์ K) ของรายการลงชีต โดยค้นหาจากเลขทะเบียนคุม (คอลัมน์ A)
 * คืนค่า: { ok: true, ... } หรือ { ok: false, error: "ข้อความ" }
 * เรียกได้จากหน้าเว็บ (google.script.run.updateStatus) หรือจาก doPost
 */
function updateStatus(regNo, status) {
  try {
    if (STATUS_OPTIONS.indexOf(status) === -1) {
      return { ok: false, error: 'สถานะ "' + status + '" ไม่ถูกต้อง (ต้องเป็น ' + STATUS_OPTIONS.join(" / ") + ") " };
    }
    var key = String(regNo).trim();
    if (key === "") {
      return { ok: false, error: "ไม่พบเลขทะเบียนคุม" };
    }

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return { ok: false, error: 'ไม่พบชีต "' + SHEET_NAME + '" ใน Spreadsheet นี้' };
    }

    var values = sheet.getDataRange().getValues();
    var start = 0;
    if (values.length > 0 && String(values[0][0]).trim() === HEADER_FIRST_CELL) {
      start = 1; // ข้ามแถวหัวตาราง
    }

    var target = -1;
    for (var i = start; i < values.length; i++) {
      if (String(values[i][0]).trim() === key) {
        target = i;
        break;
      }
    }
    if (target === -1) {
      return { ok: false, error: 'ไม่พบเลขทะเบียนคุม "' + key + '" ในชีต' };
    }

    sheet.getRange(target + 1, 11).setValue(status); // คอลัมน์ K = 11
    return { ok: true, updated: 1, regNo: key, status: status };
  } catch (e) {
    var msg = String(e && e.message ? e.message : e);
    return { ok: false, error: msg };
  }
}

/**
 * อ่านข้อมูลทั้งหมดจากชีต แล้วคืนเป็นอาร์เรย์ของ object
 * ที่ฝั่ง frontend (index.html) นำไปกรอง/วาดกราฟได้ทันที
 *
 * คอลัมน์ในชีต:
 *   A เลขทะเบียนคุม · B เดือน · C กลุ่มภารกิจ · D กลุ่มงาน · E หน่วยงาน
 *   F รายการ · G หมวด · H ประเภท · I ราคาเสนอ · J ประเภทแผน · K สถานะ
 *
 * คืนค่า: { rows: [...] } หรือ { error: "ข้อความ" } เมื่อมีปัญหา
 * (คืนในรูป object แทนการ throw เพื่อให้ frontend แสดงข้อผิดพลาดภาษาไทยได้ชัดเจน)
 */
function getSheetData() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error('ไม่พบชีต "' + SHEET_NAME + '" ใน Spreadsheet นี้');
    }

    var values = sheet.getDataRange().getValues();
    var start = 0;
    if (values.length > 0 && String(values[0][0]).trim() === HEADER_FIRST_CELL) {
      start = 1; // ข้ามแถวหัวตาราง
    }

    var rows = [];
    for (var i = start; i < values.length; i++) {
      var row = parseRow(values[i]);
      if (row) rows.push(row);
    }

    if (rows.length === 0) {
      throw new Error('ไม่พบข้อมูลในชีต "' + SHEET_NAME + '" (ตรวจสอบคอลัมน์ I ราคาเสนอ)');
    }

    return { rows: rows };
  } catch (e) {
    var msg = String(e && e.message ? e.message : e);
    // Apps Script ปกปิดข้อความ error ฝั่ง server จาก client — ส่งเป็น data ปกติแทน
    return { error: msg };
  }
}

/** แปลงหนึ่งแถว (array ของค่าในเซล) เป็น object ข้อมูล; คืน null ถ้าแถวไม่สมบูรณ์ */
function parseRow(cells) {
  var c = cells.map(function (v) {
    return v == null ? "" : String(v).trim();
  });
  var price = parsePrice(c[8]);
  if (price === null) return null; // ไม่มีราคาเสนอ = ข้ามแถว

  var m = normalizeMonth(c[1]);
  return {
    regNo: c[0],          // A เลขทะเบียนคุม
    date: c[1],           // B เดือน (ค่าดิบ เช่น "19 ก.ย. 2025" / "ก.ย. 2025")
    monthKey: m.key,      // "ก.ย. 2025" สำหรับจัดกลุ่ม
    monthOrder: m.order,  // ตัวเลขใช้เรียงลำดับเดือน
    mission: c[2],        // C กลุ่มภารกิจ
    workGroup: c[3],      // D กลุ่มงาน
    agency: c[4],         // E หน่วยงาน
    item: c[5],           // F รายการ
    category: c[6],       // G หมวด
    type: c[7],           // H ประเภท
    price: price,         // I ราคาเสนอ (ตัวเลข)
    planType: c[9] || "", // J ประเภทแผน (ในแผน/นอกแผน/ทดแทน)
    status: c[10] || ""   // K สถานะ (เสนอ/อนุมัติ/ไม่อนุมัติ/รอปรับแผน)
  };
}

/** "1,234.50" / "1 234" -> ตัวเลข; null ถ้าแปลงไม่ได้หรือว่าง */
function parsePrice(raw) {
  var cleaned = String(raw).replace(/[, ]/g, "").trim();
  if (cleaned === "") return null;
  var n = Number(cleaned);
  return isFinite(n) ? n : null;
}

/** "19 ก.ย. 2025" -> { key: "ก.ย. 2025", order: 2025*12+8 } */
function normalizeMonth(raw) {
  var s = String(raw).trim();
  var m = s.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (m) {
    var idx = THAI_MONTHS.indexOf(m[2]);
    var year = Number(m[3]);
    if (idx >= 0 && isFinite(year)) {
      return { key: m[2] + " " + year, order: year * 12 + idx };
    }
  }
  return { key: s || "(ไม่มีข้อมูล)", order: Number.MAX_SAFE_INTEGER };
}
