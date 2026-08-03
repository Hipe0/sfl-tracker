const names = [
  'Grow Red Lavender 4 times',
  'Grow Red Lotus 4 times',
  'Harvest Carrots 200 times',
  'Harvest Corn 450 times',
  'Harvest Soybeans 100 times',
  'Pick 72 Grapes',
  'Pick 150 Oranges'
];

names.forEach(name => {
  let matchCrop = name.match(/Harvest\s+([A-Za-z\s]+)\s+\d+\s+times/i);
  let matchPick = name.match(/Pick\s+\d+\s+([A-Za-z\s]+)/i);
  let matchGrow = name.match(/Grow\s+([A-Za-z\s]+)\s+\d+\s+times/i);
  
  let cropNameRaw = null;
  if (matchCrop) cropNameRaw = matchCrop[1];
  else if (matchPick) cropNameRaw = matchPick[1];
  else if (matchGrow) cropNameRaw = matchGrow[1];
  
  if (cropNameRaw) {
    cropNameRaw = cropNameRaw.trim().toLowerCase();
    if (cropNameRaw.endsWith('s') && !['sunflowers', 'lotus'].includes(cropNameRaw)) {
      cropNameRaw = cropNameRaw.slice(0, -1);
    }
    if (cropNameRaw === 'sunflowers') cropNameRaw = 'sunflower';
    console.log(`${name} -> ${cropNameRaw}`);
  } else {
    console.log(`${name} -> NO MATCH`);
  }
});
