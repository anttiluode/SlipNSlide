import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/prng.js';
import { CONFIG } from '../src/config.js';
import { createController, cloneController, flattenController, applyFlatDelta } from '../src/controller.js';
import { functionalEffectVector, functionalCoherence, representativeResidual } from '../src/functional.js';

test('functional effect vector uses stable canonical G then I response coordinates', () => {
  const base=createController(makeRng(101));
  const full=cloneController(base);
  const delta=new Float64Array(flattenController(base).length);
  delta[delta.length-1]=0.35;
  applyFlatDelta(full,delta,1);
  const steps=18;
  const effect=functionalEffectVector(base,full,{steps});
  assert.equal(effect.length,2*steps*(CONFIG.hiddenSize+3));
  assert.ok(effect.some(x=>Math.abs(x)>1e-12));
  assert.ok(effect.every(Number.isFinite));
});

test('functional coherence is high for aligned effects and low for sign-conflicting effects', () => {
  const aligned=[Float64Array.from([1,2,0]),Float64Array.from([2,4,.01]),Float64Array.from([.5,1,-.01])];
  const conflicting=[Float64Array.from([1,0]),Float64Array.from([-1,0]),Float64Array.from([0,1])];
  assert.ok(functionalCoherence(aligned)>0.99);
  assert.ok(functionalCoherence(conflicting)<0.2);
});

test('representative residual selects an actual proposal near the normalized functional centroid', () => {
  const entries=[
    {eventIndex:5,effect:Float64Array.from([1,0]),residual:Float64Array.from([10,0])},
    {eventIndex:6,effect:Float64Array.from([.8,.6]),residual:Float64Array.from([0,20])},
    {eventIndex:7,effect:Float64Array.from([.98,.2]),residual:Float64Array.from([30,30])}
  ];
  const picked=representativeResidual(entries);
  assert.equal(picked.eventIndex,7);
  assert.deepEqual(Array.from(picked.residual),[30,30]);
  assert.ok(picked.similarity>0.98);
});

test('representative residual never averages parameter vectors', () => {
  const a=Float64Array.from([1,0,0]);
  const b=Float64Array.from([0,2,0]);
  const picked=representativeResidual([
    {eventIndex:1,effect:Float64Array.from([1,0]),residual:a},
    {eventIndex:2,effect:Float64Array.from([1,.01]),residual:b}
  ]);
  const out=Array.from(picked.residual);
  assert.ok(out.every((x,i)=>x===a[i]) || out.every((x,i)=>x===b[i]));
});
