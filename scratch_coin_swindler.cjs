fetch('https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/bumpkinSkills.ts').then(r=>r.text()).then(t => {
  const match = t.match(/"Coin Swindler"[\s\S]*?\}/);
  if (match) console.log(match[0]);
});
