import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// one row from the Google Sheet: เลขทะเบียนคุม / เดือน / กลุ่มภารกิจ / กลุ่มงาน / หน่วยงาน / รายการ / หมวด / ประเภท / ราคาเสนอ / ประเภทแผน
export const sheetRowValidator = v.object({
  regNo: v.string(), // เลขทะเบียนคุม (column A)
  date: v.string(), // เดือน raw value, e.g. "19 ก.ย. 2025" (column B)
  monthKey: v.string(), // normalized month, e.g. "ก.ย. 2025"
  monthOrder: v.number(), // chronological sort key for monthKey
  mission: v.string(), // กลุ่มภารกิจ (column C)
  workGroup: v.string(), // กลุ่มงาน (column D)
  agency: v.string(), // หน่วยงาน (column E)
  item: v.string(), // รายการ (column F)
  category: v.string(), // หมวด (column G)
  type: v.string(), // ประเภท (column H)
  price: v.number(), // ราคาเสนอ (column I)
  planType: v.string(), // ประเภทแผน (column J)
  status: v.string(), // สถานะ (column K): เสนอ / อนุมัติ / ไม่อนุมัติ / รอปรับแผน
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // cached rows parsed from the public Google Sheet ("sheet99")
    sheetChunk: defineTable({
      chunkIndex: v.number(),
      rows: v.array(sheetRowValidator),
    }),

    // single metadata doc describing the last successful sync
    sheetMeta: defineTable({
      syncedAt: v.number(),
      rowCount: v.number(),
    }),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
