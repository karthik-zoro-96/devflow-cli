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
}