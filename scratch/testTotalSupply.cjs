async function run() {
  const url = 'https://api.sunflower-land.com/community/data?type=totalSupply';
  const options = { headers: { 'x-api-key': 'sfl.NjI3OTQ3MDE1NzUwMDAxMg.LPF4t5CNcMXwSrwNcRiM_FOP6r0w58Jc3lulRca1NzU' } };
  try {
    const res = await fetch(url, options);
    const data = await res.text();
    console.log(res.status, data.substring(0, 500));
  } catch(e) { console.error(e); }
}
run();
