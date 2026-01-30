#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { commitCommand } from './commands/commit.js';
import { prCommand } from './commands/pr.js';  // ADD THIS

const program = new Command();

import 'dotenv/config';  // ADD THIS LINE - loads .env automatically

program
  .name('devflow')
  .description('AI-powered Git workflow automation using GitHub Copilot CLI')
  .version('1.0.0');

// Register commands
program.addCommand(commitCommand);
program.addCommand(prCommand);  // ADD THIS

// Help message
if (process.argv.length === 2) {
  console.log(chalk.cyan('✨ DevFlow - AI-Powered Git Workflow\n'));
  program.help();
}

program.parse(process.argv);