// Plain ESM consumer: imports the built package through its own name
// (package self-reference through the "exports" map).
const mod = await import("encedo-hem-js-api");
process.stdout.write(JSON.stringify(Object.keys(mod).sort()));
