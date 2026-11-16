const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
// The adapter keeps source rows intact, so tests use a minimal sheet transport.
const elements = {};
const context = vm.createContext({ console, Date, document: { querySelector(id) {
  return elements[id] ||= { value: '', addEventListener() {} };
}}, XLSX: { utils: {
  sheet_to_json: sheet => sheet,
  aoa_to_sheet: rows => rows,
  encode_col: col => String.fromCharCode(65 + col),
}}});
vm.runInContext(fs.readFileSync(__dirname + '/app.js', 'utf8'), context);
const run = code => vm.runInContext(code, context);
const fixture = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
context.daily = { SheetNames: Object.keys(fixture.daily), Sheets: fixture.daily };
context.legacy = { SheetNames: ['Sheet1'], Sheets: { Sheet1: fixture.legacy } };
const actual = run('parseZeniel(daily, null, "2026-11")');
for (const [store, amount] of Object.entries(fixture.expected)) {
  assert.ok(Math.abs(actual.ceByStore[store] - amount) < 0.01, store);
}
assert.equal(actual.stats.dateCols, 15);
assert.equal(actual.stats.firstDate, '2026-11-01');
assert.equal(actual.stats.lastDate, '2026-11-15');
assert.deepEqual(Object.keys(actual.stats.unknownStores), []);
assert.throws(() => run('parseZeniel(daily, null, "2026-10")'), /날짜 시트/);
const old = run('parseZeniel(legacy, null, "2026-11")');
assert.equal(old.stats.dateCols, 15);
for (const cat of ['스마트폰','태블릿','노트북','PC','웨어러벌','웨어러블','버즈','모바일 액세서리']) {
  context.category = cat;
  assert.equal(run('isZenielMxCategory(category)'), true, cat);
}
assert.equal(run('isZenielMxCategory("TV")'), false);
// Verify monthly selection, negative sales, original store ownership, and exclusion
// even when excluded-category values are large or alternate metrics disagree.
context.synthetic = { SheetNames: ['1101','1201'], Sheets: {
  '1101': [fixture.daily['1101'][2], ['코스트코','0006055100_양재점','TV','','','','TV123',2,8,-100,9999,99999],
    ['코스트코','양재점','버즈','','','','BUDS123',1,1,123456,0,0],
    ['전자랜드','양재점','TV','','','','TV123',1,1,999999,0,0]],
  '1201': [fixture.daily['1101'][2], ['코스트코','양재점','TV','','','','TV123',1,1,200,0,0]],
}};
assert.equal(run('parseZeniel(synthetic, null, "2026-11").ceByStore["양재점"]'), -100);
assert.equal(run('parseZeniel(synthetic, null, "2026-12").ceByStore["양재점"]'), 200);
assert.equal(run('MANAGER_BY_STORE["양재점"]'), '조재현');
context.synthetic.Sheets['1101'].push(['코스트코','양재점','에어컨','','','','TEST123',2,999,600,99999,99999]);
context.lookup = { modelToGroups: { TEST123: { '창문형 에어컨': true } } };
const aircon = run('parseZeniel(synthetic, lookup, "2026-11").airconModelGroupByStore["양재점"]["창문형 에어컨"]');
assert.equal(aircon.qty, 2);
assert.equal(aircon.amount, 600);
// Monthly goal files retain the existing CC / CE / MX import behavior.
context.goal = { SheetNames: ['매장별 목표'], Sheets: { '매장별 목표': [
  ['채널','점포','목표계','CE','MX'], ['CC','양재점',300,100,200],
  ['다른채널','광명점',999,999,999],
]}};
assert.equal(run('parseGoal(goal).goals["양재점"].total'), 300);
assert.equal(run('parseGoal(goal).goals["광명점"].total'), 0);
console.log(JSON.stringify({ result:'PASS', days:actual.stats.dateCols,
  totalWon:Object.values(actual.ceByStore).reduce((a,b)=>a+b,0),
  excluded:actual.stats.excludedCategories, unmapped:actual.stats.unknownStores }));

