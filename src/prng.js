function mixSeed(seed) {
  let x = (Number(seed) | 0) ^ 0x9e3779b9;
  x ^= x >>> 16; x = Math.imul(x, 0x21f0aaad);
  x ^= x >>> 15; x = Math.imul(x, 0x735a2d97);
  x ^= x >>> 15;
  return (x >>> 0) || 0x6d2b79f5;
}

export function makeRng(seed = 1) {
  let s = mixSeed(seed);
  let spare = null;
  return {
    next() {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 0x100000000;
    },
    normal() {
      if (spare !== null) { const z = spare; spare = null; return z; }
      let u = 0, v = 0;
      while (u <= Number.EPSILON) u = this.next();
      v = this.next();
      const mag = Math.sqrt(-2 * Math.log(u));
      const a = 2 * Math.PI * v;
      spare = mag * Math.sin(a);
      return mag * Math.cos(a);
    },
    state() { return s >>> 0; }
  };
}

export function deriveSeed(...parts) {
  let h = 2166136261 >>> 0;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  return h >>> 0;
}
