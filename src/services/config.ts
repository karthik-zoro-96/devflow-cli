import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

export interface DevFlowConfig {
    githubToken?: string;
    copilotModel?: string;
    defaultBaseBranch?: string;
}

export const DEFAULT_COPILOT_MODEL = 'claude-sonnet-4.5';

export class ConfigService {
    private configPath: string;
    private configDir: string;

    constructor() {
        this.configDir = join(homedir(), '.devflow');
        this.configPath = join(this.configDir, 'config.json');
    }

    // Ensure config directory exists
    private ensureConfigDir(): void {
        if (!existsSync(this.configDir)) {
            mkdirSync(this.configDir, { recursive: true });
        }
    }

    // Load config
    load(): DevFlowConfig {
        try {
            if (existsSync(this.configPath)) {
                const data = readFileSync(this.configPath, 'utf-8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.log(chalk.yellow('⚠️  Could not read config file'));
        }
        return {};
    }

    // Save config
    save(config: DevFlowConfig): void {
        try {
            this.ensureConfigDir();
            writeFileSync(this.configPath, JSON.stringify(config, null, 2));

            // Set restrictive permissions (owner read/write only)
            chmodSync(this.configPath, 0o600);
            console.log(chalk.green(`✓ Config saved to ${this.configPath}`));
            console.log(chalk.green(`✓ Config protected with 600 file permissions`));
        } catch (error) {
            console.log(chalk.red('❌ Failed to save config'));
            throw error;
        }
    }

    // Get a specific value
    get(key: keyof DevFlowConfig): string | undefined {
        const config = this.load();
        return config[key];
    }

    // Set a specific value
    set(key: keyof DevFlowConfig, value: string): void {
        const config = this.load();
        config[key] = value;
        this.save(config);
    }

    // Check if token is configured
    hasToken(): boolean {
        const token = this.get('githubToken');
        return !!token && token.length > 0;
    }

    // Get token (from config or env)
    getToken(): string | undefined {
        // Priority: 1. Config file, 2. Environment variable, 3. gh CLI
        const configToken = this.get('githubToken');
        if (configToken) return configToken;

        const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
        if (envToken) return envToken;

        // Try gh CLI
        try {
            const { execSync } = require('child_process');
            return execSync('gh auth token', { encoding: 'utf-8' }).trim();
        } catch {
            return undefined;
        }
    }

    // Get Copilot model preference
    getCopilotModel(): string {
        return this.get('copilotModel') || DEFAULT_COPILOT_MODEL;
    }

    // Display current config
    display(): void {
        const config = this.load();

        console.log(chalk.cyan('\n📋 Current DevFlow Configuration:\n'));
        console.log(chalk.dim('Config file:'), this.configPath);
        console.log('');

        console.log(chalk.bold('GitHub Token:'), config.githubToken ?
            chalk.green('Configured') :
            chalk.yellow('Not set (using environment or gh CLI)'));

        console.log(chalk.bold('Copilot Model:'), config.copilotModel ||
            chalk.dim(`${DEFAULT_COPILOT_MODEL} (default)`));

        console.log(chalk.bold('Default Base Branch:'), config.defaultBaseBranch ||
            chalk.dim('main (default)'));

        console.log('');
    }
}