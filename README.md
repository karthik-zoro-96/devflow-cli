# DevFlow 🚀

AI-powered Git workflow automation using GitHub Copilot CLI. Streamline your development workflow with intelligent commit messages, PR descriptions, and branch naming.

[![GitHub Copilot CLI Challenge](https://img.shields.io/badge/GitHub-Copilot_CLI_Challenge-blue)](https://dev.to/challenges/github-2026-01-21)

## ✨ Features

- **🤖 Smart Commit Messages** - AI-generated conventional commit messages from your changes
- **📝 PR Generation** - Automatic pull request descriptions with summary, changes, and testing notes
- **🌿 Branch Naming** - Semantic branch names from GitHub issues or descriptions
- **⚙️ Config Management** - Secure token storage with interactive setup wizard
- **💰 Cost-Aware Model Selection** - Dynamically fetches available models from Copilot CLI with cost info
- **🔄 Quota Auto-Retry** - Automatically falls back to a free model when premium requests are exhausted
- **🔐 Security First** - Tokens never displayed, error messages sanitized, config file locked down

## 🎥 Demo

<img width="1178" height="559" alt="image" src="https://github.com/user-attachments/assets/b1f49000-7ecd-4415-bf69-670c7a1c4b36" />

<img width="1372" height="886" alt="image" src="https://github.com/user-attachments/assets/f04027fb-577d-4152-a9c4-2dfbdb3b6242" />

<img width="1372" height="886" alt="image" src="https://github.com/user-attachments/assets/1c185604-9328-4a97-935f-31cf24b92e4a" />

<img width="1372" height="886" alt="image" src="https://github.com/user-attachments/assets/1ad5c64d-5138-4d3d-b9a4-35a994be7383" />

## 📦 Installation

```bash
npm install -g git-devflow
```

## 🔧 Setup

```bash
# Run interactive setup (single source of truth - no .env file needed)
devflow config setup
```

The setup wizard will prompt you for:

- **GitHub Personal Access Token** - for creating PRs and fetching issues
- **Preferred AI model** - fetched dynamically from Copilot CLI with cost info
- **Default base branch** - typically `main` or `develop`

All config is stored securely in `~/.devflow/config.json` with restricted file permissions.

## 🎯 Usage

### Generate Commit Messages

```bash
# Stage your changes
git add .

# Generate AI-powered commit message
devflow commit

# Or stage all changes automatically
devflow commit -a
```

Each operation shows the model being used and its cost:

```
🤖 Model: claude-sonnet-4.5  Balanced  ·  1 premium request(s) per prompt
```

### Create Pull Requests

```bash
# On your feature branch
devflow pr create

# Specify custom base branch
devflow pr create --base develop
```

### Create Branches

```bash
# From GitHub issue
devflow branch create --issue 123

# From description
devflow branch create "add user authentication"

# Interactive mode
devflow branch create
```

### Configuration

```bash
# Show current config
devflow config show

# Update specific setting
devflow config set copilotModel claude-haiku-4.5

# Get config value
devflow config get copilotModel

# Re-run full setup wizard
devflow config setup
```

## 🏗️ How It Works

DevFlow uses **GitHub Copilot CLI** as its AI engine:

1. **Commit Command**: Reads `git diff`, sends to Copilot CLI with conventional commit format instructions
2. **PR Command**: Analyzes commits since branch point, generates structured PR description
3. **Branch Command**: Fetches GitHub issue or uses description, generates semantic branch name

### Quota Handling

When your premium request quota is exceeded, DevFlow automatically:

1. Detects the quota error from the Copilot CLI
2. Retries the request with a **free model** (`gpt-4.1`) at no cost
3. Suggests switching your default model via `devflow config setup`

If the free model also fails, DevFlow falls back to intelligent rule-based generation.

## 🎨 AI Model Selection

During setup, models are **fetched dynamically** from the Copilot CLI — no hardcoded list. Each model is shown with its cost tier, sorted cheapest-first:

| Tier          | Examples                                 | Cost                |
| ------------- | ---------------------------------------- | ------------------- |
| **Free**      | `gpt-4.1`, `gpt-5-mini`                  | No premium requests |
| **Cheap**     | `claude-haiku-4.5`, `gpt-5.1-codex-mini` | 0.33x per prompt    |
| **Balanced**  | `claude-sonnet-4.5`, `gpt-5.1-codex`     | 1x per prompt       |
| **Expensive** | `claude-opus-4.5`                        | 3x per prompt       |

As GitHub adds or removes models, DevFlow automatically reflects the changes.

## 🔐 Security

- GitHub tokens stored in `~/.devflow/config.json` with **600 file permissions** (owner-only)
- Tokens are **never displayed** in config output, error messages, or logs
- Sensitive config keys are redacted in `config get` and `config set` output
- Error messages are sanitized to prevent leaking auth headers or request details
- No `.env` file required — config setup is the single source of truth
- Environment variables (`GITHUB_TOKEN`, `GH_TOKEN`) supported as fallback for CI

## 📝 Requirements

- Node.js 18+
- Git
- [GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli) (`npm install -g @githubnext/github-copilot-cli`)
- GitHub account with Copilot access

## Future Enhancements

- [ ] Ollama fallback for offline/quota-exceeded scenarios
- [ ] Custom prompt templates
- [ ] Team collaboration features

## 🤝 Contributing

Contributions welcome! This project was built for the [GitHub Copilot CLI Challenge](https://dev.to/challenges/github-2026-01-21).

## 📄 License

MIT

## 🙏 Acknowledgments

Built with ❤️ using:

- [GitHub Copilot CLI](https://githubnext.com/projects/copilot-cli)
- [Commander.js](https://github.com/tj/commander.js)
- [Inquirer Prompts](https://github.com/SBoudrias/Inquirer.js)
- [simple-git](https://github.com/steveukx/git-js)
- [@octokit/rest](https://github.com/octokit/rest.js)

---

**Made for the GitHub Copilot CLI Challenge 2026** 🚀
