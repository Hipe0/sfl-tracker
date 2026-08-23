const fs = require('fs');

let crop = fs.readFileSync('src/components/CropTooltip.jsx', 'utf8');
crop = crop.replace(/import cropRecipes from '\.\.\/data\/cropRecipes\.json';/g, 'import cropRecipes from \'../data/cropRecipes.json\';\nimport seedPrices from \'../data/seedPrices.json\';');

crop = crop.replace(/ThA'ng tin gieo tr"ng/g, 'Thông tin gieo trồng');
crop = crop.replace(/Ht gi`ng:/g, 'Hạt giống:');
crop = crop.replace(/CA3 sn:/g, 'Có sẵn:');
crop = crop.replace(/Th\?i gian gieo ht:/g, 'Thời gian gieo hạt:');

crop = crop.replace(
/<span className="text-\[10px\] text-slate-400">GiA \/ 1 ht gi`ng:<\/span>[\s\S]*?<\/span>/,
`<span className="text-[10px] text-slate-400">Giá / 1 hạt giống:</span>
                <span className="text-[11px] text-yellow-400 font-mono font-bold flex items-center gap-1">
                  <img src="data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=" className="w-3 h-3 object-contain drop-shadow" />
                  {seedPrices[seedName] || 0} Coins
                </span>`
);

crop = crop.replace(/T ng chi phA- \(\{item\.total\}\):/g, 'Tổng chi phí ({item.total}):');

fs.writeFileSync('src/components/CropTooltip.jsx', crop);

let flower = fs.readFileSync('src/components/FlowerTooltip.jsx', 'utf8');
flower = flower.replace(/import flowerRecipes from '\.\.\/data\/flowerRecipes\.json';/g, 'import flowerRecipes from \'../data/flowerRecipes.json\';\nimport seedPrices from \'../data/seedPrices.json\';');

flower = flower.replace(/ThA'ng tin gieo tr"ng/g, 'Thông tin gieo trồng');
flower = flower.replace(/Ht gi`ng:/g, 'Hạt giống:');
flower = flower.replace(/CA3 sn:/g, 'Có sẵn:');
flower = flower.replace(/Th\?i gian gieo ht:/g, 'Thời gian gieo hạt:');
flower = flower.replace(/CAnng th.c lai t.o/g, 'Công thức lai tạo');
flower = flower.replace(/Tr.*ng tr.c ti.p k. bAn:/g, 'Trồng trực tiếp kế bên:');
flower = flower.replace(/Tr.*ng k. bAn 1 trong c.c cAy sau:/g, 'Trồng kế bên 1 trong các cây sau:');
flower = flower.replace(/T\? ng:/g, 'Tổng:');
flower = flower.replace(/KhA'ng cA3 buff nA.o/g, 'Không có buff nào');

flower = flower.replace(
/<span className="text-\[10px\] text-slate-400">GiA \/ 1 ht gi`ng:<\/span>[\s\S]*?<\/span>/,
`<span className="text-[10px] text-slate-400">Giá / 1 hạt giống:</span>
                <span className="text-[11px] text-yellow-400 font-mono font-bold flex items-center gap-1">
                  <img src="data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=" className="w-3 h-3 object-contain drop-shadow" />
                  {seedPrices[seedName] || 0} Coins
                </span>`
);

flower = flower.replace(/T ng chi phA- \(\{item\.total\}\):/g, 'Tổng chi phí ({item.total}):');

fs.writeFileSync('src/components/FlowerTooltip.jsx', flower);

console.log('Fixed vietnamese encoding and seed prices');
