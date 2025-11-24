# mcp-gemini-image

[![npm version](https://badge.fury.io/js/mcp-gemini-image.svg)](https://www.npmjs.com/package/mcp-gemini-image)
[![Docker Hub](https://img.shields.io/docker/v/4kk11/mcp-gemini-image?label=docker)](https://hub.docker.com/r/4kk11/mcp-gemini-image)

An MCP server for generating, editing, and analyzing images using Google's Gemini API.  
Generated images are saved in the specified directory and returned along with scaled-down preview images.

## Key Features

### 1. Image Generation (generate_image)
Generates new images from text prompts using Google's Gemini 3 Pro Image model (Nano Banana Pro). Can also create variations or edits of existing images by providing reference images.

**Input Parameters:**
- `prompt`: Description of the image to generate or editing instructions (required)
- `images`: Array of file paths for reference images (optional)

### 2. Image Analysis (analyze_image)
Analyzes images using Gemini 3 Pro's superior vision and reasoning capabilities to provide quality assessment and improvement advice.

**Input Parameters:**
- `prompt`: Text prompt asking questions about the image (required)
- `images`: Array of file paths for images to analyze (required)

## Installation

### Using npx

Configuration example (claude_desktop_config.json):
```json
{
  "mcpServers": {
    "gemini-image": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-gemini-image"
      ],
      "env": {
        "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY"
      }
    }
  }
}
```

### Using Docker

1. Build the Docker image
```bash
docker build -t mcp-gemini-image .
```

2. Configuration example (claude_desktop_config.json)
```json
{
  "mcpServers": {
    "gemini-image": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "/path/to/your/image/directory:/workspace",
        "-e",
        "GEMINI_API_KEY=YOUR_GEMINI_API_KEY",
        "mcp-gemini-image"
      ]
    }
  }
}
```

## Environment Variables

| Variable Name | Description | Default Value |
|--------------|-------------|---------------|
| GEMINI_API_KEY | Google Gemini API key (required) | - |
| GOOGLE_API_KEY | Alternative name for Google API key | - |

## Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click "Get API Key" in the left sidebar
4. Create a new API key or use an existing one
5. Copy the API key and set it as the `GEMINI_API_KEY` environment variable

## About Gemini 3 Models

This MCP server uses Google's latest Gemini 3 models:

### Gemini 3 Pro Image (Nano Banana Pro)
For image generation, offering:
- **Studio-Quality Output**: High-fidelity images with up to 4K resolution support
- **Superior Text Rendering**: Excellent text rendering for infographics, menus, diagrams, and marketing assets
- **Advanced Features**: Mix up to 14 reference images, localized edits, lighting adjustments, and camera transformations
- **Real-World Grounding**: Enhanced with Google Search for better context and accuracy
- **Iterative Refinement**: Make progressive improvements to images through multiple interactions

### Gemini 3 Pro
For image analysis, providing:
- **State-of-the-Art Reasoning**: Advanced multimodal understanding and analysis capabilities
- **1M Token Context Window**: Can comprehend vast datasets across text, images, video, PDFs, and code
- **Superior Performance**: Tops the LMArena Leaderboard with breakthrough performance

## Usage Examples

### Basic Image Generation
```json
{
  "tool": "generate_image",
  "arguments": {
    "prompt": "A serene mountain landscape at sunset with a lake reflection",
    "output_dir": "/path/to/output/directory"
  }
}
```

### Image Editing (using reference images)
```json
{
  "tool": "generate_image",
  "arguments": {
    "prompt": "Add a rainbow in the sky and make the colors more vibrant",
    "images": ["/path/to/your/image.jpg"],
    "output_dir": "/path/to/output/directory"
  }
}
```

### Image Analysis
```json
{
  "tool": "analyze_image",
  "arguments": {
    "prompt": "Please evaluate the quality of this image and suggest improvements",
    "images": ["/path/to/your/image.jpg"]
  }
}
```

### Multiple Image Comparison
```json
{
  "tool": "analyze_image",
  "arguments": {
    "prompt": "Compare these images and describe the differences",
    "images": ["/path/to/image1.jpg", "/path/to/image2.jpg"]
  }
}
```

## For Developers

### Local Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run locally
node build/index.js
```

### Building Docker Images

```bash
# Build Docker image
make docker-build

# Clean Docker image
make docker-clean
```

### Project Structure

```
mcp-gemini-image/
├── src/
│   ├── index.ts      # Entry point
│   └── imagen.ts     # Main server logic
├── build/            # Compiled JavaScript
├── package.json      # Dependencies
├── tsconfig.json     # TypeScript config
├── Dockerfile        # Container config
└── Makefile          # Build automation
```

## Important Notes

- All generated images include a SynthID watermark (for Imagen 3)
- Images are automatically resized to 1/4 scale for previews
- Original full-size images are saved to the specified directory
- The server requires a valid Gemini API key to function
- Error handling includes detailed error messages for troubleshooting

## Troubleshooting

### API Key Issues
- Ensure your `GEMINI_API_KEY` is valid and not expired
- Check that you have sufficient quota/credits in your Google AI Studio account

### Permission Issues
- Make sure the `output_dir` path exists and is writable
- For Docker usage, ensure volume mounts have correct permissions for both input images and output directories

### Model Availability
- Some models may have regional availability restrictions
- Check Google AI Studio for the latest model availability

## License

This project is released under the MIT License. See [LICENSE](LICENSE) file for details.