import mysql from "mysql2/promise";

const host = process.env.DB_360_HOST;
const database = process.env.DB_360_NAME;
const user = process.env.DB_360_USER;
const password = process.env.DB_360_PASS;

if (!host || !database || !user || !password) {
  throw new Error(
    "Missing required environment variables: DB_360_HOST, DB_360_NAME, DB_360_USER, DB_360_PASS"
  );
}

export const db360 = mysql.createPool({
  host,
  database,
  user,
  password,
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 10000,
});

// Enforce read-only at the session level on every new connection
db360.on("connection", (conn) => {
  conn.query("SET SESSION TRANSACTION READ ONLY");
});

type Primitive = string | number | boolean | null | bigint | Date | Buffer;
type SqlValues = Primitive | Primitive[] | Record<string, Primitive> | undefined;

export async function query360<T = unknown>(
  sql: string,
  params?: SqlValues
): Promise<T[]> {
  const [rows] = await db360.execute(sql, params as never);
  return rows as T[];
}

export async function query360Raw<T = unknown>(
  sql: string,
  params?: SqlValues
): Promise<T[]> {
  const [rows] = await db360.query(sql, params as never);
  return rows as T[];
}
