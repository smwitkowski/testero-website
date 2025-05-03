# Use Node.js 20 as the base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install system dependencies for Sharp image processing
RUN apk add --no-cache \
    build-base \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev \
    fontconfig-dev

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install system dependencies for Sharp image processing in the builder stage
RUN apk add --no-cache \
    build-base \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev \
    fontconfig-dev

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Declare build arguments for NEXT_PUBLIC variables
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Declare build arguments for GCP variables
ARG GCP_STORAGE_BUCKET_NAME
ARG GCP_CDN_URL
ARG USE_GCP_STORAGE
ARG GCP_PROJECT_ID
ARG GCP_SERVICE_ACCOUNT_KEY

# Set environment variables from build arguments for the build stage
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Set GCP environment variables
ENV GCP_STORAGE_BUCKET_NAME=$GCP_STORAGE_BUCKET_NAME
ENV GCP_CDN_URL=$GCP_CDN_URL
ENV USE_GCP_STORAGE=$USE_GCP_STORAGE
ENV GCP_PROJECT_ID=$GCP_PROJECT_ID

# If GCP service account key is provided, save it to a file
RUN if [ -n "$GCP_SERVICE_ACCOUNT_KEY" ]; then \
      echo "$GCP_SERVICE_ACCOUNT_KEY" > /app/gcp-service-account.json && \
      chmod 600 /app/gcp-service-account.json && \
      export GCP_KEY_FILE_PATH=/app/gcp-service-account.json; \
    fi

# Build the Next.js application
# These ENV variables will be available during the build
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy GCP service account key if it exists
COPY --from=builder /app/gcp-service-account.json* ./gcp-service-account.json* 2>/dev/null || :

# Create a non-root user to run the application
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Set permissions for GCP service account key if it exists
RUN if [ -f ./gcp-service-account.json ]; then \
      chown nextjs:nodejs ./gcp-service-account.json && \
      chmod 600 ./gcp-service-account.json; \
    fi

# Set the user to run the application
USER nextjs

# Expose the port the app runs on
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
