# OnMicro.AI

Build Micro Apps with No Code

## Overview

### What is OnMicro.AI?
OnMicro.AI is a user-friendly platform that allows educators to build and deploy AI applications as easily as creating a Google form. The platform's mission is to provide agency over AI for educators through accessible tools and research, putting them in the driver's seat rather than treating AI as a black box of complex algorithms.

### Core Features
- **No-Code App Builder**: Create AI-powered educational applications using a drag-and-drop editor without writing any code
- **Educational Focus**: Build applications that leverage AI to accelerate course development, scale feedback, or automate assessment while protecting your pedagogical approach
- **Instant Sharing**: Share applications seamlessly with colleagues, students, or the public
- **Data Collection**: Gather valuable metrics about usage, cost, satisfaction, and accuracy to make informed decisions about AI implementation
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

## License

[Add your license information here]

