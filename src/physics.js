import { CONFIG } from './config.js';

export function terrainParams(kind) {
  const t = CONFIG.terrains[kind];
  if (!t) throw new Error(`Unknown terrain: ${kind}`);
  return t;
}

export function initialState() {
  return {x: 0, v: 0, omega: 0, phi: 0, uPrev: 0};
}

export function slipRatio(state) {
  const wheelV = state.omega * CONFIG.wheelRadius;
  const denom = Math.max(0.35, Math.abs(state.v) + 0.35);
  return (wheelV - state.v) / denom;
}

export function observe(state, targetV = CONFIG.targetV) {
  const slip = slipRatio(state);
  return [
    Math.max(-2, Math.min(2, targetV - state.v)),
    Math.max(-2, Math.min(2, state.v)),
    Math.max(-1, Math.min(1, slip / 3)),
    Math.max(-1, Math.min(1, state.uPrev)),
    Math.max(-1, Math.min(1, state.phi))
  ];
}

export function tractionForce(slip, terrain) {
  const sign = Math.sign(slip);
  const x = Math.abs(slip) / Math.max(1e-9, terrain.peakSlip);
  if (x === 0) return 0;
  const curve = x * Math.exp(1 - x);
  return sign * terrain.maxTraction * curve;
}

export function stepPhysics(state, u, terrainKind, dt = CONFIG.dt) {
  const terrain = terrainParams(terrainKind);
  const command = Math.max(-1, Math.min(1, u));
  const motorTorque = CONFIG.maxTorque * command;
  const slip0 = slipRatio(state);
  const traction = tractionForce(slip0, terrain);
  const drag = CONFIG.bodyDrag * state.v * Math.abs(state.v);
  const accel = (traction - drag) / CONFIG.mass;
  const v = Math.max(-0.5, state.v + accel * dt);
  const x = state.x + v * dt;
  const reactionTorque = traction * CONFIG.wheelRadius;
  const omegaDot = (motorTorque - reactionTorque - CONFIG.wheelDamping * state.omega) / CONFIG.wheelInertia;
  const omega = Math.max(-40, Math.min(40, state.omega + omegaDot * dt));
  const phi = CONFIG.pitchDecay * state.phi + CONFIG.pitchGain * accel;
  const next = {x, v, omega, phi, uPrev: command};
  const slip = slipRatio(next);
  return {state: next, slip, traction, energy: command * command, accel};
}

export function stepReward(state, u, diagnostics) {
  const w = CONFIG.reward;
  const err = CONFIG.targetV - state.v;
  return 1
    - w.tracking * err * err
    + w.progress * state.v
    - w.slip * Math.abs(diagnostics.slip)
    - w.energy * u * u
    - w.stability * state.phi * state.phi;
}

export function rolloutOpenLoop(commands, terrainKind) {
  let state = initialState();
  let reward = 0, slip = 0, energy = 0;
  const trace = [];
  for (const u of commands) {
    const out = stepPhysics(state, u, terrainKind, CONFIG.dt);
    state = out.state;
    const r = stepReward(state, u, out);
    reward += r; slip += Math.abs(out.slip); energy += out.energy;
    trace.push([state.x, state.v, state.omega, state.phi, u, out.slip, out.traction, r]);
  }
  const n = Math.max(1, commands.length);
  return {reward: reward / n, meanSlip: slip / n, meanEnergy: energy / n, finalState: state, trace};
}
