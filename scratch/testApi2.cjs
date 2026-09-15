const url = 'https://api.sunflower-land.com/community/data?type=marketplaceActivity';
const options = {
  headers: {
    'x-api-key': 'sfl.NjI3OTQ3MDE1NzUwMDAxMg.LPF4t5CNcMXwSrwNcRiM_FOP6r0w58Jc3lulRca1NzU'
  }
};
async function run() {
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    const dates = Object.keys(data.data.reports).sort((a,b) => new Date(b) - new Date(a));
    const items = data.data.reports[dates[0]].items;
    console.log("Sunflower data:", items['crops-1']);
  } catch(e) {
    console.error(e);
  }
}
run();
