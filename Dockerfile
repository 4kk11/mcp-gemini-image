FROM node:18-alpine

WORKDIR /app

# Install dependencies first (for better caching)
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Create temp directory for images
RUN mkdir -p temp

# Set proper permissions
RUN chmod 755 build/index.js

# Run the application
CMD ["node", "build/index.js"]