require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {splitNutrition}=require('../services/meals/portions.ts');
const plan={householdSize:2,planningDays:3,targetCalories:10500,targetProtein:750,
 participants:[{id:'me',name:'You',dailyCalories:1500,proteinTarget:100},
 {id:'partner',name:'Partner',dailyCalories:2000,proteinTarget:150}]};

test('unequal meal portions conserve nutrition and keep protein proportional to food',()=>{
 const rows=splitNutrition(plan,{calories:700,protein:49});
 assert.equal(rows[0].calories,300);assert.equal(rows[1].calories,400);
 assert.equal(rows[0].protein,21);assert.equal(rows[1].protein,28);
 assert.equal(rows[0].proteinTarget,100);assert.equal(rows[1].proteinTarget,150);
 assert.equal(rows.reduce((n,p)=>n+p.share,0),1);
});
test('summary divides all planned nutrition by days and preserves participant names',()=>{
 const rows=splitNutrition(plan,{calories:10500,protein:735},3);
 assert.deepEqual(rows.map(p=>[p.name,p.calories,p.protein]),[['You',1500,105],['Partner',2000,140]]);
});
test('legacy shared plans use equal portions and single-person plans retain all nutrition',()=>{
 const legacy={...plan,participants:undefined};
 assert.deepEqual(splitNutrition(legacy,{calories:700,protein:50}).map(p=>p.calories),[350,350]);
 const single={...legacy,householdSize:1};
 assert.equal(splitNutrition(single,{calories:700,protein:50})[0].protein,50);
});
