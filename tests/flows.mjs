import assert from 'node:assert/strict';
import {validateInventory} from '../src/inventory.js';
import {store,createOrder,createTicket,upsertCustomer,matchesCustomer} from '../src/store.js';
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
p.stock[0]=3;
const user={name:'Test',email:'demo@example.com',phone:'07700000000'};
upsertCustomer(user);upsertCustomer(user);assert.equal(store.customers.length,1);
const order=createOrder(p,0,2,user,true);
assert.equal(order.price,p.prices[0]*2,'Legacy merchant flag cannot change retail pricing');assert.equal(order.kind,'فرد');assert.equal(p.stock[0],1);assert.equal(store.orders.length,1);
createTicket('Test','Demo message',user);assert.equal(store.tickets[0].email,user.email);
assert.match(order.date,/^\d{4}-\d{2}-\d{2}$/);
const withoutEmail={name:'No email',phone:'07812345678',email:''},another={name:'Another',phone:'07912345678',email:''};
upsertCustomer(withoutEmail);upsertCustomer(another);upsertCustomer(withoutEmail);
assert.equal(store.customers.length,3,'Phone identities must remain separate without email');
const privateOrder=createOrder(p,0,1,withoutEmail,false);
createTicket('Private','Account without email',withoutEmail);
assert.equal(matchesCustomer(privateOrder,withoutEmail),true);
assert.equal(matchesCustomer(privateOrder,another),false);
assert.equal(matchesCustomer(store.tickets[0],withoutEmail),true);
assert.equal(matchesCustomer(store.tickets[0],another),false);
assert.equal(matchesCustomer({email:''},withoutEmail),false,'Blank email must not match anonymous records');
console.log('Shared order, customer, ticket, stock and import validation checks passed.');

const guest={name:'Preview',phone:'',email:'',previewId:crypto.randomUUID()};
const secondGuest={...guest,previewId:crypto.randomUUID()};
upsertCustomer(guest);upsertCustomer(guest);
assert.equal(store.customers.filter(c=>c.previewId===guest.previewId).length,1);
const guestOrder=createOrder(p,0,1,guest);
createTicket('Guest support','Preview ticket',guest);
assert.equal(matchesCustomer(guestOrder,guest),true);
assert.equal(matchesCustomer(store.tickets[0],guest),true);
assert.equal(matchesCustomer(guestOrder,secondGuest),false,'Preview accounts keep separate orders');
assert.equal(matchesCustomer(guestOrder,withoutEmail),false);

const zainCashOrder=createOrder(p,0,1,guest,'ZainCash');
assert.equal(zainCashOrder.payment,'ZainCash / محاكاة');
assert.equal(zainCashOrder.price,p.prices[0]);
