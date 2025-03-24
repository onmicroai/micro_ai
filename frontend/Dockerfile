#\microai-frontend\Dockerfile.dev

FROM node:20-alpine AS builder

# Set working directory
WORKDIR /frontend

# Create a group and user for the build stage
RUN addgroup -S microai && adduser -S -G microai microai && \
    chown -R microai:microai /frontend

# Switch to non-root user
USER microai

# Copy package files and install dependencies
COPY --chown=microai:microai package.json ./
RUN yarn install

# Copy the rest of the app
COPY --chown=microai:microai . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

EXPOSE 3000

# Start the development server
CMD ["yarn", "dev"]