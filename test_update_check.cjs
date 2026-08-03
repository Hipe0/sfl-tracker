async function test() {
  const farmId = '7787429634558352';
  try {
    const res = await fetch(`https://sfl.world/update/${farmId}/check`);
    const json = await res.json();
    console.log("Check response:", json);
  } catch(e) {
    console.error(e);
  }
}
test();
