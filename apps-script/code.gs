/**
 * ราคาเสนอ/terminal — Google Apps Script (backend)
 * =================================================
 * ใช้คู่กับไฟล์ index.html (วางในโปรเจกต์เดียวกัน)
 *
 * - doGet()        : เสิร์ฟหน้าเว็บจากไฟล์ HTML ชื่อ "index"
 * - getSheetData() : อ่านข้อมูลจาก Google Sheet (คอลัมน์ A–J) ส่งกลับเป็น JSON
 *
 * แก้ไขค่าคงที่ด้านล่างถ้าต้องการเปลี่ยน Spreadsheet / ชื่อชีต
 */
var SHEET_ID = "1UtSyrAUOXdtRiztXbN4ntobPeS0fMErUrAIeK4NRxcw";
var SHEET_NAME = "sheet99";

var HEADER_FIRST_CELL = "เลขทะเบียนคุม";

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
 * อ่านข้อมูลทั้งหมดจากชีต แล้วคืนเป็นอาร์เรย์ของ object
 * ที่ฝั่ง frontend (index.html) นำไปกรอง/วาดกราฟได้ทันที
 *
 * คอลัมน์ในชีต:
 *   A เลขทะเบียนคุม · B เดือน · C กลุ่มภารกิจ · D กลุ่มงาน · E หน่วยงาน
 *   F รายการ · G หมวด · H ประเภท · I ราคาเสนอ · J ประเภทแผน
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
    planType: c[9] || ""  // J ประเภทแผน (ในแผน/นอกแผน/ทดแทน)
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
