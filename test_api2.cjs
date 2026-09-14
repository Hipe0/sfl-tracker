async function test() {
  console.log("Fetching API...");
  try {
    const res = await fetch("http://localhost:3001/api/market/history/Parsnip?granularity=1d&limit=180");
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text.substring(0, 100));
  } catch (err) {
    console.log("Error:", err.message);
  }
}
test();
