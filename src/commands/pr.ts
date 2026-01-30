import { Command } from 'commander';
import chalk from 'chalk';
import { select, input, confirm } from '@inquirer/prompts';
import { GitService } from '../services/git.js';
import { GitHubService } from '../services/github.js';
import { CopilotService } from '../services/copilot.js';
import { Spinner } from '../utils/spinner.js';

export const prCommand = new Command('pr')
    .description('Manage pull requests');

prCommand
    .command('create')
    .description('Generate PR description and create pull request using Copilot CLI')
    .option('-b, --base <branch>', 'Base branch (default: main)')
    .option('-i, --issue <number>', 'Related issue number')
    .action(async (options) => {
        const git = new GitService();
        const github = new GitHubService();
        const copilot = new CopilotService();

        try {
            // Check if we're in a git repo
            if (!(await git.isGitRepo())) {
                console.log(chalk.red('❌ Not a git repository!'));
                process.exit(1);
            }

            // Get current branch
            const currentBranch = await git.getCurrentBranch();
            const baseBranch = options.base || await git.getBaseBranch();

            if (currentBranch === baseBranch) {
                console.log(chalk.red(`❌ You're on ${baseBranch}. Create a feature branch first!`));
                console.log(chalk.dim('Tip: Use `git checkout -b feature/my-feature`'));
                process.exit(1);
            }

            const spinner = new Spinner('Checking if branch is on GitHub...');
            spinner.start();

            const isPushed = await git.isBranchPushed(currentBranch);

            if (!isPushed) {
                spinner.update('Pushing branch to GitHub...');
                try {
                    await git.pushBranch(currentBranch);
                    spinner.succeed(`Branch pushed to GitHub: ${currentBranch}`);
                } catch (error) {
                    spinner.fail('Failed to push branch');
                    console.log(chalk.red(`\n❌ Could not push branch: ${(error as Error).message}`));
                    console.log(chalk.yellow(`\nPlease push manually: git push -u origin ${currentBranch}\n`));
                    process.exit(1);
                }
            } else {
                spinner.succeed('Branch already on GitHub');
            }
            console.log(chalk.cyan(`\n🔍 Analyzing branch: ${chalk.bold(currentBranch)}`));
            console.log(chalk.dim(`   Base branch: ${baseBranch}\n`));

            // Get commits

            const commits = await git.getCommitsSinceBase();

            if (commits.length === 0) {
                spinner.fail('No commits found in this branch');
                process.exit(1);
            }

            spinner.succeed(`Found ${commits.length} commit(s)`);

            // Show commits
            console.log(chalk.cyan('\n📝 Commits in this branch:\n'));
            commits.forEach((commit, idx) => {
                console.log(chalk.dim(`  ${idx + 1}. ${commit.hash} - ${commit.message}`));
            });
            console.log('');

            // Get issue context if provided
            let issueContext = '';
            if (options.issue) {
                const issueSpinner = new Spinner(`Fetching issue #${options.issue}...`);
                issueSpinner.start();

                try {
                    const issue = await github.getIssue(parseInt(options.issue));
                    issueContext = `\n\nRelated Issue: #${options.issue} - ${issue.title}\n${issue.body || ''}`;
                    issueSpinner.succeed(`Fetched issue #${options.issue}`);
                } catch (error) {
                    issueSpinner.fail(`Could not fetch issue #${options.issue}`);
                }
            }

            // Generate PR description using Copilot CLI
            const prSpinner = new Spinner('🤖 Generating PR description with Copilot CLI...');
            prSpinner.start();

            const prDescription = await copilot.generatePRDescription(commits, issueContext);
            prSpinner.succeed('Generated PR description');

            // Extract title and body
            const { title, body } = prDescription;

            // Show preview
            console.log(chalk.cyan('\n📄 Generated PR:\n'));
            console.log(chalk.bold('Title:'));
            console.log(chalk.white(`  ${title}\n`));
            console.log(chalk.bold('Description:'));
            console.log(chalk.dim('─'.repeat(60)));
            console.log(body);
            console.log(chalk.dim('─'.repeat(60)));
            console.log('');

            // Ask if user wants to edit
            const shouldEdit = await confirm({
                message: 'Edit title or description?',
                default: false
            });

            let finalTitle = title;
            let finalBody = body;

            if (shouldEdit) {
                const editChoice = await select({
                    message: 'What would you like to edit?',
                    choices: [
                        { name: 'Title', value: 'title' },
                        { name: 'Description', value: 'body' },
                        { name: 'Both', value: 'both' }
                    ]
                });

                if (editChoice === 'title' || editChoice === 'both') {
                    finalTitle = await input({
                        message: 'Enter PR title:',
                        default: title
                    });
                }

                if (editChoice === 'body' || editChoice === 'both') {
                    console.log(chalk.yellow('\n💡 Tip: The description will open in your default editor'));
                    finalBody = await input({
                        message: 'Enter PR description (or press Enter to keep current):',
                        default: body
                    });
                }
            }

            // Confirm creation
            const shouldCreate = await confirm({
                message: `Create PR: "${finalTitle}"?`,
                default: true
            });

            if (!shouldCreate) {
                console.log(chalk.yellow('❌ PR creation cancelled'));
                process.exit(0);
            }

            // Create the PR
            const createSpinner = new Spinner('Creating pull request on GitHub...');
            createSpinner.start();

            const pr = await github.createPullRequest({
                title: finalTitle,
                body: finalBody,
                head: currentBranch,
                base: baseBranch
            });

            createSpinner.succeed(chalk.green(`✨ Pull request created successfully!`));
            console.log(chalk.cyan(`\n🔗 ${pr.html_url}\n`));

        } catch (error) {
            console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            process.exit(1);
        }
    });