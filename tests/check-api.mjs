import assert from 'node:assert/strict';
const url='http://127.0.0.1:5174/api/finance';
const user='qa-finance-'+crypto.randomUUID();const ids=[];
async function request(method,body,identity=user){const response=await fetch(url,{method,headers:{'Content-Type':'application/json','Origin':'http://127.0.0.1:5174','oai-authenticated-user-id':identity,'oai-authenticated-user-email':identity+'@example.test'},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()}}
try{
 const anonymous=await fetch(url);assert.equal(anonymous.status,401);
 const invalid=await request('POST',{description:'Invalid',amount:-100});assert.equal(invalid.status,400);
 const created=await request('POST',{description:'QA cartão',amount:1001,date:'2027-01-31',type:'expense',category:'Compras',payment:'card',status:'pending',installments:3});
 assert.equal(created.status,201,JSON.stringify(created));ids.push(...created.data.transactions.map(r=>r.id));assert.deepEqual(created.data.transactions.map(r=>r.amount),[334,334,333]);assert.deepEqual(created.data.transactions.map(r=>r.date),['2027-01-31','2027-02-28','2027-03-31']);
 const read=await request('GET');assert.equal(read.status,200);assert.equal(read.data.transactions.length,3);
 const changed=await request('PATCH',{id:ids[0],statusOnly:true,status:'paid'});assert.equal(changed.status,200);assert.equal(changed.data.transaction.status,'paid');
 const other=await request('GET',undefined,user+'-other');assert.equal(other.data.transactions.length,0);
 const crossEdit=await request('PATCH',{id:ids[0],statusOnly:true,status:'pending'},user+'-other');assert.equal(crossEdit.status,404);
 const crossDelete=await request('DELETE',{id:ids[0]},user+'-other');assert.equal(crossDelete.status,404);
 const plan=await request('PUT',{month:'2027-01',goal:50000,budgets:{Compras:25000}});assert.equal(plan.status,200);
 const reload=await request('GET');assert.equal(reload.data.settings['2027-01'].goal,50000);assert.equal(reload.data.transactions.find(r=>r.id===ids[0]).status,'paid');
 console.log('OK: armazenamento, leitura, parcelas, situação, metas, validação e isolamento de usuários.');
}finally{for(const id of ids){const deleted=await request('DELETE',{id});assert.equal(deleted.status,200)}}

