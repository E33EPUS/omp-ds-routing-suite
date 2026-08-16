/**
 * core.test.mjs — unit tests for the routing logic (node --test).
 * Run: node --test tests/
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MODE_MIXED, MODE_REACT, MODE_SPEC, MODE_WEAK,
  bandFor, bandOf, classifyTask, coreFor, guideFor,
  isChatTask, isComplexTask, isFlashModel, parseMode, personaFor,
} from '../core.ts'
import { classifyFirst } from '../state.ts'

test('classifyTask: react keywords win', () => {
  assert.equal(classifyTask('写一个网页游戏'), 'react')
  assert.equal(classifyTask('build a new project from scratch'), 'react')
  assert.equal(classifyTask('帮我创建一个 python 脚本'), 'react')
})

test('classifyTask: spec keywords win', () => {
  assert.equal(classifyTask('修复这个报错'), 'spec')
  assert.equal(classifyTask('debug the crash and fix it'), 'spec')
  assert.equal(classifyTask('排查为什么崩溃'), 'spec')
})

test('classifyTask: ambiguous or empty -> weak', () => {
  assert.equal(classifyTask(null), 'weak')
  assert.equal(classifyTask('   '), 'weak')
  assert.equal(classifyTask('看看这个'), 'weak')
  assert.equal(classifyTask('解释一下这段代码'), 'weak')
})

test('isComplexTask: length and architecture keywords', () => {
  assert.equal(isComplexTask('x'.repeat(121)), true)
  assert.equal(isComplexTask('设计一个系统的架构'), true)
  assert.equal(isComplexTask('refactor the module for maintainability'), true)
  assert.equal(isComplexTask('改个变量名'), false)
  assert.equal(isComplexTask(null), false)
})

test('isChatTask: greetings only', () => {
  assert.equal(isChatTask('你好'), true)
  assert.equal(isChatTask('hello'), true)
  assert.equal(isChatTask('谢谢'), true)
  assert.equal(isChatTask('你好，帮我修个bug'), false)
  assert.equal(isChatTask(''), false)
})

test('isFlashModel', () => {
  assert.equal(isFlashModel('deepseek-v4-flash'), true)
  assert.equal(isFlashModel('deepseek-v4-pro'), false)
  assert.equal(isFlashModel(null), false)
})

test('personaFor: weak is model-specific', () => {
  const flash = personaFor(MODE_WEAK, 'deepseek-v4-flash')
  const pro = personaFor(MODE_WEAK, 'deepseek-v4-pro')
  assert.notEqual(flash, pro)
  assert.match(flash, /Think deeply first/)
  assert.match(flash, /review what you have already done/) // session anchors
  assert.doesNotMatch(pro, /Think deeply first/)
})

test('personaFor: spec/react are fixed texts', () => {
  assert.equal(personaFor(MODE_SPEC, 'deepseek-v4-flash'), personaFor(MODE_SPEC, 'deepseek-v4-pro'))
  assert.equal(personaFor(MODE_REACT, 'deepseek-v4-flash'), personaFor(MODE_REACT, 'deepseek-v4-pro'))
})

test('guideFor: round 1-2 base, round 3+ boost', () => {
  const text = '帮我修个 bug'
  const g1 = guideFor(1, text, 'deepseek-v4-flash')
  const g3 = guideFor(3, text, 'deepseek-v4-flash')
  assert.match(g1 ?? '', /classify this task/)
  assert.match(g3 ?? '', /NEW task/)
  assert.doesNotMatch(g3 ?? '', /classify this task \(build or fix\) now/)
})

test('guideFor: simple tasks get commit tail, complex get deep tail', () => {
  const simple = guideFor(1, '改个变量名', 'deepseek-v4-flash') ?? ''
  const complex = guideFor(1, '设计一个系统的架构并详细实现', 'deepseek-v4-flash') ?? ''
  assert.match(simple, /commit and act/)
  assert.doesNotMatch(simple, /architecture, edge cases/)
  assert.match(complex, /architecture, edge cases/)
  assert.doesNotMatch(complex, /commit and act/)
})

test('guideFor: closure tail only for non-Flash', () => {
  const flash = guideFor(1, '设计一个系统架构', 'deepseek-v4-flash') ?? ''
  const pro = guideFor(1, '设计一个系统架构', 'deepseek-v4-pro') ?? ''
  assert.doesNotMatch(flash, /End each reasoning block/)
  assert.match(pro, /End each reasoning block/)
})

test('guideFor: chat and empty text get no guidance', () => {
  assert.equal(guideFor(1, '你好', 'deepseek-v4-flash'), null)
  assert.equal(guideFor(1, '', 'deepseek-v4-flash'), null)
  assert.equal(guideFor(1, '修个bug', 'deepseek-v4-flash', false), null) // disabled
})

test('parseMode: names, numbers, auto, invalid', () => {
  assert.equal(parseMode('weak'), MODE_WEAK)
  assert.equal(parseMode('spec'), MODE_SPEC)
  assert.equal(parseMode('react'), MODE_REACT)
  assert.equal(parseMode('mixed'), MODE_MIXED)
  assert.equal(parseMode('auto'), 'auto')
  assert.equal(parseMode('50'), 0.5)
  assert.equal(parseMode('0.3'), 0.3)
  assert.equal(parseMode('0'), 0)
  assert.equal(parseMode('100'), 1)
  assert.equal(parseMode('banana'), null)
  assert.equal(parseMode(null), null)
})

test('bandOf: quantization to the three bands', () => {
  assert.equal(bandOf(0), 'spec')
  assert.equal(bandOf(0.19), 'spec')
  assert.equal(bandOf(0.2), 'mixed')
  assert.equal(bandOf(0.49), 'mixed')
  assert.equal(bandOf(0.5), 'react')
  assert.equal(bandOf(1), 'react')
  assert.equal(bandOf(MODE_WEAK), 'weak')
})

test('bandFor: transition band is labeled a trap', () => {
  assert.match(bandFor(0.3), /trap/)
  assert.equal(bandFor(0), 'spec')
  assert.equal(bandFor(1), 'react')
})

test('coreFor: weak gets RL-shape surface (bash + edit)', () => {
  assert.deepEqual(coreFor(MODE_WEAK), ['bash', 'edit'])
  assert.deepEqual(coreFor(MODE_SPEC), ['bash', 'read', 'edit', 'glob', 'grep'])
  assert.deepEqual(coreFor(MODE_REACT), ['bash', 'read', 'write', 'edit'])
})

test('classifyFirst: react/spec/empty -> weak', () => {
  assert.equal(classifyFirst('写一个游戏'), 1)
  assert.equal(classifyFirst('修复报错'), 0)
  assert.equal(classifyFirst(null), 'weak')
  assert.equal(classifyFirst('看看这个'), 'weak')
})
