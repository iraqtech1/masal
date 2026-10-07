export function isTelecomCategory(name,categories){
  return categories.some(c=>c.name===name&&(c.id==='mobile'||c.name==='اتصالات'));
}
export function telecomType(product){return product.telecomType==='topup'?'topup':'cards';}
export function matchesTelecomTab(product,category,tab,categories){
  return !isTelecomCategory(category,categories)||telecomType(product)===tab;
}
