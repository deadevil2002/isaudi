export type BusinessApiStatement = {
  bind(...values: unknown[]): BusinessApiStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success?: boolean; meta?: { changes?: number } }>;
};

export type BusinessApiD1 = {
  prepare(sql: string): BusinessApiStatement;
  batch(statements: BusinessApiStatement[]): Promise<unknown[]>;
};
