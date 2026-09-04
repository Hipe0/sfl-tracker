import React, { useState, useEffect } from 'react';
import { useFarm } from '../context/FarmContext';
import Accordion from './Accordion';
import SkillsPanel from './SkillsPanel';
import buffsData from '../data/buffs.json';
import { ASSET_URLS, getAssetUrl } from '../utils/gameConstants';
import { getBumpkinImageURL, tokenUriBuilder } from '../utils/bumpkinUtils';
import tradableItems from '../data/tradableItems.json';
import nonNfts from '../data/nonNfts.json';
import itemsMetadata from '../data/items_metadata.json';
import { getFactionRank } from '../utils/factionUtils';
import { calculateTradeTax } from '../utils/taxCalculator';

const FarmProfileCard = () => {
  const { farmData, currentId } = useFarm();

  if (!farmData) return null;

  const game = farmData.gameData;
  const config = farmData.globalConfig;
  const bumpkin = config?.bumpkin;
  const playerName = config?.playerName || `Bumpkin #${currentId}`;
  
  // Basic stats
  const islandType = game?.island?.type || config?.island || 'Basic';
  const faction = game?.faction?.name || 'Chưa tham gia';
  
  let emblemItemName = '';
  if (faction.toLowerCase() === 'bumpkins') emblemItemName = 'Bumpkin Emblem';
  else if (faction.toLowerCase() === 'goblins') emblemItemName = 'Goblin Emblem';
  else if (faction.toLowerCase() === 'sunflorians') emblemItemName = 'Sunflorian Emblem';
  else if (faction.toLowerCase() === 'nightshades') emblemItemName = 'Nightshade Emblem';
  
  const factionPoints = emblemItemName ? parseFloat(game?.inventory?.[emblemItemName] || 0) : 0;
  const factionRank = getFactionRank(faction, factionPoints);
  const createdAt = game?.createdAt ? new Date(game.createdAt).toLocaleString('vi-VN') : 'N/A';
  
  // Balances
  const sfl = game?.balance ? parseFloat(game.balance).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '0';
  const coins = game?.coins ? parseFloat(game.coins).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : '0';
  const gems = game?.gems ? parseFloat(game.gems).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : '0';
  const loveCharm = game?.inventory?.['Love Charm'] ? parseFloat(game.inventory['Love Charm']).toLocaleString('vi-VN') : '0';

  // Check VIP (e.g. Gold Pass)
  const vipExpiresAt = game?.vip?.expiresAt;
  let isVip = !!game?.inventory?.['Gold Pass'] || !!game?.inventory?.['VIP Ticket'];
  let vipText = 'VIP';
  
  if (vipExpiresAt && vipExpiresAt > Date.now()) {
    isVip = true;
    const daysLeft = Math.ceil((vipExpiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 30) {
      vipText = `VIP (in ${Math.round(daysLeft / 30)} months)`;
    } else {
      vipText = `VIP (in ${daysLeft} days)`;
    }
  }

  // TRADES
  const listings = game?.trades?.listings || {};
  const offers = game?.trades?.offers || {};
  const activeListings = Object.values(listings).filter(l => !l.boughtAt);
  const activeOffers = Object.values(offers).filter(o => !o.fulfilledAt);

  // MARKET INVENTORY & STATS
  const marketPrices = farmData.prices || {};
  const marketStats = farmData.marketStats || {};
  const flowerUsdPrice = marketStats.flowerUsdPrice || 0;
  const nftPrices = marketStats.nftPrices || {};

  // WARDROBE
  const wardrobe = game?.wardrobe || {};
  // COMBINE INVENTORY AND PLACED COLLECTIBLES
  const inventory = { ...(game?.inventory || {}) };
  if (game?.collectibles) {
    Object.entries(game.collectibles).forEach(([name, arr]) => {
      if (arr && arr.length > 0) {
        const current = parseFloat(inventory[name]) || 0;
        inventory[name] = current + arr.length;
      }
    });
  }
  if (game?.home?.collectibles) {
    Object.entries(game.home.collectibles).forEach(([name, arr]) => {
      if (arr && arr.length > 0) {
        const current = parseFloat(inventory[name]) || 0;
        inventory[name] = current + arr.length;
      }
    });
  }
  
  const wardrobeBuffTradeable = [];
  const wardrobeCosmeticTradeable = [];
  const wardrobeNoTrade = [];
  let totalWardrobeFlower = 0;

  Object.entries(wardrobe).forEach(([item, amount]) => {
    const meta = itemsMetadata[item] || { hasBuff: !!buffsData[item], isTradeable: false };
    const buffs = buffsData[item] || null;
    const price = nftPrices[item] || 0;
    const qty = parseFloat(amount) || 0;
    
    totalWardrobeFlower += (qty * price);
    
    const obj = { name: item, amount: qty, buffs, price, hasBuff: meta.hasBuff || buffs };

    if (meta.isTradeable) {
      if (obj.hasBuff) {
        wardrobeBuffTradeable.push(obj);
      } else {
        wardrobeCosmeticTradeable.push(obj);
      }
    } else {
      wardrobeNoTrade.push(obj);
    }
  });

  // Sort Tradeable by price desc
  wardrobeBuffTradeable.sort((a, b) => b.price - a.price);
  wardrobeCosmeticTradeable.sort((a, b) => b.price - a.price);
  // Sort No trade by buff then name
  wardrobeNoTrade.sort((a, b) => {
    if (a.hasBuff && !b.hasBuff) return -1;
    if (!a.hasBuff && b.hasBuff) return 1;
    return a.name.localeCompare(b.name);
  });

  const nftTradeable = [];
  const nftNoTrade = [];
  let totalNftFlower = 0;

  Object.entries(inventory).forEach(([item, amount]) => {
    const qty = parseFloat(amount);
    if (qty <= 0) return;

    if (item === 'Parsnip') return;
    
    const meta = itemsMetadata[item];
    
    // EXCLUDE strategy: Exclude known non-NFT types
    const excludedTypes = ['wardrobe', 'crop', 'fruit', 'resource', 'fish', 'consumable', 'tool', 'garbage', 'animal', 'composter'];
    if (meta && excludedTypes.includes(meta.type)) return;
    if (meta?.type === 'treasure' && !meta.hasBuff) return; // Exclude non-buff treasures like Sand, Clam Shell
    if (nonNfts.includes(item)) return;
    
    // Explicit pattern and item exclusions for garbage/resources that slip through metadata parsing
    if (item.startsWith('Aged ') || item.startsWith('Prime Aged ') || item.startsWith('Pickled ')) return;
    if (['Cheer', 'Trade Point', 'Big Apple', 'Crabs and Traps Banner'].includes(item)) return;

    const price = nftPrices[item] || 0;
    const buffs = buffsData[item] || null;
    const hasBuff = meta?.hasBuff || !!buffs;
    const isTradeable = meta ? meta.isTradeable : !!tradableItems[item];

    const isExplicitNFT = meta?.type === 'collectible' || meta?.type === 'decoration';
    // Strict enforcement: if an item is not tradeable, has no buff, and is not explicitly known as an NFT, it is garbage.
    if (!isTradeable && !hasBuff && !isExplicitNFT) return;
    
    totalNftFlower += (qty * price);
    const obj = { name: item, amount: qty, buffs, price, hasBuff };

    if (isTradeable) {
      nftTradeable.push(obj);
    } else {
      nftNoTrade.push(obj);
    }
  });

  nftTradeable.sort((a, b) => {
    // Sort by price desc, then by name
    if (a.price !== b.price) return b.price - a.price;
    return a.name.localeCompare(b.name);
  });
  nftNoTrade.sort((a, b) => {
    if (a.hasBuff && !b.hasBuff) return -1;
    if (!a.hasBuff && b.hasBuff) return 1;
    return a.name.localeCompare(b.name);
  });
  
  const marketInventory = [];
  let totalFlower = 0;
  
  Object.entries(inventory).forEach(([item, amount]) => {
    const qty = parseFloat(amount);
    if (qty > 0 && marketPrices[item] !== undefined) {
      const price = marketPrices[item];
      const cost = qty * price;
      totalFlower += cost;
      marketInventory.push({ name: item, amount: qty, cost });
    }
  });
  
  const totalUsd = totalFlower * flowerUsdPrice;

  // FARM HANDS
  const allFarmHands = [];
  if (game?.bumpkin) {
    allFarmHands.push({ name: 'Bumpkin', data: game.bumpkin });
  }
  if (game?.farmHands?.bumpkins) {
    Object.entries(game.farmHands.bumpkins).forEach(([key, hand]) => {
      allFarmHands.push({ name: `Farm Hand #${key}`, data: hand });
    });
  }

  // SKILLS
  const skills = game?.bumpkin?.skills || {};

  const totalNetWorthUsd = totalUsd + (totalNftFlower * flowerUsdPrice) + (totalWardrobeFlower * flowerUsdPrice);
  const totalNetWorthFlower = totalFlower + totalNftFlower + totalWardrobeFlower;

  // --- NEW FIELDS CALCULATIONS ---
  const expansions = game?.inventory?.['Basic Land'] || 0;
  const flowerBalance = parseFloat(game?.balance || 0);
  const coinsBalance = parseFloat(game?.coins || 0);
  const gemsBalance = parseFloat(game?.inventory?.Gem || game?.gems || 0);
  const marksBalance = parseFloat(game?.inventory?.Mark || 0);
  const loveCharmBalance = parseFloat(game?.inventory?.['Love Charm'] || 0);
  const cheersBalance = parseFloat(game?.inventory?.Cheer || 0);

  const depositedSfl = farmData?.farmActivity?.['FLOWER Deposited'] || 0;
  
  const resourceTax = (calculateTradeTax('Wood', farmData) * 100).toFixed(1);
  
  let withdrawTax = 30;
  if (flowerBalance >= 5000) withdrawTax = 10;
  else if (flowerBalance >= 1000) withdrawTax = 15;
  else if (flowerBalance >= 100) withdrawTax = 20;
  else if (flowerBalance >= 10) withdrawTax = 25;
  if (islandType.toLowerCase() !== 'basic') withdrawTax -= 2.5;

  const taxFreeSFL = game?.bank?.taxFreeSFL || game?.previousFreeMints || 0;
  
  let afterWithdrawal = 0;
  if (flowerBalance <= taxFreeSFL) {
    afterWithdrawal = flowerBalance;
  } else {
    const taxedAmount = flowerBalance - taxFreeSFL;
    afterWithdrawal = taxFreeSFL + (taxedAmount * (1 - withdrawTax / 100));
  }

  const maticUsd = farmData?.prices?.matic?.usd || 0.40;
  const flowerMatic = flowerUsdPrice / maticUsd;
  const maticValue = afterWithdrawal * flowerMatic;
  const usdValue = afterWithdrawal * flowerUsdPrice;

  const createdDate = game?.createdAt ? new Date(game.createdAt) : new Date();
  const monthsAgo = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24 * 30));
  const createdStr = `${monthsAgo} months ago (${createdDate.toLocaleDateString('en-CA')})`;

  return (
    <div className="animate-fade-in-up w-full max-w-5xl mx-auto">
      {/* HEADER CARD */}
      <div className="glass-card border border-slate-700/50 bg-slate-800/40 rounded-xl overflow-hidden mb-4 relative shadow-2xl">
        <div className="p-6 relative z-10">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar Section */}
            <div className="flex gap-5 items-center">
              <div className="relative group">
                <div className="absolute inset-0 bg-blue-500 rounded-2xl blur opacity-20"></div>
                <img 
                  src={bumpkin?.avatar || "https://animations.sunflower-land.com/bumpkin_image/0_v1/100"} 
                  alt="Avatar" 
                  className="w-24 h-24 rounded-2xl bg-slate-900 border-2 border-slate-700 relative z-10"
                />
              </div>
              <div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-white tracking-wide">{playerName.replace('#', '')}</h2>
                    <a href={`https://sunflower-land.com/play/#/visit/${currentId}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 font-medium bg-blue-900/30 px-3 py-1 rounded-full">
                      Visit {playerName.replace('#', '')} in game <i className="bi bi-box-arrow-up-right text-xs"></i>
                    </a>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`https://sfl.world/land/${currentId}`} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 bg-slate-800 text-xs text-slate-300 hover:text-white rounded font-mono border border-slate-700 transition-colors">
                      {currentId}
                    </a>
                    {isVip && <span className="px-2 py-0.5 bg-green-900/50 text-xs text-green-400 rounded font-bold border border-green-800">{vipText}</span>}
                    <span className="px-2 py-0.5 bg-blue-900/50 text-xs text-blue-400 rounded font-bold border border-blue-800 flex items-center gap-1"><i className="bi bi-patch-check-fill"></i> Verified</span>
                    {bumpkin?.level && <span className="px-2 py-0.5 bg-slate-800 text-xs text-white rounded font-bold border border-slate-700">Bumpkin level {bumpkin.level}</span>}
                    
                    <div className="ml-1 px-3 py-0.5 bg-amber-500/20 text-xs text-amber-400 rounded-full font-bold border border-amber-500/30 flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                      <i className="bi bi-gem"></i> Tổng tài sản: {totalNetWorthFlower.toLocaleString('en-US', {maximumFractionDigits:0})} FLOWER (${totalNetWorthUsd.toFixed(2)})
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Info Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            {/* Column 1: Profile & Progress */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 space-y-4">
              <h3 className="text-slate-300 font-bold border-b border-slate-700/50 pb-2">Hồ sơ (Profile)</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Expansion No</span>
                  <span className="text-white font-bold">{expansions}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Island</span>
                  <span className="text-white font-bold capitalize">{islandType} Island</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Faction</span>
                  <div className="text-right flex flex-col items-end">
                    <div className="text-white font-bold capitalize">{faction}</div>
                    {faction !== 'Chưa tham gia' && <div className="text-xs text-slate-400">{factionPoints.toLocaleString('en-US')} emblems</div>}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-700/50 pt-3 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Created</span>
                  <span className="text-white font-medium">{createdStr}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Telegram</span>
                  <span className="text-teal-400 font-medium">Connected</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Discord</span>
                  <span className="text-teal-400 font-medium">Connected</span>
                </div>
              </div>
            </div>

            {/* Column 2: Balances */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 space-y-4">
              <h3 className="text-slate-300 font-bold border-b border-slate-700/50 pb-2">Số dư (Balances)</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <img src={ASSET_URLS.COIN} className="w-5 h-5" alt="Coins" /> Coins
                  </div>
                  <span className="text-white font-bold">{coinsBalance.toLocaleString('en-US')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <img src={ASSET_URLS.SFL} className="w-5 h-5" alt="Flower" /> Flower
                  </div>
                  <span className="text-white font-bold">{flowerBalance.toLocaleString('en-US', {maximumFractionDigits:2})}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <img src={ASSET_URLS.GEM || getAssetUrl('gem')} className="w-5 h-5" alt="Gems" /> Gem
                  </div>
                  <span className="text-white font-bold">{gemsBalance.toLocaleString('en-US')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <img src={ASSET_URLS.MARK || getAssetUrl('Mark')} className="w-5 h-5 object-contain" alt="Marks" onError={(e)=>{e.target.style.display='none'}}/> Marks
                  </div>
                  <span className="text-white font-bold">{marksBalance.toLocaleString('en-US')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <img src={ASSET_URLS.LOVE_CHARM || getAssetUrl('Love Charm')} className="w-5 h-5" alt="Event" /> Love Charm
                  </div>
                  <span className="text-white font-bold">{loveCharmBalance.toLocaleString('en-US')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <img src={getAssetUrl('Cheer')} className="w-5 h-5 object-contain" alt="Cheers" onError={(e)=>{e.target.style.display='none'}}/> Cheers
                  </div>
                  <span className="text-white font-bold">{cheersBalance.toLocaleString('en-US')}</span>
                </div>
                
                <div className="my-2 border-t border-slate-700/50"></div>
                <div className="flex justify-between items-center text-sm pt-1">
                  <div className="flex items-center gap-2 text-slate-400 font-medium">
                    <i className="bi bi-box-arrow-in-down text-emerald-400"></i> SFL Đã Nạp
                  </div>
                  <span className="text-emerald-400 font-bold">{depositedSfl.toLocaleString('en-US', {maximumFractionDigits:2})}</span>
                </div>
              </div>
            </div>

            {/* Column 3: Tax & Withdrawal */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 space-y-4">
              <h3 className="text-slate-300 font-bold border-b border-slate-700/50 pb-2">Thuế & Rút tiền (Tax & Withdraw)</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Resource Tax</span>
                  <span className="text-rose-400 font-bold">{resourceTax}%</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Withdraw Tax</span>
                  <span className="text-rose-400 font-bold">{withdrawTax}%</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Tax Free Limit</span>
                  <span className="text-emerald-400 font-bold">{taxFreeSFL.toLocaleString('en-US', {maximumFractionDigits:2})} Flower</span>
                </div>
                
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 mt-2">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Dự tính sau khi rút (After Tax)</div>
                  <div className="flex flex-col gap-1">
                    <div className="text-lg text-white font-bold flex items-center gap-2">
                      <img src={ASSET_URLS.SFL} className="w-5 h-5" alt="Flower" />
                      {afterWithdrawal.toLocaleString('en-US', {maximumFractionDigits:2})}
                    </div>
                    <div className="text-sm text-emerald-500 font-bold">
                      ≈ ${usdValue.toLocaleString('en-US', {maximumFractionDigits:2})}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ACCORDIONS */}
      

      {/* 2. FARM HANDS */}
      <Accordion title="Farm Hands" rightContent={`${allFarmHands.length} nhân vật`}>
        <div className="space-y-6">
          {allFarmHands.map((hand, idx) => {
            const equipped = hand.data.equipped || {};
            const equippedArray = Object.entries(equipped).filter(([k,v]) => v);
            
            return (
              <div key={idx} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden border border-slate-600">
                    <img src={getBumpkinImageURL(hand.data.equipped)} className="w-full h-full object-cover" alt="Bumpkin" onError={(e) => {
                      const fallback = `https://animations.sunflower-land.com/bumpkin_image/0_v1_${tokenUriBuilder(hand.data.equipped)}/100`;
                      if (e.target.src !== fallback) e.target.src = fallback;
                    }}/>
                  </div>
                  <div>
                    <h3 className="text-white font-bold">{hand.name}</h3>
                    <p className="text-xs text-slate-500">{equippedArray.length} trang bị</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {equippedArray.map(([part, itemName]) => {
                    const buffs = buffsData[itemName];
                    return (
                      <div key={part} className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/50 flex items-start gap-3">
                        <div className="w-10 h-10 bg-slate-900/50 rounded p-1 flex-shrink-0">
                           <img src={getAssetUrl(itemName)} className="w-full h-full object-contain" alt={itemName} />
                        </div>
                        <div>
                          <div className="text-sm text-white font-semibold">{itemName} {buffs && <i className="bi bi-lightning-charge-fill text-amber-400 text-xs ml-1"></i>}</div>
                          <div className="text-[10px] text-slate-500 capitalize">{part}</div>
                          {buffs && (
                            <div className="mt-1 space-y-1">
                              {buffs.map((b, i) => (
                                <div key={i} className="text-[10px] text-emerald-400 leading-tight font-medium">{b.shortDescription || b}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Accordion>

      {/* 3. WARDROBE */}
      <Accordion title="Wardrobe" rightContent={`${wardrobeBuffTradeable.length + wardrobeCosmeticTradeable.length + wardrobeNoTrade.length} item${totalWardrobeFlower > 0 ? ` - ${totalWardrobeFlower.toLocaleString('en-US', {maximumFractionDigits: 2})} FLOWER ($${(totalWardrobeFlower * flowerUsdPrice).toFixed(2)})` : ''}`}>
        {wardrobeBuffTradeable.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs uppercase text-emerald-500 font-bold mb-3 flex items-center gap-2"><i className="bi bi-stars"></i> Có Tác Dụng (Tradeable)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {wardrobeBuffTradeable.map(item => {
                const priceFlower = item.price;
                const priceUsd = priceFlower ? (priceFlower * flowerUsdPrice).toFixed(2) : null;
                return (
                <div key={item.name} className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/50 flex relative justify-between">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 flex-shrink-0 p-1">
                      <img src={getAssetUrl(item.name)} className="w-full h-full object-contain" alt={item.name} />
                    </div>
                    <div>
                      <div className="text-sm text-white font-semibold flex items-center gap-1">
                        {item.name} <i className="bi bi-lightning-charge-fill text-amber-400 text-[10px]"></i>
                      </div>
                      <div className="text-[10px] text-slate-500">x{item.amount}</div>
                      <div className="mt-1 space-y-1">
                        {item.buffs && item.buffs.map((b, i) => <div key={i} className="text-[10px] text-emerald-400 font-medium leading-tight">{b.shortDescription || b}</div>)}
                      </div>
                    </div>
                  </div>
                  
                  {priceFlower > 0 && (
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right justify-center">
                      <div className="text-[10px] font-bold text-pink-400">
                        {priceFlower.toLocaleString()} FLOWER<br/>
                        <span className="text-slate-400 font-normal">(${priceUsd})</span>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}
        
        {wardrobeCosmeticTradeable.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs uppercase text-slate-300 font-bold mb-3 flex items-center gap-2"><i className="bi bi-person-fill"></i> Trang trí (Tradeable)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {wardrobeCosmeticTradeable.map(item => {
                const priceFlower = item.price;
                const priceUsd = priceFlower ? (priceFlower * flowerUsdPrice).toFixed(2) : null;
                return (
                <div key={item.name} className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 flex relative justify-between">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 flex-shrink-0 p-1">
                      <img src={getAssetUrl(item.name)} className="w-full h-full object-contain" alt={item.name} />
                    </div>
                    <div>
                      <div className="text-sm text-white font-semibold flex items-center gap-1">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-slate-500">x{item.amount}</div>
                    </div>
                  </div>
                  
                  {priceFlower > 0 && (
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right justify-center">
                      <div className="text-[10px] font-bold text-pink-400">
                        {priceFlower.toLocaleString()} FLOWER<br/>
                        <span className="text-slate-400 font-normal">(${priceUsd})</span>
                      </div>
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          </div>
        )}

        {wardrobeNoTrade.length > 0 && (
          <div>
            <h4 className="text-xs uppercase text-rose-400 font-bold mb-3 flex items-center gap-2"><i className="bi bi-lock-fill"></i> Không Thể Giao Dịch (No Trade)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {wardrobeNoTrade.map(item => {
                return (
                <div key={item.name} className="bg-slate-900/50 p-3 rounded-lg border border-rose-900/30 flex relative justify-between">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 flex-shrink-0 p-1 opacity-80">
                      <img src={getAssetUrl(item.name)} className="w-full h-full object-contain" alt={item.name} />
                    </div>
                    <div>
                      <div className="text-sm text-white font-semibold flex items-center gap-1">
                        {item.name} {item.hasBuff && <i className="bi bi-lightning-charge-fill text-amber-400 text-[10px]"></i>}
                      </div>
                      <div className="text-[10px] text-slate-500">x{item.amount}</div>
                      {item.hasBuff && item.buffs && (
                        <div className="mt-1 space-y-1">
                          {item.buffs.map((b, i) => <div key={i} className="text-[10px] text-emerald-400/80 font-medium leading-tight">{b.shortDescription || b}</div>)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right justify-center">
                    <span className="text-[9px] uppercase tracking-wider text-rose-500/70 border border-rose-500/20 px-1.5 py-0.5 rounded">No Trade</span>
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        )}
      </Accordion>

      {/* 4. NFT */}
      <Accordion title="NFT" rightContent={`${nftTradeable.length + nftNoTrade.length} item${totalNftFlower > 0 ? ` - ${totalNftFlower.toLocaleString('en-US', {maximumFractionDigits: 2})} FLOWER ($${(totalNftFlower * flowerUsdPrice).toFixed(2)})` : ''}`}>
        
        {nftTradeable.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs uppercase text-emerald-500 font-bold mb-3 flex items-center gap-2"><i className="bi bi-shop"></i> Có Thể Giao Dịch (Tradeable)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {nftTradeable.map(item => {
                const priceFlower = item.price;
                const priceUsd = priceFlower ? (priceFlower * flowerUsdPrice).toFixed(2) : null;
                return (
                  <div key={item.name} className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/50 flex relative justify-between">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 flex-shrink-0 p-1">
                        <img src={getAssetUrl(item.name)} className="w-full h-full object-contain" alt={item.name} />
                      </div>
                      <div>
                        <div className="text-sm text-white font-semibold flex items-center gap-1">
                          {item.name} {item.hasBuff && <i className="bi bi-lightning-charge-fill text-amber-400 text-[10px]"></i>}
                        </div>
                        <div className="text-[10px] text-slate-500">x{item.amount}</div>
                        {item.hasBuff && item.buffs && (
                          <div className="mt-1 space-y-1">
                            {item.buffs.map((b, i) => <div key={i} className="text-[10px] text-emerald-400 font-medium leading-tight">{b.shortDescription || b}</div>)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {priceFlower > 0 && (
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right justify-center">
                        <div className="text-[10px] font-bold text-pink-400">
                          {priceFlower.toLocaleString()} FLOWER<br/>
                          <span className="text-slate-400 font-normal">(${priceUsd})</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {nftNoTrade.length > 0 && (
          <div>
            <h4 className="text-xs uppercase text-rose-400 font-bold mb-3 flex items-center gap-2"><i className="bi bi-lock-fill"></i> Không Thể Giao Dịch (No Trade)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {nftNoTrade.map(item => {
                return (
                  <div key={item.name} className="bg-slate-900/50 p-3 rounded-lg border border-rose-900/30 flex relative justify-between">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 flex-shrink-0 p-1 opacity-80">
                        <img src={getAssetUrl(item.name)} className="w-full h-full object-contain" alt={item.name} />
                      </div>
                      <div>
                        <div className="text-sm text-white font-semibold flex items-center gap-1">
                          {item.name} {item.hasBuff && <i className="bi bi-lightning-charge-fill text-amber-400 text-[10px]"></i>}
                        </div>
                        <div className="text-[10px] text-slate-500">x{item.amount}</div>
                        {item.hasBuff && item.buffs && (
                          <div className="mt-1 space-y-1">
                            {item.buffs.map((b, i) => <div key={i} className="text-[10px] text-emerald-400/80 font-medium leading-tight">{b.shortDescription || b}</div>)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right justify-center">
                      <span className="text-[9px] uppercase tracking-wider text-rose-500/70 border border-rose-500/20 px-1.5 py-0.5 rounded">No Trade</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Accordion>

      {/* 5. INVENTORY (MARKET) */}
      <Accordion title="Inventory (Market)" rightContent={`${marketInventory.length} vật phẩm${totalFlower > 0 ? ` - ${totalFlower.toLocaleString('en-US', {maximumFractionDigits: 2})} FLOWER ($${totalUsd.toFixed(2)})` : ''}`}>
        {marketInventory.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-700/50 bg-slate-800/30">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-800/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Name</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3 rounded-tr-lg">Cost Flower</th>
                </tr>
              </thead>
              <tbody>
                {marketInventory.sort((a,b) => b.cost - a.cost).map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20">
                    <td className="px-4 py-3 font-medium text-white flex items-center gap-3">
                      <img src={getAssetUrl(item.name)} alt={item.name} className="w-6 h-6 object-contain" />
                      {item.name}
                    </td>
                    <td className="px-4 py-3">{item.amount.toLocaleString('en-US')}</td>
                    <td className="px-4 py-3 font-mono text-amber-300">
                      {item.cost.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Accordion>

      {/* 5. SKILLS */}
      <Accordion title="Bộ skill" rightContent={`${Object.keys(skills).length} skill`}>
        <SkillsPanel userSkills={skills} />
      </Accordion>
    </div>
  );
};

export default FarmProfileCard;
