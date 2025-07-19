# Base image with only essential tools
FROM node:22-alpine3.19 AS base

# Set environment variable
ENV NODE_ENV=production

# Reusable layer for installing deps
FROM base AS deps
WORKDIR /usr/src/app

# Copy only package info first to leverage Docker caching
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

# Build stage: compile the app
FROM deps AS build
COPY . .
RUN yarn build

# Final runtime image
FROM base AS production
WORKDIR /usr/src/app

# Install only production dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true

# Copy built code
COPY --from=build /usr/src/app/dist ./dist

# Run the app
CMD ["sh", "-c", "yarn start:prod"]
