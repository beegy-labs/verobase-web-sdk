declare module "rrweb" {
  export function record(options: Record<string, unknown>): (() => void) | undefined;
}
