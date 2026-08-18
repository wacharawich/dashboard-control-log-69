/**
 * ราคาเสนอ/terminal — Google Apps Script backend
 * ------------------------------------------------
 * - doGet()        : เสิร์ฟหน้าเว็บจากไฟล์ HTML ชื่อ "index"
 * - getSheetData() : อ่านข้อมูลจาก Spreadsheet (คอลัมน์ A–J) แล้วคืนเป็น JSON ให้หน้าเว็บ
 *
 * คอลัมน์ในชีต:
 *   A เลขทะเบียนคุม · B เดือน · C กลุ่มภารกิจ · D กลุ่มงาน · E หน่วยงาน
 *   F รายการ · G หมวด · H ประเภท · I ราคาเสนอ · J ประเภทแผน
 *
 * วิธีติดตั้ง: ดู apps-script/README.md (ต้องตั้งชื่อไฟล์ HTML ว่า "index" ตัวพิมพ์เล็ก)
 */

var SHEET_ID = "1UtSyrAUOXdtRiztXbN4ntobPeS0fMErUrAIeK4NRxcw";
var SHEET_NAME = "sheet99";

// ถ้าคอลัมน์ เดือน (B) เป็นวันที่ (Date) ที่แสดงปี พ.ศ. ในชีต เช่น "19 ก.ย. 2568"
// ให้เปลี่ยนเป็น true เพื่อให้หน้าเว็บแสดงปีแบบเดียวกันกับที่เห็นในชีต
var USE_BUDDHIST_YEAR = false;

var THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** เสิร์ฟหน้าเว็บ (ต้องมีไฟล์ HTML ชื่อ "index" ในโปรเจกต์) */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("ราคาเสนอ/terminal")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * อ่านข้อมูลสดจาก Google Sheet แล้วคืนเป็น
 * { rows: [...], syncedAt: ISO string, rowCount: number }
 */
function getSheetData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(
      'ไม่พบชีต "' + SHEET_NAME + '" ใน Spreadsheet ที่กำหนด (ตรวจ SHEET_ID / SHEET_NAME ใน code.gs)'
    );
  }

  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(10, sheet.getLastColumn()); // อ่านอย่างน้อย A–J
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var tz = ss.getSpreadsheetTimeZone();

  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    // ข้ามแถวหัวตารางถ้ามี
    if (i === 0 && String(r[0] || "").trim() === "เลขทะเบียนคุม") continue;

    var price = parsePrice(r[8]);
    if (price === null) continue; // ข้ามแถวที่ไม่มีราคาเสนอ

    var dateText = formatMonth(r[1], tz);
    rows.push({
      regNo: cell(r[0]),          // A เลขทะเบียนคุม
      date: dateText,             // B เดือน (ข้อความเต็ม เช่น "19 ก.ย. 2025")
      monthKey: monthKeyOf(dateText), // กลุ่มเดือน เช่น "ก.ย. 2025"
      monthOrder: monthOrderOf(dateText),
      mission: cell(r[2]),        // C กลุ่มภารกิจ
      workGroup: cell(r[3]),      // D กลุ่มงาน
      agency: cell(r[4]),         // E หน่วยงาน
      item: cell(r[5]),           // F รายการ
      category: cell(r[6]),       // G หมวด
      type: cell(r[7]),           // H ประเภท
      price: price,               // I ราคาเสนอ
      planType: cell(r[9]),       // J ประเภทแผน
    });
  }

  if (rows.length === 0) {
    throw new Error(
      'ไม่พบข้อมูลที่ใช้ได้ในชีต "' + SHEET_NAME +
      '" (ตรวจว่ามีคอลัมน์ A–J และคอลัมน์ I ราคาเสนอเป็นตัวเลข)'
    );
  }

  return {
    rows: rows,
    syncedAt: new Date().toISOString(),
    rowCount: rows.length,
  };
}

/* ---------------- helpers ---------------- */

function cell(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** "1,234,567" / "1 234 567" / 1234567 -> 1234567 (null ถ้าไม่ใช่ตัวเลข) */
function parsePrice(raw) {
  if (raw === null || raw === undefined) return null;
  var cleaned = String(raw).replace(/[, ]/g, "").trim();
  if (cleaned === "") return null;
  var n = Number(cleaned);
  return isFinite(n) ? n : null;
}

/** แปลงค่าในคอลัมน์ เดือน เป็นข้อความ "d MMM yyyy" (รองรับทั้ง Date และ string) */
function formatMonth(v, tz) {
  if (v instanceof Date) {
    var parts = Utilities.formatDate(v, tz, "yyyy-M-d").split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    if (USE_BUDDHIST_YEAR) year += 543;
    return day + " " + THAI_MONTHS[month - 1] + " " + year;
  }
  return cell(v);
}

/** "19 ก.ย. 2025" -> "ก.ย. 2025" (ไว้จัดกลุ่มรายเดือน) */
function monthKeyOf(dateText) {
  var m = String(dateText).match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (m) return m[2] + " " + m[3];
  return String(dateText) || "(ไม่มีข้อมูล)";
}

/** ลำดับเวลาของเดือน (2025*12 + index) ใช้เรียงเดือนตามปฏิทิน */
function monthOrderOf(dateText) {
  var m = String(dateText).match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (m) {
    var idx = THAI_MONTHS.indexOf(m[2]);
    var year = Number(m[3]);
    if (idx >= 0 && isFinite(year)) return year * 12 + idx;
  }
  return Number.MAX_SAFE_INTEGER;
}
