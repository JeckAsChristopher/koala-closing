'use strict';

const { program } = require('commander');
const chalk       = require('chalk');
const pkg         = require('../package.json');


const cmds = {
  init:            () => require('./commands/init'),
  build:           () => require('./commands/build'),
  restore:         () => require('./commands/restore'),
  verify:          () => require('./commands/verify'),
  config:          () => require('./commands/config'),
  clean:           () => require('./commands/clean'),
  'generate-license': () => require('./commands/generate-license')
};



function printBanner() {
  console.log('');
  console.log(chalk.bold.cyan('  ##+  ##+ ######+  #####+ ##+      #####+ '));
  console.log(chalk.bold.cyan('  ##| ##++##+===##+##+==##+##|     ##+==##+'));
  console.log(chalk.bold.cyan('  #####++ ##|   ##|#######|##|     #######|'));
  console.log(chalk.bold.cyan('  ##+=##+ ##|   ##|##+==##|##|     ##+==##|'));
  console.log(chalk.bold.cyan('  ##|  ##++######++##|  ##|#######+##|  ##|'));
  console.log(chalk.bold.cyan('  +=+  +=+ +=====+ +=+  +=++======++=+  +=+'));
  console.log('');
  console.log(chalk.bold('  Koala-Closing') + chalk.dim(' v' + pkg.version) + chalk.dim(' -- Node.js Licensing & Obfuscation'));
  console.log('');
}



program
  .name('koala-closing')
  .version(pkg.version)
  .description('Professional Node.js project licensing, encryption, and obfuscation tool')
  .addHelpText('beforeAll', () => { printBanner(); return ''; });

program
  .command('init <project_path>')
  .description('Initialize a project for obfuscation (creates koala.config.json)')
  .action(async (projectPath) => {
    await cmds.init()(projectPath);
  });

program
  .command('generate-license <project_path>')
  .description('Generate a <project>.license file with company/person binding')
  .action(async (projectPath) => {
    await cmds['generate-license']()(projectPath);
  });

program
  .command('build <project_path>')
  .description('Obfuscate, encrypt, and package the project')
  .action(async (projectPath) => {
    await cmds.build()(projectPath);
  });

program
  .command('verify <project_path>')
  .description('Verify SHA-256 hashes, license, and password -- self-deletes if tampered')
  .action(async (projectPath) => {
    await cmds.verify()(projectPath);
  });

program
  .command('restore <obfuscated_path>')
  .description('Restore original source (requires restoreEnabled: true)')
  .action(async (obfuscatedPath) => {
    await cmds.restore()(obfuscatedPath);
  });

program
  .command('config [action] [key] [value]')
  .description('Get/set koala.config.json options (use --path to specify project)')
  .option('-p, --path <dir>', 'project directory', '.')
  .action(async (action, key, value, opts) => {
    await cmds.config()(action, key, value, opts.path);
  });

program
  .command('clean <project_path>')
  .description('Remove temporary and junk files from a project directory')
  .action(async (projectPath) => {
    await cmds.clean()(projectPath);
  });



program.on('command:*', (operands) => {
  console.error(chalk.red(`[error]  Unknown command: ${operands[0]}`));
  console.error(chalk.dim('   Run koala-closing --help for available commands.'));
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error(chalk.red('[error]  Unhandled error: ' + (err && err.message ? err.message : err)));
  process.exit(1);
});

module.exports = { program };
