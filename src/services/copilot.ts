import { exec } from 'child_process';
import { unlinkSync, writeFileSync } from 'fs';
import { promisify } from 'util';
import { ConfigService } from './config';

const execAsync = promisify(exec);

export class CopilotService {


  async generateCommitMessage(diff: string): Promise<string[]> {
    try {
      // Simple prompt
      const prompt = `Generate 3 commit messages for these git changes. Use conventional commits format (feat/fix/chore/etc).
  
  Changes:
  ${diff.substring(0, 2000)}
  
  Respond with 3 options:
  1. [first message]
  2. [second message]
  3. [third message]
  
  Keep each under 72 characters.`;

      // Write to temp file to avoid shell escaping issues
      const tmpFile = `/tmp/devflow-commit-${Date.now()}.txt`;
      writeFileSync(tmpFile, prompt);

      const configService = new ConfigService();
      const model = configService.getCopilotModel();

      // Build the command with model flag only if it's not the default
      const modelFlag = model ? `--model ${model}` : '';

      console.log('\n🤖 Calling Copilot CLI...\n');

      // Use --prompt with file input
      const { stdout } = await execAsync(
        `copilot ${modelFlag} --prompt "$(cat ${tmpFile})"`,
        {
          maxBuffer: 1024 * 1024,
          timeout: 30000,
          shell: '/bin/bash'
        }
      );

      // Clean up
      try { unlinkSync(tmpFile); } catch { }

      // Parse messages
      const messages = this.parseCommitMessages(stdout);

      if (messages.length > 0) {
        return messages;
      }

      return this.generateFallbackMessages(diff);

    } catch (error) {
      console.log('⚠️ Copilot error:', (error as Error).message);
      return this.generateFallbackMessages(diff);
    }
  }

  private stripMarkdown(text: string): string {
    return text
      .replace(/\*\*/g, '')  // Remove bold **
      .replace(/\*/g, '')    // Remove italic *
      .replace(/`/g, '')     // Remove code `
      .replace(/^[-•]\s+/, '') // Remove list markers
      .trim();
  }

  private parseCommitMessages(response: string): string[] {
    const messages: string[] = [];

    // Split by lines
    const lines = response
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    for (const line of lines) {
      // Try multiple patterns

      // Pattern 1: "1. message" or "1) message"
      let match = line.match(/^\d+[\.)]\s*(.+)$/);
      if (match) {
        messages.push(this.stripMarkdown(match[1].trim()));
        continue;
      }

      // Pattern 2: Direct conventional commit format
      match = line.match(/^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+?\))?: .+/i);
      if (match) {
        messages.push(this.stripMarkdown(line));
        continue;
      }

      // Pattern 3: "- message" (markdown list)
      match = line.match(/^[-*]\s+(.+)$/);
      if (match && match[1].match(/^(feat|fix|docs|style|refactor|test|chore)/i)) {
        messages.push(this.stripMarkdown(match[1].trim()));
        continue;
      }
    }

    return messages.slice(0, 3);
  }

  private generateFallbackMessages(diff: string): string[] {
    const lines = diff.split('\n');
    const added = lines.filter(l => l.startsWith('+')).length;
    const removed = lines.filter(l => l.startsWith('-')).length;

    return [
      `feat: update files (+${added} -${removed})`,
      `fix: improve code quality`,
      `chore: update documentation`
    ];
  }

  async generatePRDescription(
    commits: Array<{ hash: string; message: string; author: string; date: string }>,
    issueContext: string = ''
  ): Promise<{ title: string; body: string }> {
    try {
      const commitList = commits.map(c => `- ${c.message}`).join('\n');

      // Shorter, simpler prompt
      const prompt = `Generate a PR title and description for these commits:\n${commitList}\n\nFormat:\nTITLE: [title]\nBODY:\n[description]`;

      console.log('\n🤖 Asking Copilot CLI...\n');

      // Use --prompt flag (non-interactive)
      const escapedPrompt = prompt
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');

      const { stdout, stderr } = await execAsync(
        `copilot --prompt "${escapedPrompt}"`,
        {
          maxBuffer: 1024 * 1024,
          timeout: 30000,
          shell: '/bin/bash'
        }
      );

      console.log('Raw response:');
      console.log(stdout);
      console.log('---\n');

      if (stderr) {
        console.log('Stderr:', stderr);
      }

      // Parse response
      const parsed = this.parsePRDescription(stdout);

      if (parsed.title && parsed.body && parsed.body.length > 50) {
        return parsed;
      }

      // If parsing gave weak results, use fallback
      console.log('⚠️ Weak response, using fallback\n');
      return this.generateSmartFallback(commits, issueContext);

    } catch (error) {
      console.log('⚠️ Copilot error:', (error as Error).message);
      console.log('Using smart fallback\n');
      return this.generateSmartFallback(commits, issueContext);
    }
  }

  private generateSmartFallback(
    commits: Array<{ hash: string; message: string }>,
    issueContext: string
  ): { title: string; body: string } {
    // Use first commit as title if it's good
    const title = commits[0]?.message || 'Update';

    // Group commits by type
    const features = commits.filter(c => c.message.startsWith('feat'));
    const fixes = commits.filter(c => c.message.startsWith('fix'));
    const chores = commits.filter(c => c.message.startsWith('chore'));
    const others = commits.filter(c => !c.message.match(/^(feat|fix|chore)/));

    let body = '## Summary\n\n';

    if (commits.length === 1) {
      body += commits[0].message;
    } else {
      body += `This PR includes ${commits.length} commits with `;
      const types = [];
      if (features.length) types.push(`${features.length} feature(s)`);
      if (fixes.length) types.push(`${fixes.length} fix(es)`);
      if (chores.length) types.push(`${chores.length} chore(s)`);
      body += types.join(', ') || 'various changes';
      body += '.';
    }

    body += '\n\n## Changes\n\n';

    if (features.length) {
      body += '### Features\n';
      features.forEach(c => body += `- ${c.message}\n`);
      body += '\n';
    }

    if (fixes.length) {
      body += '### Fixes\n';
      fixes.forEach(c => body += `- ${c.message}\n`);
      body += '\n';
    }

    if (chores.length) {
      body += '### Chores\n';
      chores.forEach(c => body += `- ${c.message}\n`);
      body += '\n';
    }

    if (others.length) {
      body += '### Other Changes\n';
      others.forEach(c => body += `- ${c.message}\n`);
      body += '\n';
    }

    if (issueContext) {
      body += `\n${issueContext}\n`;
    }

    body += '\n## Testing\n\nPlease test these changes in your environment.\n';

    return { title, body };
  }
  private parsePRDescription(response: string): { title: string; body: string } {
    // Try to extract title and body
    const titleMatch = response.match(/TITLE:\s*(.+)/i);
    const bodyMatch = response.match(/BODY:\s*([\s\S]+)/i);

    if (titleMatch && bodyMatch) {
      return {
        title: this.stripMarkdown(titleMatch[1].trim()),
        body: bodyMatch[1].trim()
      };
    }

    // If parsing fails, use first line as title, rest as body
    const lines = response.split('\n').filter(l => l.trim().length > 0);
    return {
      title: this.stripMarkdown(lines[0] || 'Update'),
      body: lines.slice(1).join('\n') || 'Pull request description'
    };
  }

  private generateFallbackPR(
    commits: Array<{ hash: string; message: string }>,
    issueContext: string
  ): { title: string; body: string } {
    const title = commits[0]?.message || 'Update code';

    const body = `## Summary
This PR includes ${commits.length} commit(s).

## Changes
${commits.map(c => `- ${c.message}`).join('\n')}

${issueContext ? `## Related Issues\n${issueContext}` : ''}

## Testing
Please test the changes thoroughly.`;

    return { title, body };
  }

  async generateBranchName(
    description: string,
    type: string = 'feature',
    issueNumber?: string
  ): Promise<string> {
    try {
      const issuePrefix = issueNumber ? `${issueNumber}-` : '';

      const prompt = `Generate a git branch name from this description: "${description}"
  
  Branch type: ${type}
  ${issueNumber ? `Issue number: ${issueNumber}` : ''}
  
  Rules:
  - Use format: ${type}/${issuePrefix}[descriptive-name]
  - Use kebab-case (lowercase with hyphens)
  - Keep it concise (max 50 chars)
  - Be descriptive but brief
  - Only alphanumeric and hyphens
  
  Example: feature/123-add-user-auth
  
  Respond with ONLY the branch name, nothing else.`;

      // Write to temp file
      const tmpFile = `/tmp/devflow-branch-${Date.now()}.txt`;
      writeFileSync(tmpFile, prompt);

      // console.log('🤖 Asking Copilot...\n');

      const configService = new ConfigService();
      const model = configService.getCopilotModel();

      const { stdout } = await execAsync(
        `copilot --model ${model} --prompt "$(cat ${tmpFile})"`,
        {
          maxBuffer: 1024 * 1024,
          timeout: 30000,
          shell: '/bin/bash'
        }
      );

      // Clean up
      try { unlinkSync(tmpFile); } catch { }

      // Parse the branch name from response
      let branchName = stdout.trim().split('\n')[0].trim();

      // Remove any markdown formatting
      branchName = branchName.replace(/```/g, '').replace(/`/g, '').trim();

      // Remove quotes if present
      branchName = branchName.replace(/^["']|["']$/g, '');

      // Validate and sanitize
      branchName = this.sanitizeBranchName(branchName, type, issuePrefix);

      return branchName;

    } catch (error) {
      console.log('⚠️ Copilot error, generating fallback branch name', error);
      return this.generateFallbackBranchName(description, type, issueNumber);
    }
  }

  // Sanitize branch name
  private sanitizeBranchName(name: string, type: string, issuePrefix: string): string {
    // Remove type prefix if Copilot added it
    name = name.replace(new RegExp(`^${type}/`, 'i'), '');

    // Convert to lowercase and replace spaces/special chars with hyphens
    name = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Limit length
    const maxLength = 50 - type.length - issuePrefix.length - 1;
    if (name.length > maxLength) {
      name = name.substring(0, maxLength).replace(/-$/, '');
    }

    return `${type}/${issuePrefix}${name}`;
  }

  // Fallback branch name generation
  private generateFallbackBranchName(
    description: string,
    type: string,
    issueNumber?: string
  ): string {
    const issuePrefix = issueNumber ? `${issueNumber}-` : '';

    // Convert description to kebab-case
    let name = description
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Limit length
    const maxLength = 50 - type.length - issuePrefix.length - 1;
    if (name.length > maxLength) {
      name = name.substring(0, maxLength).replace(/-$/, '');
    }

    return `${type}/${issuePrefix}${name}`;
  }
}