import ora, { Ora } from 'ora';
import chalk from 'chalk';

export class Spinner {
  private spinner: Ora;

  constructor(text: string) {
    this.spinner = ora({
      text: chalk.cyan(text),
      spinner: 'dots'
    });
  }

  start(): void {
    this.spinner.start();
  }

  succeed(text?: string): void {
    if (text) {
      this.spinner.succeed(chalk.green(text));
    } else {
      this.spinner.succeed();
    }
  }

  fail(text?: string): void {
    if (text) {
      this.spinner.fail(chalk.red(text));
    } else {
      this.spinner.fail();
    }
  }

  update(text: string): void {
    this.spinner.text = chalk.cyan(text);
  }

  stop(): void {
    this.spinner.stop();
  }
}