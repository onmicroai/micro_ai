# OnMicro.AI

<a href="https://onmicro.ai"><img src="https://onmicro.ai/_next/static/media/onMicroAI_logo_horiz_color-cropped.d48f058a.svg" alt="OnMicro.AI Logo" width="350"></a>

Build Micro Apps with No Code

## Overview

### What is OnMicro.AI?
OnMicro.AI is a user-friendly platform that allows educators to build and deploy AI applications as easily as creating a Google form. The platform's mission is to provide agency over AI for educators through accessible tools and research, putting them in the driver's seat rather than treating AI as a black box of complex algorithms.

### Core Features
- **No-Code App Builder**: Create AI-powered educational applications using a drag-and-drop editor without writing any code
  ![No-Code App Builder Demo](https://onmicro.ai/img/homepage/build.gif)
- **Educational Focus**: Build applications that leverage AI to accelerate course development, scale feedback, or automate assessment while protecting your pedagogical approach
- **Instant Sharing**: Share applications seamlessly with colleagues, students, or the public
  ![Instant Sharing Demo](https://onmicro.ai/img/homepage/share.gif)
- **Data Analysis**: Gather valuable metrics about usage, cost, satisfaction, and accuracy to make informed decisions about AI implementation
  ![App Statistics](https://onmicro.ai/img/homepage/app_stats.png)
- **Diverse AI Models**: Access to various AI models including GPT 4o-mini, Claude Haiku, Google Gemini Flash, and more advanced options in higher tiers

## Prerequisites

Before you begin, make sure you have the following installed:

1. [Docker](https://www.docker.com/get-started) - Version 20.10 or higher
2. [Docker Compose](https://docs.docker.com/compose/install/) - Version 2.0 or higher

## Installation

1. **Clone the Repository**
```bash
git clone https://github.com/onmicroai/micro_ai.git
cd micro_ai
```

2. **Environment Setup**
The application will automatically create a `.env` file with default settings. If you need to customize the environment variables, you can edit the `.env` file.

3. **Start the Application**
```bash
docker compose up
```

This command will:
- Build and start all necessary containers (Frontend, Backend, Database, Redis, etc.)
- Run database migrations
- Start the development servers

4. **Access the Application**
Once all containers are running, you can access:
- Main application: http://localhost
- Admin interface: http://localhost:8000/admin
- API documentation: http://localhost:8000/api/schema/

## Project Structure

The project consists of several components:

- `frontend/`: Next.js frontend application
- `backend/`: Django backend application
- `nginx/`: Nginx configuration for serving the application
- `docker-compose.yml`: Docker configuration for all services

## Troubleshooting

If you encounter any issues:

1. Make sure all required ports (80, 8000, 5432) are available on your system
2. Check if Docker and Docker Compose are running properly
3. Try stopping and removing all containers:
```bash
docker compose down
```
4. Rebuild the containers:
```bash
docker compose build
docker compose up
```

## Support

For support, please:
1. Open an issue in the [GitHub repository](https://github.com/onmicroai/micro_ai/issues)
2. Contact the development team at john@onmicro.ai

## Contributing

We welcome contributions to OnMicro.AI! Here's how you can help:

1. **Fork the Repository**
   - Go to [https://github.com/onmicroai/micro_ai](https://github.com/onmicroai/micro_ai)
   - Click the "Fork" button in the top-right corner
   - Clone your forked repository locally

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-fix-name
   ```

3. **Make Your Changes**
   - Write clear, descriptive commit messages
   - Follow the existing code style
   - Add tests for new features
   - Update documentation as needed

4. **Submit a Pull Request**
   - Push your changes to your fork
   - Go to the original repository
   - Click "New Pull Request"
   - Select your feature branch
   - Fill out the pull request template
   - Submit and wait for review

5. **Code Review Process**
   - Address any feedback from reviewers
   - Make requested changes
   - Ensure all tests pass
   - Keep the PR up to date with the main branch

### Development Guidelines

- Follow PEP 8 style guide for Python code
- Use ESLint and Prettier for JavaScript/TypeScript code
- Write meaningful commit messages following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification:
  ```
  <type>: #<issue-number> <description> 

  [optional body]
  ```
  - Types:
    - `feat`: New feature (correlates with MINOR in SemVer)
    - `fix`: Bug fix (correlates with PATCH in SemVer)
    - `docs`: Documentation changes
    - `style`: Code style changes (formatting, etc.)
    - `refactor`: Code changes that neither fix a bug nor add a feature
    - `perf`: Performance improvements
    - `test`: Adding or modifying tests
    - `build`: Changes that affect the build system
    - `ci`: Changes to CI configuration files
    - `chore`: Other changes that don't modify source or test files
  - Breaking changes must be indicated with `!` after type/scope or with `BREAKING CHANGE:` footer
  - Always include the issue number in the commit message using `#<issue-number>`
  - Examples:
    - `feat: #123 change authentication method to OAuth2 #123`
    - `fix: #111 handle null response from external service #456`
    - `docs: #115 update installation instructions #789`
- Include tests for new features and bug fixes
- Update documentation for any changes

## License

[GNU LESSER GENERAL PUBLIC LICENSE Version 2.1](https://github.com/onmicroai/micro_ai/blob/master/LICENSE.md)

