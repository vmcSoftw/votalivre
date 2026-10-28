import postgres from 'postgres';
let client;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
  if (!client) {
    const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
    client = postgres(process.env.DATABASE_URL, {
      max: 3, idle_timeout: 15, connect_timeout: 10,
      ssl: local ? false : 'require', prepare: false
    });
  }
  return client;
}
