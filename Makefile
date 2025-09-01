# Image name
IMAGE_NAME = mcp-gemini-image

# Docker build
docker-build:
	docker build -t $(IMAGE_NAME) .

# Docker clean
docker-clean:
	docker rmi $(IMAGE_NAME) || true

# Build TypeScript
build:
	npm run build

# Clean build
clean:
	rm -rf build/

# Install dependencies
install:
	npm install

# Development build and run
dev: build
	node build/index.js

.PHONY: docker-build docker-clean build clean install dev