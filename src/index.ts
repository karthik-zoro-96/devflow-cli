#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { commitCommand } from './commands/commit.js';

const program = new Command();

program
  .name('devflow')
  .description('AI-powered Git workflow automation using GitHub Copilot CLI')
  .version('1.0.0');

// Register commands
program.addCommand(commitCommand);

// Help message
if (process.argv.length === 2) {
  console.log(chalk.cyan('✨ DevFlow - AI-Powered Git Workflow\n'));
  program.help();
}

program.parse(process.argv);