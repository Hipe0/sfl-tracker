async function run() {
  const r = await fetch('https://sunflower-land.com/play/assets/index-BD0Fa0I4.js');
  const js = await r.text();
  const inventoryMatch = js.match(/VITE_INVENTORY_CONTRACT:"(0x[a-fA-F0-9]{40})"/);
  const traderMatch = js.match(/VITE_TRADER_CONTRACT:"(0x[a-fA-F0-9]{40})"/);
  
  console.log("INVENTORY_CONTRACT:", inventoryMatch ? inventoryMatch[1] : "Not found");
  console.log("TRADER_CONTRACT:", traderMatch ? traderMatch[1] : "Not found");
  
  const allContracts = js.match(/VITE_[A-Z_]+_CONTRACT:"0x[a-fA-F0-9]{40}"/g);
  console.log("All contracts:", allContracts);
}
run();
