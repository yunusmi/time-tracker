export interface AppConfig {
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'super-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'time_tracker',
  },
});
