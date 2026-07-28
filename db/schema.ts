import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const customMetrics = sqliteTable("custom_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  value: text("value").notNull(),
  target: text("target").notNull().default(""),
  unit: text("unit").notNull().default(""),
  owner: text("owner").notNull().default(""),
  trend: text("trend").notNull().default("flat"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  contact: text("contact").notNull().default(""),
  status: text("status").notNull().default("revision"),
  score: real("score").notNull().default(0),
  nextDelivery: text("next_delivery").notNull().default(""),
  amount: text("amount").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const agentLogs = sqliteTable("agent_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  mode: text("mode").notNull(),
  promptVersion: text("prompt_version").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

