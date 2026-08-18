/**
 * ราคาเสนอ/terminal — Google Apps Script backend
 *
 * ไฟล์นี้ทำหน้าที่ 2 อย่าง:
 * 1. doGet() เสิร์ฟหน้าเว็บ dashboard (ไฟล์ HTML ชื่อ "index")
 * 2. เขียน/อ่านข้อมูลจาก Google Sheet "sheet99" (คอลัมน์ A–K)
 *    - getSheetData()  อ่านข้อมูลทั้งหมดให้หน้าเว็บ
 *    - updateStatus()  อัปเดตสถานะ (คอลัมน์ K) เรียกจากหน้าเว็บผ่าน google.script.run
 *    - doPost()        รับ JSON { regNo, status } จากเว็บแอปหลัก (Convex action
 *                      ของโปรเจกต์ "ราคาเสนอ/terminal") เพื่อเขียนสถานะลงชีต
 *
 * คอลัมน์ของชีต:
 *   A เลขทะเบียนคุม · B เดือน · C กลุ่มภารกิจ · D กลุ่มงาน · E หน่วยงาน ·
 *   F รายการ · G หมวด · H ประเภท · I ราคาเสนอ · J ประเภทแผน · K สถานะ
 */

var SHEET_ID = "1UtSyrAUOXdtRiztXbN4ntobPeS0fMErUrAIeK4NRxcw";
var SHEET_NAME = "sheet99";

/** ค่าที่อนุญาตสำหรับคอลัมน์ K สถานะ (ต้องตรงกับ Dropdown ในชีต) */
var STATUS_OPTIONS = ["เสนอ", "อนุมัติ", "ไม่อนุมัติ", "รอปรับแผน"];

var THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/**
 * เสิร์ฟหน้าเว็บ dashboard (ต้องมีไฟล์ HTML ชื่อ "index")
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("ราคาเสนอ/terminal — ข้อมูลราคาเสนอ")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * อ่านข้อมูลทั้งหมดจากชีต (คอลัมน์ A–K) แล้วคืนเป็น JSON ให้หน้าเว็บ
 */
function getSheetData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('ไม่พบชีตชื่อ "' + SHEET_NAME + '" ใน Spreadsheet นี้');
  }
  var values = sheet.getDataRange().getValues();
  var rows = [];
  var start = values.length > 0 && String(values[0][0]).trim() === "เลขทะเบียนคุม" ? 1 : 0;
  for (var i = start; i < values.length; i++) {
    var c = values[i];
    var price = parsePrice(c[8]);
    if (price === null) continue; // ข้ามแถวที่ไม่มีราคาเสนอ
    var month = normalizeMonth(String(c[1] == null ? "" : c[1]));
    rows.push({
      regNo: String(c[0] == null ? "" : c[0]).trim(),
      date: String(c[1] == null ? "" : c[1]).trim(),
      monthKey: month.monthKey,
      monthOrder: month.monthOrder,
      mission: String(c[2] == null ? "" : c[2]).trim(),
      workGroup: String(c[3] == null ? "" : c[3]).trim(),
      agency: String(c[4] == null ? "" : c[4]).trim(),
      item: String(c[5] == null ? "" : c[5]).trim(),
      category: String(c[6] == null ? "" : c[6]).trim(),
      type: String(c[7] == null ? "" : c[7]).trim(),
      price: price,
      planType: String(c[9] == null ? "" : c[9]).trim(), // ประเภทแผน (column J)
      status: String(c[10] == null ? "" : c[10]).trim(), // สถานะ (column K)
    });
  }
  return { rows: rows, syncedAt: new Date().toISOString(), rowCount: rows.length };
}

/**
 * อัปเดตสถานะ (คอลัมน์ K) — เรียกจากหน้าเว็บ standalone ผ่าน google.script.run
 */
function updateStatus(regNo, status) {
  if (!regNo || String(regNo).trim() === "") {
    throw new Error("ไม่พบเลขทะเบียนคุมของรายการนี้");
  }
  if (STATUS_OPTIONS.indexOf(status) === -1) {
    throw new Error('สถานะ "' + status + '" ไม่ถูกต้อง (ต้องเป็น ' + STATUS_OPTIONS.join(" / ") + ")");
  }
  writeStatusToSheet(String(regNo).trim(), status);
  return { ok: true, regNo: String(regNo).trim(), status: status };
}

/**
 * Webhook — รับ JSON { regNo, status } จากเว็บแอปหลัก (Convex action updateStatus
 * ในโปรเจกต์ React) แล้วเขียนสถานะลงชีต
 *
 * ตั้งค่าในโปรเจกต์หลัก: Deploy > New deployment > Web app แล้ววาง URL ที่ได้
 * ไว้ในหน้า Keys/API keys ของ Freebuff (ชื่อคีย์ APPS_SCRIPT_WEB_APP_URL)
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var regNo = String(body.regNo == null ? "" : body.regNo).trim();
    var status = String(body.status == null ? "" : body.status).trim();
    if (regNo === "") {
      return jsonResponse({ ok: false, error: "ไม่พบเลขทะเบียนคุมของรายการนี้" }, 400);
    }
    if (STATUS_OPTIONS.indexOf(status) === -1) {
      return jsonResponse(
        { ok: false, error: 'สถานะ "' + status + '" ไม่ถูกต้อง (ต้องเป็น ' + STATUS_OPTIONS.join(" / ") + ")" },
        400,
      );
    }
    var updated = writeStatusToSheet(regNo, status);
    if (!updated) {
      return jsonResponse({ ok: false, error: 'ไม่พบเลขทะเบียนคุม "' + regNo + '" ในชีต' }, 404);
    }
    return jsonResponse({ ok: true, regNo: regNo, status: status }, 200);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

/** เขียนสถานะลงคอลัมน์ K ของแถวที่เลขทะเบียนคุม (คอลัมน์ A) ตรงกัน */
function writeStatusToSheet(regNo, status) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === regNo) {
      sheet.getRange(i + 1, 11).setValue(status); // column K
      return true;
    }
  }
  return false;
}

function jsonResponse(obj, code) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** แปลง "19 ก.ย. 2025" / "ก.ย. 2025" -> { monthKey, monthOrder } */
function normalizeMonth(raw) {
  var text = String(raw).trim();
  var m = text.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (m) {
    var idx = THAI_MONTHS.indexOf(m[2]);
    var year = Number(m[3]);
    if (idx >= 0 && isFinite(year)) {
      return { monthKey: m[2] + " " + year, monthOrder: year * 12 + idx };
    }
  }
  m = text.match(/^(\S+)\s+(\d{4})$/);
  if (m) {
    var idx2 = THAI_MONTHS.indexOf(m[1]);
    var year2 = Number(m[2]);
    if (idx2 >= 0 && isFinite(year2)) {
      return { monthKey: m[1] + " " + year2, monthOrder: year2 * 12 + idx2 };
    }
  }
  return { monthKey: text === "" ? "(ไม่มีข้อมูล)" : text, monthOrder: Number.MAX_SAFE_INTEGER };
}

/** แปลงราคา: ตัด , และเว้นวรรคออกแล้วแปลงเป็นตัวเลข */
function parsePrice(raw) {
  var cleaned = String(raw == null ? "" : raw).replace(/[, ]/g, "").trim();
  if (cleaned === "") return null;
  var n = Number(cleaned);
  return isFinite(n) ? n : null;
}
