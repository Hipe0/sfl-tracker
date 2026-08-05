async function run() {
  const res = await fetch('http://localhost:3001/api/farm/6279470157500012');
  console.log('Status:', res.status);
  const text = await res.text();
  try {
     const data = JSON.parse(text);
     console.log('coinDeliveries count:', data.data.coinDeliveries ? data.data.coinDeliveries.length : 'undefined');
     if (data.data.coinDeliveries && data.data.coinDeliveries.length > 0) {
        console.log(data.data.coinDeliveries[0]);
     }
  } catch (e) {
     console.log('Error parsing JSON');
  }
}
run();
