import { Command } from 'commander';
import chalk from 'chalk';
import { select, input, confirm } from '@inquirer/prompts';
import { GitService } from '../services/git.js';
import { CopilotService } from '../services/copilot.js';
import { Spinner } from '../utils/spinner.js';

// Force TTY mode for inquirer
process.stdin.isTTY = true;
process.stdout.isTTY = true;

export const commitCommand = new Command('commit')
  .description('Generate AI-powered commit messages using GitHub Copilot CLI')
  .option('-a, --all', 'Stage all changes before committing')
  .action(async (options) => {
    const git = new GitService();
    const copilot = new CopilotService();

    try {
      // Check if we're in a git repo
      if (!(await git.isGitRepo())) {
        console.log(chalk.red('❌ Not a git repository!'));
        process.exit(1);
      }

      // Stage all if --all flag is used
      if (options.all) {
        const spinner = new Spinner('Staging all changes...');
        spinner.start();
        await git.stageAll();
        spinner.succeed('Staged all changes');
      }

      // Check if there are staged changes
      if (!(await git.hasStagedChanges())) {
        console.log(chalk.yellow('⚠️  No staged changes to commit'));
        console.log(chalk.dim('Tip: Use `git add <files>` or `devflow commit --all`'));
        process.exit(0);
      }

      // Get the diff
      const spinner = new Spinner('Analyzing changes...');
      spinner.start();
      const diff = await git.getStagedDiff();
      
      if (!diff) {
        spinner.fail('No changes detected');
        process.exit(0);
      }

      // Generate commit messages using Copilot CLI
      spinner.update('🤖 Asking GitHub Copilot CLI for suggestions...');
      const messages = await copilot.generateCommitMessage(diff);
      spinner.succeed('Generated commit message options');

      // Show options to user
      console.log('\n');
      
      const choices = messages.map((msg, idx) => ({
        name: `${idx + 1}. ${msg}`,
        value: msg
      }));
      
      choices.push({
        name: chalk.dim('✏️  Write custom message'),
        value: '__custom__'
      });

      const selectedMessage = await select({
        message: 'Select a commit message:',
        choices: choices,
        pageSize: 10
      });

      // If custom, ask for message
      let finalMessage = selectedMessage;
      if (selectedMessage === '__custom__') {
        finalMessage = await input({
          message: 'Enter your commit message:',
          validate: (value) => value.length > 0 || 'Commit message cannot be empty'
        });
      }

      // Confirm before committing
      const shouldCommit = await confirm({
        message: `Commit with message: "${finalMessage}"?`,
        default: true
      });

      if (!shouldCommit) {
        console.log(chalk.yellow('❌ Commit cancelled'));
        process.exit(0);
      }

      // Create the commit
      const commitSpinner = new Spinner('Creating commit...');
      commitSpinner.start();
      await git.commit(finalMessage);
      commitSpinner.succeed(chalk.green(`✨ Successfully committed: "${finalMessage}"`));

    } catch (error) {
      console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });