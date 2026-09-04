export const getFactionRank = (factionName, points) => {
  if (points === undefined || points === null || !factionName) return { icon: "bi bi-dash text-slate-400", name: "Rookie" };
  const p = parseFloat(points);
  const name = factionName.toLowerCase();

  // Mốc điểm quy định cấp bậc riêng cho từng Faction (Mã nguồn SFL)
  // Bạn có thể tùy chỉnh lại con số min cho chính xác với game hiện tại.
  const thresholds = {
    bumpkins: [
      { min: 10000, icon: "bi bi-chevron-double-up text-purple-400" },
      { min: 5000, icon: "bi bi-chevron-double-up text-blue-400" },
      { min: 2000, icon: "bi bi-chevron-up text-emerald-400" },
      { min: 0, icon: "bi bi-dash-lg text-slate-500" }
    ],
    goblins: [
      { min: 12000, icon: "bi bi-chevron-double-up text-purple-400" },
      { min: 6000, icon: "bi bi-chevron-double-up text-blue-400" },
      { min: 3000, icon: "bi bi-chevron-up text-emerald-400" },
      { min: 0, icon: "bi bi-dash-lg text-slate-500" }
    ],
    sunflorians: [
      { min: 11000, icon: "bi bi-chevron-double-up text-purple-400" },
      { min: 5500, icon: "bi bi-chevron-double-up text-blue-400" },
      { min: 2500, icon: "bi bi-chevron-up text-emerald-400" },
      { min: 0, icon: "bi bi-dash-lg text-slate-500" }
    ],
    nightshades: [
      { min: 11000, icon: "bi bi-chevron-double-up text-purple-400" },
      { min: 5500, icon: "bi bi-chevron-double-up text-blue-400" },
      { min: 2500, icon: "bi bi-chevron-up text-emerald-400" },
      { min: 0, icon: "bi bi-dash-lg text-slate-500" }
    ]
  };

  const factionTiers = thresholds[name] || thresholds['bumpkins'];
  const rank = factionTiers.find(tier => p >= tier.min);
  return rank || factionTiers[factionTiers.length - 1];
};
