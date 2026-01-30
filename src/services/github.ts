import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitHubService {
  private octokit: Octokit;
  private owner: string = '';
  private repo: string = '';

  constructor() {
    // Get token from environment
    // Try multiple sources for token
    let token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    
    // If no token in env, try to get from gh CLI
    if (!token) {
      try {
        const { execSync } = require('child_process');
        token = execSync('gh auth token', { encoding: 'utf-8' }).trim();
      } catch {
        throw new Error('GitHub token not found. Either:\n  1. Set GITHUB_TOKEN in .env\n  2. Run: gh auth login');
      }
    }

    this.octokit = new Octokit({ auth: token });
    
  }

  // Initialize repo info from git remote
// Initialize repo info from git remote
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
  async getIssue(issueNumber: number) {
    await this.init();
    
    try {
      const { data } = await this.octokit.issues.get({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber
      });
      
      return data;
    } catch (error) {
      throw new Error(`Failed to fetch issue #${issueNumber}`);
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
}