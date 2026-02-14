import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigService } from './config';
import chalk from 'chalk';

const execAsync = promisify(exec);

export interface GitHubIssue {
    number: number;
    title: string;
    body: string | null;
    state: string;
    labels: string[];
    html_url: string;
}

export class GitHubService {
    private octokit: Octokit;
    private owner: string = '';
    private repo: string = '';

    constructor() {
        // Get token from environment
        // Try multiple sources for token
        const configService = new ConfigService();
        const token = configService.getToken();
        if (!token) {
            throw new Error('GitHub token not found. Either:\n  1. Set GITHUB_TOKEN in .env\n  2. Run: gh auth login');

        }

        this.octokit = new Octokit({ auth: token });

        try {
            const { owner, repo } = this.parseRemoteUrl();
            console.log(chalk.dim(`✓ Connected to ${owner}/${repo}`));
        } catch (parseError) {
            throw new Error('Not a GitHub repository or no remote configured');
        }

    }


    async init(): Promise<void> {
        try {
            const { stdout } = await execAsync('git remote get-url origin');
            const url = stdout.trim();

            let match;

            // Try SSH format with custom host: git@github-personal:user/repo.git
            match = url.match(/git@([^:]+):(.+?)\/(.+?)(\.git)?$/);

            if (match) {
                this.owner = match[2];
                this.repo = match[3].replace('.git', '');
                console.log(chalk.green('✓ Parsed:'), `${this.owner}/${this.repo}`);
                return;
            }
            // Try SSH format: git@github.com:user/repo.git
            match = url.match(/git@github\.com:(.+?)\/(.+?)(\.git)?$/);

            if (!match) {
                // Try HTTPS format: https://github.com/user/repo.git
                match = url.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
            }

            if (match) {
                this.owner = match[1];
                this.repo = match[2].replace('.git', '');
            } else {
                throw new Error('Could not parse GitHub repository from remote URL. Supported formats: SSH or HTTPS.');
            }
        } catch (error) {
            if (error instanceof Error && error.message.startsWith('Could not parse')) {
                throw error;
            }
            throw new Error('Not a GitHub repository or no remote configured');
        }
    }

    // Get issue details
    async getIssue(issueNumber: number): Promise<GitHubIssue> {
        try {
            const { owner, repo } = this.parseRemoteUrl();

            const { data } = await this.octokit.rest.issues.get({
                owner,
                repo,
                issue_number: issueNumber
            });

            return {
                number: data.number,
                title: data.title ?? null,
                body: data.body ?? null,
                state: data.state,
                labels: data.labels.map((label: any) =>
                    typeof label === 'string' ? label : label.name
                ),
                html_url: data.html_url
            };
        } catch (error: any) {
            if (error.status === 404) {
                throw new Error(`Issue #${issueNumber} not found`);
            }
            if (error.status === 401 || error.status === 403) {
                throw new Error('GitHub authentication failed. Check your token with: devflow config setup');
            }
            throw new Error(`Failed to fetch issue #${issueNumber} (HTTP ${error.status || 'unknown'})`);
        }
    }
    // Create a pull request
    async createPullRequest(params: {
        title: string;
        body: string;
        head: string;
        base: string;
    }) {
        await this.init();

        try {
            const { data } = await this.octokit.pulls.create({
                owner: this.owner,
                repo: this.repo,
                title: params.title,
                body: params.body,
                head: params.head,
                base: params.base
            });

            return data;
        } catch (error: any) {
            if (error.status === 401 || error.status === 403) {
                throw new Error('GitHub authentication failed. Check your token with: devflow config setup');
            }
            if (error.status === 422) {
                throw new Error('Failed to create pull request. A PR may already exist for this branch, or the branch has no changes.');
            }
            throw new Error(`Failed to create pull request (HTTP ${error.status || 'unknown'})`);
        }
    }

    // Get repo info
    getRepoInfo() {
        return { owner: this.owner, repo: this.repo };
    }

    private parseRemoteUrl(): { owner: string; repo: string } {
        try {
            const { execSync } = require('child_process');
            const remoteUrl = execSync('git config --get remote.origin.url', {
                encoding: 'utf-8'
            }).trim();


            // Handle SSH format with custom host: git@github-personal:owner/repo.git
            const sshCustomMatch = remoteUrl.match(/git@([^:]+):(.+?)\/(.+?)(\.git)?$/);
            if (sshCustomMatch) {
                return {
                    owner: sshCustomMatch[2],
                    repo: sshCustomMatch[3]
                };
            }

            // Handle SSH format: git@github.com:owner/repo.git
            const sshMatch = remoteUrl.match(/git@github\.com:(.+?)\/(.+?)(\.git)?$/);
            if (sshMatch) {
                return {
                    owner: sshMatch[1],
                    repo: sshMatch[2]
                };
            }

            // Handle HTTPS format: https://github.com/owner/repo.git
            const httpsMatch = remoteUrl.match(/github\.com\/(.+?)\/(.+?)(\.git)?$/);
            if (httpsMatch) {
                return {
                    owner: httpsMatch[1],
                    repo: httpsMatch[2]
                };
            }

            throw new Error('Could not parse GitHub remote URL. Supported formats: SSH (git@github.com:owner/repo) or HTTPS (https://github.com/owner/repo)');
        } catch (error) {
            throw new Error('Could not find GitHub remote. Make sure you have a remote named "origin"');
        }
    }
}