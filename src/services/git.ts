import simpleGit, { SimpleGit } from 'simple-git';

export class GitService {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit();
  }

  // Check if we're in a git repository
  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  // Get staged changes (git diff --cached)
  async getStagedDiff(): Promise<string> {
    try {
      const diff = await this.git.diff(['--cached']);
      return diff;
    } catch (error) {
      throw new Error('Failed to get staged changes');
    }
  }

  // Get status
  async getStatus() {
    return await this.git.status();
  }

  // Stage all changes
  async stageAll(): Promise<void> {
    await this.git.add('.');
  }

  // Create commit
  async commit(message: string): Promise<void> {
    await this.git.commit(message);
  }

  // Check if there are staged changes
  async hasStagedChanges(): Promise<boolean> {
    const status = await this.getStatus();
    return status.staged.length > 0;
  }

  // Get current branch name
  async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || 'main';
  }

  // Get base branch (usually main or master)
  async getBaseBranch(): Promise<string> {
    try {
      // Try to find main first
      await this.git.raw(['rev-parse', '--verify', 'main']);
      return 'main';
    } catch {
      try {
        // Fall back to master
        await this.git.raw(['rev-parse', '--verify', 'master']);
        return 'master';
      } catch {
        return 'main'; // Default to main
      }
    }
  }

  // Get commits in current branch (not in base branch)
  async getCommitsSinceBase(): Promise<Array<{ hash: string; message: string; author: string; date: string }>> {
    const currentBranch = await this.getCurrentBranch();
    const baseBranch = await this.getBaseBranch();

    try {
      const log = await this.git.log({
        from: baseBranch,
        to: currentBranch
      });

      return log.all.map(commit => ({
        hash: commit.hash.substring(0, 7),
        message: commit.message,
        author: commit.author_name,
        date: commit.date
      }));
    } catch (error) {
      throw new Error('Failed to get commit history');
    }
  }

  // Extract issue number from branch name or commits
  extractIssueNumber(): number | null {
    // Try to extract from branch name (e.g., feature/add-auth-123)
    const branchMatch = this.git.branch().then(b => b.current?.match(/-(\d+)$/));
    // For now, return null (we'll enhance this later)
    return null;
  }

  // Check if current branch exists on remote
  async isBranchPushed(branchName: string): Promise<boolean> {
    try {
      const result = await this.git.raw(['ls-remote', '--heads', 'origin', branchName]);
      return result.trim().length > 0;
    } catch {
      return false;
    }
  }

  // Push current branch to remote
  async pushBranch(branchName: string): Promise<void> {
    await this.git.push('origin', branchName, ['--set-upstream']);
  }

}