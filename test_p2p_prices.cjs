async function test() {
  try {
    const res = await fetch('https://sfl.world/api/v1/prices');
    const json = await res.json();
    console.log("P2P Prices:");
    console.log(json.data.p2p);
    
    // Calculate how many coins = 1 SFL
    if (json.data.p2p && json.data.p2p['Coins']) {
      const sflPerCoin = json.data.p2p['Coins'];
      const coinsPerSFL = 1 / sflPerCoin;
      console.log(`\n1 Coin = ${sflPerCoin} SFL`);
      console.log(`1 SFL = ${coinsPerSFL.toFixed(2)} Coins`);
    } else {
      console.log("No Coins data found in P2P prices.");
    }
  } catch (e) {
    console.error(e);
  }
}
test();
