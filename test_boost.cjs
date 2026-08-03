async function test() {
  const farmId = '6279470157500012';
  const res = await fetch(`https://sfl.world/boost/${farmId}`);
  const html = await res.text();
  if (html.includes('Mariner Pot')) console.log("Found Mariner Pot!");
  if (html.includes('Crab Pot')) console.log("Found Crab Pot!");
}
test();
