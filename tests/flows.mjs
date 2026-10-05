import assert from 'node:assert/strict';
import {validateInventory} from '../src/inventory.js';
import {store,createOrder,createTicket,upsertCustomer} from '../src/store.js';
const p=store.products[0];
const checked=validateInventory([
  {product_id:p.id,denomination:p.values[0],code:'DEMO-A'},
  {product_id:p.id,denomination:p.values[0],code:'DEMO-A'},
  {product_id:999,denomination:5000,code:'DEMO-B'},
  {product_id:p.id,denomination:123,code:'DEMO-C'},
  {product_id:p.id,denomination:p.values[0],code:''},
],store.products);
assert.equal(checked.accepted.length,1);
assert.equal(checked.errors.length,4);
assert.equal(validateInventory([{product_id:p.id,denomination:p.values[0],code:'DEMO-A'}],store.products,new Set(['DEMO-A'])).accepted.length,0);
p.wholesale[0]=5000;p.stock[0]=3;
const user={name:'Test',email:'demo@example.com',phone:'07700000000'};
upsertCustomer(user);upsertCustomer(user);assert.equal(store.customers.length,1);
const order=createOrder(p,0,2,user,true);
assert.equal(order.price,10000);assert.equal(order.kind,'محل');assert.equal(p.stock[0],1);assert.equal(store.orders.length,1);
createTicket('Test','Demo message',user);assert.equal(store.tickets[0].email,user.email);
assert.match(order.date,/^\d{4}-\d{2}-\d{2}$/);
console.log('Shared order, customer, ticket, stock and import validation checks passed.');
