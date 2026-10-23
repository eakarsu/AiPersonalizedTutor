'use strict';
// Offline only: unset provider keys before importing app code.
delete process.env.OPENROUTER_API_KEY; delete process.env.OPENAI_API_KEY; delete process.env.DATABASE_URL;
const test=require('node:test'); const assert=require('node:assert/strict');
const express=require('express');
const {createRouter,createStore,toCsv,toSections}=require('./src/routes/featurePack');
function fakeAuth(req,res,next){const id=req.headers['x-user']; if(!id) return res.status(401).json({error:'authentication required'}); req.user={id}; next();}
async function withServer(fn){const app=express(); app.use(express.json()); app.use('/api/tasks',createRouter({authenticate:fakeAuth,store:createStore()})); const s=app.listen(0,'127.0.0.1'); await new Promise(r=>s.once('listening',r)); const b=`http://127.0.0.1:${s.address().port}`; try{await fn(b);}finally{s.close();}}
const H={ 'x-user':'u1','content-type':'application/json' };
test('tasks require auth and support create/list-search/update/export/sections + offline AI', async()=>{
  await withServer(async(b)=>{
    assert.equal((await fetch(b+'/api/tasks')).status,401);
    const bad=await fetch(b+'/api/tasks',{method:'POST',headers:H,body:JSON.stringify({})}); assert.equal(bad.status,400);
    const c=await fetch(b+'/api/tasks',{method:'POST',headers:H,body:JSON.stringify({title:'Alpha task',description:'',completed:false,estimateMinutes:0})}); assert.equal(c.status,201); const task=await c.json(); assert.equal(task.estimateMinutes,0); assert.equal(task.completed,false);
    await fetch(b+'/api/tasks',{method:'POST',headers:H,body:JSON.stringify({title:'Beta other',status:'done',priority:'high'})});
    const filtered=await (await fetch(b+'/api/tasks?search=alpha',{headers:H})).json(); assert.equal(filtered.total,1);
    const byStatus=await (await fetch(b+'/api/tasks?status=done',{headers:H})).json(); assert.equal(byStatus.total,1);
    const upd=await (await fetch(b+'/api/tasks/'+task.id,{method:'PUT',headers:H,body:JSON.stringify({status:'done',completed:true})})).json(); assert.equal(upd.status,'done');
    const other=await fetch(b+'/api/tasks/'+task.id,{method:'PUT',headers:{'x-user':'u2','content-type':'application/json'},body:JSON.stringify({status:'x'})}); assert.equal(other.status,404);
    const csv=await (await fetch(b+'/api/tasks/export?format=csv',{headers:H})).text(); assert.ok(csv.startsWith('id,title')); assert.ok(csv.includes('Alpha task'));
    const js=await (await fetch(b+'/api/tasks/export?format=json',{headers:H})).json(); assert.equal(js.total,2);
    const view=await (await fetch(b+'/api/tasks/'+task.id+'/view',{headers:H})).json(); const sec=Object.fromEntries(view.sections.map(s=>[s.key,s])); assert.equal(sec.estimateMinutes.value,0); assert.equal(sec.completed.value,true); assert.equal(sec.description.value,''); assert.ok(sec.title.label==='Title');
    const aiPaths=['/api/tasks/ai/study-plan','/api/tasks/ai/misconception-check','/api/tasks/ai/progress-summary'];
    for(const p of aiPaths){ const r=await (await fetch(b+p,{method:'POST',headers:H,body:JSON.stringify({text:'Get 10 results now buy today'})})).json(); assert.equal(r.aiGenerated,false); assert.equal(r.source,'deterministic-fallback'); assert.ok(r.sections.length>=1); }
  });
});
test('toCsv/toSections preserve false/0/empty',()=>{ const csv=toCsv([{id:'1',title:'A',description:'',status:'todo',priority:'low',completed:false,estimateMinutes:0,notes:'',dueDate:'',createdAt:'x'}]); assert.ok(csv.includes('false')); assert.ok(csv.includes(',0,')); const s=Object.fromEntries(toSections({title:'A',description:'',completed:false,estimateMinutes:0}).map(x=>[x.key,x])); assert.equal(s.description.displayText,'(empty)'); assert.equal(s.estimateMinutes.value,0); });
