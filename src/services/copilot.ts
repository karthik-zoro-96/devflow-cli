import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CopilotService {
  async generateCommitMessage(diff: string): Promise<string[]> {
    try {
      // Use a simpler, more direct prompt
      const prompt = `Generate 3 commit messages for these changes. Use conventional commits format.

Changes:
${diff.substring(0, 2000)}

Format each as: "type: description"
Keep under 72 characters.`;

      // Escape the prompt properly
      const escapedPrompt = prompt
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');

      console.log('\n🤖 Calling Copilot CLI...\n');

      // Call copilot with proper escaping
      const { stdout } = await execAsync(
        `copilot -p "${escapedPrompt}" 2>/dev/null || echo "feat: update code
fix: resolve issue  
chore: update files"`,
        { 
          maxBuffer: 1024 * 1024,
          timeout: 30000
        }
      );
      // Parse messages
      const messages = this.parseCommitMessages(stdout);
      
      if (messages.length > 0) {
        return messages;
      }

      // Fallback
      return this.generateFallbackMessages(diff);

    } catch (error) {
      console.log('⚠️  Copilot CLI timeout or error, using fallback');
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
}