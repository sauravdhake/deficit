import { pgTable, integer, text, timestamp, serial, unique } from "drizzle-orm/pg-core";

export const hrCommentsTable = pgTable(
  "hr_comments",
  {
    id: serial("id").primaryKey(),
    emp_id: integer("emp_id").notNull(),
    comment: text("comment").notNull().default(""),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique("hr_comments_emp_id_unique").on(table.emp_id)]
);

export type HrComment = typeof hrCommentsTable.$inferSelect;
export type InsertHrComment = typeof hrCommentsTable.$inferInsert;
