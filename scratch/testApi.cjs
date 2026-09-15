const url = 'https://api.sunflower-land.com/community/data?type=marketplaceActivity&date=2026-09-13';
const options = {
  headers: {
    'x-api-key': 'sfl.NjI3OTQ3MDE1NzUwMDAxMg.LPF4t5CNcMXwSrwNcRiM_FOP6r0w58Jc3lulRca1NzU'
  }
};
async function run() {
  const res = await fetch(url, options);
  console.log("Status:", res.status, res.statusText);
  const text = await res.text();
  console.log("Response text length:", text.length);
  if (text.length < 500) console.log(text);
}
run();
