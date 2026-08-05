async function run() {
  try {
    const res = await fetch('http://localhost:3001/api/farm/6279470157500012/history');
    const data = await res.json();
    if (data.data && data.data.deliveries) {
       const keys = Object.keys(data.data.deliveries).sort();
       console.log("Deliveries Keys:", keys);
       const today = new Date().toISOString().split('T')[0];
       console.log("Today UTC is:", today);
       if (data.data.deliveries[today]) {
          console.log("Today Deliveries:", data.data.deliveries[today]);
       } else if (keys.length > 0) {
          const last = keys[keys.length - 1];
          console.log(`Latest date ${last}:`, data.data.deliveries[last]);
       } else {
          console.log("No deliveries array at all");
       }
    } else {
       console.log("No deliveries in history!");
    }
  } catch (err) {
    console.error(err);
  }
}
run();
