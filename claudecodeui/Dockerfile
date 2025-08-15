# Multi-stage build for Claude Code UI
FROM node:20-alpine AS builder

# Install build dependencies including Python
RUN apk add --no-cache python3 py3-setuptools make g++ bash

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install required system dependencies for node-pty and git
RUN apk add --no-cache python3 py3-setuptools make g++ bash curl git openssh

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server ./server
COPY public ./public

# Copy environment file if exists
COPY .env* ./

# Create a non-root user for running the app
RUN addgroup -g 1001 appuser && \
    adduser -D -u 1001 -G appuser -s /bin/bash appuser

# Create necessary directories with proper permissions
RUN mkdir -p /app/data /home/appuser/.claude/projects && \
    chown -R appuser:appuser /app /home/appuser/.claude && \
    chmod -R 755 /app/data

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3001

# Set environment for production
ENV NODE_ENV=production
ENV HOME=/home/appuser

# Start the server
CMD ["node", "server/index.js"]