import { Command } from 'commander';
import chalk from 'chalk';
import { input, select, confirm, password } from '@inquirer/prompts';
import { ConfigService, DEFAULT_COPILOT_MODEL } from '../services/config.js';
import { CopilotService } from '../services/copilot.js';

export const configCommand = new Command('config')
    .description('Configure DevFlow settings');

// Setup wizard
configCommand
    .command('setup')
    .description('Interactive setup wizard')
    .action(async () => {
        console.log(chalk.cyan('\n✨ DevFlow Setup Wizard\n'));
        console.log(chalk.yellow('🔒 Security Note:'));
        console.log(chalk.dim('Your token will be stored in ~/.devflow/config.json'));
        console.log(chalk.dim('with restricted permissions (600 - owner access only)\n'));

        const config = new ConfigService();
        const currentConfig = config.load();

        try {
            // GitHub Token
            const needsToken = await confirm({
                message: 'Do you want to configure a GitHub token?',
                default: !config.hasToken()
            });

            if (needsToken) {
                const token = await password({
                    message: 'Enter your GitHub Personal Access Token:',
                    mask: '*',
                    validate: (value) => {
                        if (!value) return 'Token cannot be empty';
                        if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
                            return 'Token should start with ghp_ or github_pat_';
                        }
                        return true;
                    }
                });
                config.set('githubToken', token);
            }

            // Copilot Model Selection - fetch available models dynamically
            const copilot = new CopilotService();
            console.log(chalk.dim('Fetching available models from Copilot CLI...\n'));
            const availableModels = await copilot.fetchAvailableModels();

            // Sort: Free first, then Cheap, Balanced, Expensive, New
            const tagOrder: Record<string, number> = {
                'Free': 0, 'Cheap': 1, 'Balanced': 2, 'Expensive': 3, 'New': 4
            };
            const sorted = [...availableModels].sort((a, b) =>
                (tagOrder[a.tag] ?? 99) - (tagOrder[b.tag] ?? 99)
            );

            const tagColor = (tag: string): string => {
                switch (tag) {
                    case 'Free':      return chalk.green(tag);
                    case 'Cheap':     return chalk.cyan(tag);
                    case 'Balanced':  return chalk.yellow(tag);
                    case 'Expensive': return chalk.red(tag);
                    default:          return chalk.dim(tag);
                }
            };

            const model = await select({
                message: 'Select your preferred Copilot model:',
                choices: sorted.map(m => ({
                    name: `${m.id}  ${tagColor(m.tag)}`,
                    value: m.id,
                    description: m.description
                })),
                default: currentConfig.copilotModel || DEFAULT_COPILOT_MODEL
            });
            config.set('copilotModel', model);

            // Default base branch
            const baseBranch = await input({
                message: 'Default base branch:',
                default: currentConfig.defaultBaseBranch || 'main'
            });
            config.set('defaultBaseBranch', baseBranch);

            console.log(chalk.green('\n✓ Setup complete!\n'));
            config.display();

        } catch (error) {
            console.log(chalk.yellow('\n❌ Setup cancelled'));
            process.exit(0);
        }
    });

// Show current config
configCommand
    .command('show')
    .description('Show current configuration')
    .action(() => {
        const config = new ConfigService();
        config.display();
    });

// Keys that should never have their values printed
const SENSITIVE_KEYS = ['githubToken'];

// Set individual values
configCommand
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key, value) => {
        const config = new ConfigService();
        const validKeys = ['githubToken', 'copilotModel', 'defaultBaseBranch'];

        if (!validKeys.includes(key)) {
            console.log(chalk.red(`❌ Invalid key: ${key}`));
            console.log(chalk.dim(`Valid keys: ${validKeys.join(', ')}`));
            process.exit(1);
        }

        config.set(key as any, value);

        if (SENSITIVE_KEYS.includes(key)) {
            console.log(chalk.green(`✓ ${key} updated`));
        } else {
            console.log(chalk.green(`✓ Set ${key} = ${value}`));
        }
    });

// Get individual values
configCommand
    .command('get <key>')
    .description('Get a configuration value')
    .action((key) => {
        const config = new ConfigService();
        const value = config.get(key as any);

        if (!value) {
            console.log(chalk.yellow(`${key} is not set`));
            return;
        }

        if (SENSITIVE_KEYS.includes(key)) {
            console.log(chalk.green('Configured'));
        } else {
            console.log(value);
        }
    });