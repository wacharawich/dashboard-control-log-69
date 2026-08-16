/******************************************************************************
 * ราคาเสนอ · Terminal Dashboard — Google Apps Script (backend)
 * ---------------------------------------------------------------------------
 * วิธีใช้งาน:
 *   1) เปิด https://script.google.com → สร้างโปรเจกต์ใหม่ (หรือเปิดโปรเจกต์เดิม)
 *   2) วางโค้ดนี้แทนที่เนื้อหาเดิมในไฟล์ "Code.gs"
 *   3) ไปที่ ไฟล์ > New > HTML → ตั้งชื่อไฟล์ว่า "index" → วางเนื้อหาจาก index.html
 *   4) Deploy > New deployment > Web app
 *        - Execute as : Me
 *        - Who has access : Anyone (หรือ Anyone with Google account)
 *   5) เปิด URL ที่ได้จากขั้นตอนที่ 4
 *
 *  หมายเหตุ: บัญชี Google ที่ใช้ deploy ต้องเข้าถึง Spreadsheet นี้ได้
 *  (ถ้าเป็นเจ้าของชีตอยู่แล้วก็ใช้ได้เลย — ถ้าไม่ใช่ ต้องกด Share ให้บัญชีนั้น)
 ******************************************************************************/

var SHEET_ID = '1UtSyrAUOXdtRiztXbN4ntobPeS0fMErUrAIeK4NRxcw';
var SHEET_NAME = 'sheet99';

/**
 * หน้าเว็บแอป — เสิร์ฟ index.html เป็น Web App
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ราคาเสนอ · Terminal Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * อ่านข้อมูลทั้งหมดจาก Sheet (คอลัมน์ A–J) แล้วคืนเป็น JSON ให้ฝั่ง client
 *  คอลัมน์: A=เลขทะเบียนคุม B=เดือน C=กลุ่มภารกิจ D=กลุ่มงาน E=หน่วยงาน
 *           F=รายการ G=หมวด H=ประเภท I=ราคาเสนอ J=ประเภทแผน
 */
function getSheetData() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error('ไม่พบชีต "' + SHEET_NAME + '" ใน Spreadsheet ' + SHEET_ID);
    }
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      throw new Error('ชีตไม่มีข้อมูล (ต้องมีแถวหัวตารางอย่างน้อย 1 แถว)');
    }

    var rows = [];
    for (var i = 1; i < values.length; i++) {
      var r = values[i];
      var price = parsePrice(r[8]); // คอลัมน์ I
      if (price === null) continue; // ข้ามแถวที่ไม่มีราคา
      rows.push({
        regNo: clean(r[0]),     // เลขทะเบียนคุม
        month: clean(r[1]),     // เดือน
        mission: clean(r[2]),   // กลุ่มภารกิจ
        workGroup: clean(r[3]), // กลุ่มงาน
        agency: clean(r[4]),    // หน่วยงาน
        item: clean(r[5]),      // รายการ
        category: clean(r[6]),  // หมวด
        type: clean(r[7]),      // ประเภท
        price: price,           // ราคาเสนอ (number)
        planType: clean(r[9]) || 'ไม่ระบุ' // ประเภทแผน (คอลัมน์ J)
      });
    }

    return {
      ok: true,
      rows: rows,
      count: rows.length,
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

function clean(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

/**
 * แปลงค่าจากชีตเป็นตัวเลข — รองรับทั้ง number, "300,000.00", "฿ 12,500", "1,200.50 บาท"
 * คืน null ถ้าแปลงไม่ได้ (แถวนั้นจะถูกข้ามไป)
 */
function parsePrice(v) {
  if (typeof v === 'number') {
    return isFinite(v) ? v : null;
  }
  if (typeof v === 'string') {
    var n = parseFloat(v.replace(/[^\d.-]/g, ''));
    return isFinite(n) ? n : null;
  }
  return null;
}
