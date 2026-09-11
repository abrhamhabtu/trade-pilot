import test from 'node:test';
import assert from 'node:assert/strict';
import { disciplineScenario, pressurePath } from '../src/lib/discipline.ts';
import { SESSION_INSTRUMENTS, sizeSession, localSessionDate } from '../src/lib/sessionRisk.ts';
const p = { contracts:3, stop:30, pointValue:2, tick:0.25, fees:2, slippageTicks:1, accounts:3, cushion:2000, winRate:45, reward:1.5, trades:2, split:90, goal:3000 };

test('whole contract comparison scales costs and risk consistently', () => {
  const full=disciplineScenario(p), small=disciplineScenario(p,1);
  assert.equal(full.loss,187.5);
  assert.equal(full.copiedLoss,562.5);
  assert.equal(small.loss,62.5);
  assert.ok(small.losses>full.losses);
  assert.ok(small.sessions>full.sessions);
  assert.equal(disciplineScenario(p,1.5),null);
});
test('negative edge and zero split do not claim a goal date', () => {
  assert.equal(disciplineScenario({...p,winRate:10}).sessions,null);
  assert.ok(disciplineScenario({...p,winRate:10}).cycle<0);
  assert.equal(disciplineScenario({...p,split:0}).sessions,null);
  assert.equal(disciplineScenario({...p,fees:-1}),null);
});
test('boundary is exclusive and breach cannot recover in stress walkthrough', () => {
  assert.equal(disciplineScenario({...p,contracts:1,fees:0,slippageTicks:0,cushion:120}).losses,1);
  assert.deepEqual(pressurePath(100,50,100,0,[-1,0,-1,1]),[100,50,50,0,0]);
});
test('gold and bitcoin use correct dollar multipliers and round stops up', () => {
  const gold=disciplineScenario({...p,contracts:1,stop:5.01,...SESSION_INSTRUMENTS.MGC});
  assert.equal(gold.stop,5.1);
  assert.ok(Math.abs(gold.loss-54)<1e-8);
  const btc=disciplineScenario({...p,contracts:1,stop:501,...SESSION_INSTRUMENTS.MBT});
  assert.equal(btc.stop,505);
  assert.equal(btc.loss,53);
  assert.equal(btc.copiedLoss,159);
});
test('session planner also sizes MGC and MBT; zero affordable contracts means skip', () => {
  const now=new Date(2026,8,8,9,0);
  const riskSnapshot={cushion:1000,dailyRemaining:200,personalDailyLimit:200,reserve:500,contractCap:3,nextRequirement:'Check firm',confirmedAt:now.toISOString()};
  const account={id:'one',name:'One',status:'active',riskSnapshot};
  const plan={symbol:'MGC',stopPoints:5,risk:100,fees:2,slippagePoints:0.1,maxTrades:2,completedTrades:0,date:localSessionDate(now),finishTime:'11:00',setup:'Retest'};
  assert.equal(sizeSession(plan,[account],now).contracts,1);
  assert.equal(sizeSession({...plan,symbol:'MBT',stopPoints:500,slippagePoints:5},[account],now).perContract,52.5);
  assert.equal(sizeSession({...plan,symbol:'MBT',stopPoints:500,slippagePoints:5,risk:50},[account],now).contracts,0);
});
