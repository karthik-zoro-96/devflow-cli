import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { ConfigService } from './config';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

/** Models that are included with paid plans and don't consume premium requests. */
const FREE_MODELS = ['gpt-4.1', 'gpt-5-mini'];
const FREE_FALLBACK_MODEL = FREE_MODELS[0];

/** Patterns that indicate the user has exceeded their premium request quota. */
const QUOTA_ERROR_PATTERNS = [
  /premium request/i,
  /rate limit/i,
  /quota/i,
  /exceeded.*allowance/i,
  /budget.*reached/i,
  /limit.*reached/i,
  /too many requests/i,
  /429/,
];

export interface ModelInfo {
  id: string;
  tag: string;        // Short badge shown next to model name
  description: string; // One-line plain-English summary
}

/**
 * Model metadata sourced from GitHub Docs premium request multipliers:
 * https://docs.github.com/en/copilot/reference/ai-models/supported-models#model-multipliers
 *
 * Maps CLI model IDs to user-friendly descriptions.
 */
interface ModelMeta {
  tag: string;
  description: string;
  multiplier: number;  // premium requests consumed per prompt (0 = free)
}

const MODEL_CATALOG: Record<string, ModelMeta> = {
  // Free / included models
  'gpt-4.1': { tag: 'Free', description: 'Included with your plan, no extra cost', multiplier: 0 },
  'gpt-5-mini': { tag: 'Free', description: 'Included with your plan, fast and lightweight', multiplier: 0 },

  // Cheap & fast
  'claude-haiku-4.5': { tag: 'Cheap', description: 'Fastest responses, very low cost', multiplier: 0.33 },
  'gpt-5.1-codex-mini': { tag: 'Cheap', description: 'Fast code generation, very low cost', multiplier: 0.33 },

  // Balanced
  'claude-sonnet-4': { tag: 'Balanced', description: 'Good quality, standard cost', multiplier: 1 },
  'claude-sonnet-4.5': { tag: 'Balanced', description: 'Great quality and speed, recommended', multiplier: 1 },
  'gpt-5': { tag: 'Balanced', description: 'Solid all-rounder, standard cost', multiplier: 1 },
  'gpt-5.1': { tag: 'Balanced', description: 'Latest GPT, good quality, standard cost', multiplier: 1 },
  'gpt-5.1-codex': { tag: 'Balanced', description: 'Optimized for code, standard cost', multiplier: 1 },
  'gpt-5.1-codex-max': { tag: 'Balanced', description: 'Max context for code, standard cost', multiplier: 1 },
  'gpt-5.2': { tag: 'Balanced', description: 'Newest GPT, standard cost', multiplier: 1 },
  'gpt-5.2-codex': { tag: 'Balanced', description: 'Newest GPT for code, standard cost', multiplier: 1 },
  'gemini-3-pro-preview': { tag: 'Balanced', description: 'Google model, good for general tasks', multiplier: 1 },

  // Expensive / highest quality
  'claude-opus-4.5': { tag: 'Expensive', description: 'Best quality, slowest, costs 3x per prompt', multiplier: 3 },
};

export class CopilotService {

  /**
   * Fetches available models from the Copilot CLI by parsing `copilot --help` output,
   * enriched with cost/multiplier metadata from GitHub's published rates.
   * Falls back to a minimal hardcoded list if the CLI is unavailable or parsing fails.
   */
  async fetchAvailableModels(): Promise<ModelInfo[]> {
    let modelIds: string[];

    try {
      const { stdout } = await execAsync('copilot --help', {
        timeout: 10000,
        shell: '/bin/bash'
      });

      // Extract model choices from the --model flag description
      // Format: --model <model>  Set the AI model to use (choices: "model1", "model2", ...)
      const modelSection = stdout.match(/--model\s+<model>\s+[\s\S]*?\(choices:\s*([\s\S]*?)\)/);
      if (modelSection) {
        const parsed = modelSection[1]
          .match(/"([^"]+)"/g)
          ?.map(m => m.replace(/"/g, ''));

        modelIds = parsed && parsed.length > 0 ? parsed : this.getFallbackModelIds();
      } else {
        modelIds = this.getFallbackModelIds();
      }
    } catch {
      modelIds = this.getFallbackModelIds();
    }

    return modelIds.map(id => {
      const info = MODEL_CATALOG[id];
      return {
        id,
        tag: info?.tag ?? 'New',
        description: info?.description ?? 'Recently added model',
      };
    });
  }

  private getFallbackModelIds(): string[] {
    return [
      'claude-sonnet-4.5',
      'claude-haiku-4.5',
      'gpt-4.1'
    ];
  }

  /**
   * Prints the model name and its cost before a Copilot call.
   */
  private printModelCost(model: string): void {
    const meta = MODEL_CATALOG[model];
    const tag = meta?.tag ?? 'Unknown';
    const multiplier = meta?.multiplier;

    let costStr: string;
    if (multiplier === 0) costStr = chalk.green('free, no premium requests used');
    else if (multiplier !== undefined) costStr = chalk.yellow(`${multiplier} premium request(s) per prompt`);
    else costStr = chalk.dim('unknown cost');

    const tagColor =
      tag === 'Free' ? chalk.green(tag) :
        tag === 'Cheap' ? chalk.cyan(tag) :
          tag === 'Balanced' ? chalk.yellow(tag) :
            tag === 'Expensive' ? chalk.red(tag) :
              chalk.dim(tag);

    console.log(`🤖 Model: ${chalk.bold(model)}  ${tagColor}  ·  ${costStr}`);
  }

  /**
   * Checks whether an error from the Copilot CLI looks like a quota/rate-limit issue.
   */
  private isQuotaError(error: Error): boolean {
    const msg = error.message || '';
    return QUOTA_ERROR_PATTERNS.some(p => p.test(msg));
  }

  /**
   * Prints a user-friendly warning when quota is exceeded and we're retrying
   * with a free model.
   */
  private printQuotaWarning(currentModel: string): void {
    console.log('');
    console.log(chalk.yellow('⚠️  Premium request limit reached for ') + chalk.bold(currentModel));
    console.log(chalk.dim('   Your monthly quota may be exhausted or the model is rate-limited.'));
    console.log(chalk.cyan(`   Retrying with ${FREE_FALLBACK_MODEL} (free, no premium requests)...\n`));
    this.printModelCost(FREE_FALLBACK_MODEL);
  }

  /**
   * Prints a tip after a successful free-model retry so the user knows
   * how to permanently switch.
   */
  private printSwitchTip(): void {
    console.log(chalk.dim(`\n   Tip: To avoid this, switch your default model:`));
    console.log(chalk.dim(`   Run: `) + chalk.cyan('devflow config setup') + chalk.dim(' and pick a Free model.\n'));
  }

  /**
   * Reads the most recent Copilot CLI log file and extracts error lines.
   * Returns a brief, safe diagnostic string, or undefined if nothing useful found.
   */
  private readLatestCopilotLog(): string | undefined {
    try {
      const logDir = join(homedir(), '.copilot', 'logs');
      const files = readdirSync(logDir)
        .filter(f => f.startsWith('process-') && f.endsWith('.log'))
        .sort()    // alphabetical sort on timestamp-based names => latest last
        .reverse();

      if (files.length === 0) return undefined;

      const content = readFileSync(join(logDir, files[0]), 'utf-8');
      const errorLines = content
        .split('\n')
        .filter(line => /\[ERROR\]/.test(line))
        .map(line => line.replace(/.*\[ERROR\]\s*/, '').trim())
        .filter(line => line.length > 0);

      if (errorLines.length === 0) return undefined;

      // Look for the most informative error
      const modelError = errorLines.find(l => /failed to list models/i.test(l));
      if (modelError) {
        const statusMatch = modelError.match(/(\d{3})\s*$/);
        const status = statusMatch ? statusMatch[1] : '';
        if (status === '403') {
          return 'Copilot access denied (403). Your subscription may have expired or your authentication needs refreshing. Run: copilot auth login';
        }
        if (status === '401') {
          return 'Copilot authentication failed (401). Run: copilot auth login';
        }
        return `Copilot model loading failed: ${modelError}`;
      }

      // Return last error line (sanitized)
      const last = errorLines[errorLines.length - 1];
      const sanitized = last.replace(/ghp_[a-zA-Z0-9]+|gho_[a-zA-Z0-9]+|github_pat_[a-zA-Z0-9_]+/g, '***');
      return sanitized.length < 200 ? sanitized : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Runs a prompt against the Copilot CLI with the given model.
   * Returns stdout on success, or throws on failure.
   */
  private async execCopilotPrompt(prompt: string, model: string): Promise<string> {
    try {
      // Build args array — passed directly to the binary, no shell interpretation.
      // This avoids issues with $, backticks, quotes etc. in diff content.
      const args: string[] = [];
      if (model) {
        args.push('--model', model);
      }
      args.push('-s', '--prompt', prompt);

      const { stdout } = await execFileAsync('copilot', args, {
        maxBuffer: 1024 * 1024,
        timeout: 60000,
      });

      return stdout;
    } catch (error: any) {
      // Build a safe error message without leaking sensitive data
      const stderr = (error.stderr || '').trim();
      const code = error.code;
      const exitCode = error.status ?? error.code;

      if (code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        throw new Error('Copilot response exceeded buffer size');
      }
      if (error.killed) {
        throw new Error('Copilot request timed out (60s). Try a faster model like gpt-4.1 or claude-haiku-4.5');
      }

      // When stderr is empty (copilot often exits silently), check the log file
      if (stderr.length === 0) {
        const logDiag = this.readLatestCopilotLog();
        if (logDiag) {
          throw new Error(logDiag);
        }
      }

      // Pass through stderr if it's short and doesn't contain secrets
      const safeStderr = stderr.length > 0 && stderr.length < 200 && !/token|auth|key|secret|password/i.test(stderr)
        ? stderr
        : `exit code ${exitCode || 'unknown'}. Check copilot auth: run "copilot auth login"`;

      throw new Error(`Copilot CLI error: ${safeStderr}`);
    }
  }

  /**
   * Runs a prompt with the user's configured model.
   * Shows cost info before the call.
   * If a quota/rate-limit error is detected, automatically retries with a free model.
   */
  private async execWithQuotaRetry(prompt: string): Promise<string> {
    const configService = new ConfigService();
    const model = configService.getCopilotModel();
    const isFreeModel = FREE_MODELS.includes(model);

    // Show model + cost before making the call
    this.printModelCost(model);
    console.log('');

    try {
      return await this.execCopilotPrompt(prompt, model);
    } catch (error) {
      // If already on a free model, no point retrying — just throw
      if (isFreeModel) throw error;

      // If it looks like a quota issue, retry with the free model
      if (this.isQuotaError(error as Error)) {
        this.printQuotaWarning(model);

        const result = await this.execCopilotPrompt(prompt, FREE_FALLBACK_MODEL);
        this.printSwitchTip();
        return result;
      }

      // Some other error — let it bubble up
      throw error;
    }
  }

  async generateCommitMessage(diff: string): Promise<string[]> {
    try {
      const prompt = `Generate 3 commit messages for these git changes. Use conventional commits format (feat/fix/chore/etc).
  
  Changes:
  ${diff.substring(0, 2000)}
  
  Respond with 3 options:
  1. [first message]
  2. [second message]
  3. [third message]
  
  Keep each under 72 characters.`;

      const stdout = await this.execWithQuotaRetry(prompt);

      // Parse messages
      const messages = this.parseCommitMessages(stdout);

      if (messages.length > 0) {
        return messages;
      }

      return this.generateFallbackMessages(diff);

    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      console.log(chalk.yellow(`⚠️  ${reason}`));
      console.log(chalk.dim('   Using fallback suggestions\n'));
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

      const prompt = `Generate a PR title and description for these commits:\n${commitList}\n\nFormat:\nTITLE: [title]\nBODY:\n[description]`;

      const stdout = await this.execWithQuotaRetry(prompt);

      // Parse response
      const parsed = this.parsePRDescription(stdout);

      if (parsed.title && parsed.body && parsed.body.length > 50) {
        return parsed;
      }

      // If parsing gave weak results, use fallback
      console.log('⚠️ Weak response, using fallback\n');
      return this.generateSmartFallback(commits, issueContext);

    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      console.log(chalk.yellow(`⚠️  ${reason}`));
      console.log(chalk.dim('   Using fallback PR description\n'));
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

      const stdout = await this.execWithQuotaRetry(prompt);

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
      const reason = error instanceof Error ? error.message : 'unknown error';
      console.log(chalk.yellow(`⚠️  ${reason}`));
      console.log(chalk.dim('   Using fallback branch name\n'));
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