async function run() {
    const res = await fetch('https://sfl.world/api/v1/prices');
    const data = await res.json();
    const p2pPrices = data?.data?.p2p || {};
    console.log("Sunflower Cake:", p2pPrices['Sunflower Cake']);
    console.log("Flower:", p2pPrices['Flower']);
}
run();
