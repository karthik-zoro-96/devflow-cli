import { Command } from 'commander';
import chalk from 'chalk';
import { input, select, confirm } from '@inquirer/prompts';
import { GitService } from '../services/git.js';
import { GitHubService } from '../services/github.js';
import { CopilotService } from '../services/copilot.js';
import { Spinner } from '../utils/spinner.js';

export const branchCommand = new Command('branch')
    .description('Branch management commands');

// Create branch command
branchCommand
    .command('create [description]')
    .description('Create a new branch with AI-generated name')
    .option('-i, --issue <number>', 'Create branch from GitHub issue number')
    .option('-t, --type <type>', 'Branch type (feature/fix/chore/docs)', 'feature')
    .action(async (description?: string, options?: { issue?: string; type?: string }) => {
        try {
            const git = new GitService();
            const github = new GitHubService();
            await github.init();
            const copilot = new CopilotService();

            // Check if we're in a git repository
            const isRepo = await git.isGitRepo();
            if (!isRepo) {
                console.log(chalk.red('❌ Not a git repository'));
                console.log(chalk.dim('Run: git init'));
                process.exit(1);
            }

            let branchDescription = description;
            let branchType = options?.type || 'feature';

            // Scenario 1: Create from GitHub issue
            if (options?.issue) {
                console.log(chalk.cyan(`\n🔍 Fetching issue #${options.issue}...\n`));

                const spinner = new Spinner('Fetching issue from GitHub...');
                spinner.start();

                try {
                    const issue = await github.getIssue(parseInt(options.issue));
                    spinner.succeed(`Found issue: ${issue.title}`);

                    branchDescription = issue.title;
                    console.log(chalk.dim(`\nIssue: ${issue.title}\n`));

                    // Ask for confirmation
                    const useIssue = await confirm({
                        message: 'Use this issue title for branch name?',
                        default: true
                    });

                    if (!useIssue) {
                        branchDescription = await input({
                            message: 'Enter branch description:',
                            validate: (value) => value.length > 0 || 'Description cannot be empty'
                        });
                    }
                } catch (error) {
                    spinner.fail('Failed to fetch issue');
                    const safeMsg = error instanceof Error ? error.message : 'Could not fetch issue';
                    console.log(chalk.red(`\n❌ ${safeMsg}\n`));
                    process.exit(1);
                }
            }

            // Scenario 2: No description provided - prompt user
            if (!branchDescription) {
                console.log(chalk.cyan('\n🌿 Create New Branch\n'));

                branchType = await select({
                    message: 'Branch type:',
                    choices: [
                        { name: 'feature - New feature', value: 'feature' },
                        { name: 'fix - Bug fix', value: 'fix' },
                        { name: 'chore - Maintenance', value: 'chore' },
                        { name: 'docs - Documentation', value: 'docs' },
                        { name: 'refactor - Code refactoring', value: 'refactor' }
                    ]
                });

                branchDescription = await input({
                    message: 'Branch description:',
                    validate: (value) => value.length > 0 || 'Description cannot be empty'
                });
            }

            // Generate branch name with Copilot
            console.log(chalk.cyan('\n🤖 Generating branch name...\n'));

            const spinner = new Spinner('Asking Copilot for branch name...');
            spinner.start();

            const branchName = await copilot.generateBranchName(
                branchDescription!,
                branchType,
                options?.issue
            );

            spinner.succeed('Branch name generated');

            // Show generated name and confirm
            console.log(chalk.cyan('\n📝 Generated branch name:'));
            console.log(chalk.bold(`   ${branchName}\n`));

            const shouldCreate = await confirm({
                message: `Create and checkout branch "${branchName}"?`,
                default: true
            });

            if (!shouldCreate) {
                console.log(chalk.yellow('❌ Branch creation cancelled'));
                process.exit(0);
            }

            // Create and checkout branch
            const createSpinner = new Spinner('Creating branch...');
            createSpinner.start();

            await git.createAndCheckoutBranch(branchName);

            createSpinner.succeed(`Switched to new branch: ${branchName}`);

            console.log(chalk.green(`\n✨ Successfully created branch: ${chalk.bold(branchName)}\n`));

        } catch (error) {
            const safeMsg = error instanceof Error ? error.message : 'Something went wrong';
            console.log(chalk.red(`\n❌ ${safeMsg}\n`));
            process.exit(1);
        }
    });