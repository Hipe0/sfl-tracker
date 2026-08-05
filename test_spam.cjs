async function run() {
  const url = 'http://localhost:3001/api/farm/6279470157500012';
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url);
      console.log(`Req ${i}: Status ${res.status}`);
      if (!res.ok) {
        const text = await res.text();
        console.error('Error body:', text);
      }
    } catch (err) {
      console.error(`Req ${i} Failed:`, err);
    }
  }
}
run();
