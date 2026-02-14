#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { commitCommand } from './commands/commit.js';
import { prCommand } from './commands/pr.js';
import { configCommand } from './commands/config.js';
import { ConfigService } from './services/config.js';
import { branchCommand } from './commands/branch.js';

const program = new Command();

program
  .name('devflow')
  .description('AI-powered Git workflow automation using GitHub Copilot CLI')
  .version('1.0.0');

// Check if first run and suggest setup
const checkFirstRun = () => {
  // Skip if running config command
  if (process.argv[2] === 'config') return;

  const config = new ConfigService();
  const currentConfig = config.load();

  // If no config at all, strongly suggest setup
  if (Object.keys(currentConfig).length === 0) {
    console.log(chalk.red('❌ No configuration found!\n'));
    console.log(chalk.yellow('Please run: ') + chalk.cyan('devflow config setup\n'));
    process.exit(1);  // ADD THIS - exit immediately
  }
};

// Check before running any command
checkFirstRun();

// Register commands
program.addCommand(commitCommand);
program.addCommand(prCommand);
program.addCommand(configCommand);
program.addCommand(branchCommand);

// Help message
if (process.argv.length === 2) {
  console.log(chalk.cyan('✨ DevFlow - AI-Powered Git Workflow\n'));
  program.help();
}

program.parse(process.argv);
