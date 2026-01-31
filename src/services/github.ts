import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigService } from './config';

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

    }


    async init(): Promise<void> {
        try {
            const { stdout } = await execAsync('git remote get-url origin');
            const url = stdout.trim();

            let match;

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
                throw new Error('Could not parse GitHub repository from remote URL');
            }
        } catch (error) {
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
            throw new Error(`Failed to fetch issue: ${error.message}`);
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
        } catch (error) {
            throw new Error(`Failed to create pull request: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

            console.log('Debug - Remote URL:', remoteUrl); // ADD THIS FOR DEBUGGING

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

            throw new Error(`Could not parse GitHub remote URL: ${remoteUrl}`);
        } catch (error) {
            throw new Error('Could not find GitHub remote. Make sure you have a remote named "origin"');
        }
    }
}