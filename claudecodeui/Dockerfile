# Multi-stage build for Claude Code UI
FROM node:20-alpine AS builder

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

# Install required system dependencies for node-pty
RUN apk add --no-cache python3 make g++ bash

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

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create Claude directory structure
RUN mkdir -p /home/nodejs/.claude/projects && \
    chown -R nodejs:nodejs /home/nodejs/.claude

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Set environment for production
ENV NODE_ENV=production

# Start the server
CMD ["node", "server/index.js"]