# DevFlow 🚀

AI-powered Git workflow automation using GitHub Copilot CLI. Streamline your development workflow with intelligent commit messages, PR descriptions, and branch naming.

[![GitHub Copilot CLI Challenge](https://img.shields.io/badge/GitHub-Copilot_CLI_Challenge-blue)](https://dev.to/challenges/github-2026-01-21)

## ✨ Features

- **🤖 Smart Commit Messages** - AI-generated conventional commit messages from your changes
- **📝 PR Generation** - Automatic pull request descriptions with summary, changes, and testing notes
- **🌿 Branch Naming** - Semantic branch names from GitHub issues or descriptions
- **⚙️ Config Management** - Secure token storage and AI model selection (Haiku/Sonnet/GPT)
- **🚀 Auto-Push** - Automatically push branches before creating PRs

## 🎥 Demo

<img width="1728" height="1117" alt="image" src="https://github.com/user-attachments/assets/8716f463-9591-42c2-996f-a4d342725b77" />

<img width="1372" height="886" alt="image" src="https://github.com/user-attachments/assets/f04027fb-577d-4152-a9c4-2dfbdb3b6242" />

<img width="1372" height="886" alt="image" src="https://github.com/user-attachments/assets/1c185604-9328-4a97-935f-31cf24b92e4a" />

<img width="1372" height="886" alt="image" src="https://github.com/user-attachments/assets/1ad5c64d-5138-4d3d-b9a4-35a994be7383" />


## 📦 Installation

```bash
npm install -g devflow-cli
```

## 🔧 Setup

```bash
# Run interactive setup
devflow config setup

# You'll be prompted for:
# - GitHub Personal Access Token
# - Preferred AI model (Sonnet 4.5 / Haiku 4.5 / GPT-4.1)
```

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
```

## 🏗️ How It Works

DevFlow uses **GitHub Copilot CLI** as its AI engine:

1. **Commit Command**: Reads `git diff`, sends to Copilot CLI with conventional commit format instructions
2. **PR Command**: Analyzes commits since branch point, generates structured PR description
3. **Branch Command**: Fetches GitHub issue or uses description, generates semantic branch name

When Copilot quota is exceeded, DevFlow gracefully falls back to intelligent rule-based generation.

## 🎨 AI Model Selection

Choose your preferred model during setup:

- **Claude Sonnet 4.5** - Balanced speed and quality (default)
- **Claude Haiku 4.5** - Faster, more cost-effective
- **GPT-4.1** - Alternative AI model

## 🔐 Security

- GitHub tokens stored in `~/.devflow/config.json` with 600 file permissions
- Never commits tokens to repositories
- Respects existing environment variables (`GITHUB_TOKEN`, `GH_TOKEN`)

## 📝 Requirements

- Node.js 18+
- Git
- GitHub Copilot CLI (`gh extension install github/gh-copilot`)
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
