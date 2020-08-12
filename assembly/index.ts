// The entry file of your WebAssembly module.

export const u32ArrayId = idof<u32[]>();

export function add(a: i32, b: i32): i32 {
  return a + b;
}

