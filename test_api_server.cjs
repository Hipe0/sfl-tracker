const { spawn } = require('child_process');
const server = spawn('node', ['server.cjs']);

server.stdout.on('data', async (data) => {
  const str = data.toString();
  console.log('Server:', str.trim());
  if (str.includes('running on http://localhost:3001')) {
    console.log("Server started, testing API...");
    try {
      const res = await fetch('http://localhost:3001/api/farm/6279470157500012');
      const json = await res.json();
      console.log("API response keys:", Object.keys(json));
      if (json.success) {
        console.log("Scraped Deliveries count:", json.data.scrapedDeliveries?.length);
      }
    } catch (e) {
      console.error(e);
    }
    server.kill();
  }
});
server.stderr.on('data', (data) => console.error('Server error:', data.toString()));
