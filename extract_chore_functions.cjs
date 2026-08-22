const { Project } = require('ts-morph');
const fs = require('fs');

const project = new Project();
const sourceFile = project.addSourceFileAtPath('d:/sunflower-land/src/features/game/types/choreBoard.ts');

const npcChoresDec = sourceFile.getVariableDeclaration('NPC_CHORES');
let initializer = npcChoresDec.getInitializer();

if (initializer.getKindName() === 'SatisfiesExpression') {
  initializer = initializer.getExpression();
}

let functionsOutput = `// Auto-generated from sunflower-land choreBoard.ts\n`;
functionsOutput += `module.exports = {\n`;

if (initializer.getKindName() === 'ObjectLiteralExpression') {
  for (const property of initializer.getProperties()) {
    if (property.getKindName() === 'PropertyAssignment') {
      let choreName = property.getName();
      choreName = choreName.replace(/^["'](.+)["']$/, '$1');

      const value = property.getInitializer();
      
      if (value.getKindName() === 'CallExpression') {
         const args = value.getArguments();
         if (args.length > 0 && args[0].getKindName() === 'ObjectLiteralExpression') {
            let activity = null;
            let amount = 1;
            let type = value.getExpression().getText();
            
            for (const prop of args[0].getProperties()) {
                if (prop.getName() === 'activity') {
                    activity = prop.getInitializer().getText().replace(/^["'](.+)["']$/, '$1');
                } else if (prop.getName() === 'amount') {
                    amount = prop.getInitializer().getText();
                }
            }
            if (activity) {
                if (type === 'farmActivityTask') {
                   functionsOutput += `  "${choreName}": { requirement: ${amount}, progress: (game) => game.farmActivity?.["${activity}"] || 0 },\n`;
                } else if (type === 'bumpkinActivityTask') {
                   functionsOutput += `  "${choreName}": { requirement: ${amount}, progress: (game) => game.bumpkin?.activity?.["${activity}"] || 0 },\n`;
                }
            }
         }
      } 
      else if (value.getKindName() === 'ObjectLiteralExpression') {
         const progressProp = value.getProperty('progress');
         const reqProp = value.getProperty('requirement');
         
         if (progressProp && progressProp.getKindName() === 'PropertyAssignment' && reqProp) {
             let text = progressProp.getInitializer().getText();
             let reqText = reqProp.getInitializer().getText();
             text = text.replace(/\(game[^)]*\)/g, '(game)');
             
             functionsOutput += `  "${choreName}": { requirement: ${reqText}, progress: ${text} },\n`;
         }
      }
    }
  }
}

functionsOutput += `};\n`;

fs.writeFileSync('src-backend/utils/choreFunctions.cjs', functionsOutput);
console.log('Successfully generated src-backend/utils/choreFunctions.cjs');
