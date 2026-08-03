async function test() {
  console.log("Fetching...");
  const res = await fetch('https://sfl.world/land/160167/chapter');
  const html = await res.text();
  console.log("Length:", html.length);
  console.log("Has collapseChores:", html.includes("collapseChores"));
  console.log("Has __NEXT_DATA__:", html.includes("__NEXT_DATA__"));
}

test();
