async function test() {
  const res = await fetch('https://sfl.world/js/main.js?20260703001');
  const js = await res.text();
  
  const idx = js.indexOf('function update(');
  if (idx !== -1) {
    console.log("Found in main.js:");
    console.log(js.substring(idx, idx + 800));
  } else {
    const res2 = await fetch('https://sfl.world/js/collapse2.js?20260703001');
    const js2 = await res2.text();
    const idx2 = js2.indexOf('function update(');
    if (idx2 !== -1) {
       console.log("Found in collapse2.js:");
       console.log(js2.substring(idx2, idx2 + 800));
    } else {
       console.log("Not found in main.js or collapse2.js");
    }
  }
}
test();
