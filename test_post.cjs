async function run() {
  const r = await fetch('https://sfl.world/land/6279470157500012');
  const html = await r.text();
  
  const res = await fetch('http://localhost:3001/api/farm/6279470157500012/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html })
  });
  
  console.log('Status:', res.status);
  const text = await res.text();
  try {
     const data = JSON.parse(text);
     console.log('coinDeliveries count:', data.data.coinDeliveries ? data.data.coinDeliveries.length : 0);
  } catch (e) {
     console.log('Response text:', text.substring(0, 500));
  }
}
run();
