async function test() {
  const res = await fetch('http://localhost:3001/api/farm/6279470157500012');
  const json = await res.json();
  if (json.success) {
    console.log("Success!");
    console.log("Scraped Deliveries count:", json.data.scrapedDeliveries?.length);
    if (json.data.scrapedDeliveries?.length > 0) {
      console.log(json.data.scrapedDeliveries[0]);
    }
  } else {
    console.error("Error:", json.error);
  }
}
test();
