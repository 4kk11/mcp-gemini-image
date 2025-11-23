import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { GoogleGenAI } from "@google/genai";

enum ToolName {
  GENERATE_IMAGE = "generate_image",
  ANALYZE_IMAGE = "analyze_image",
}

const GenerateImageSchema = z.object({
  prompt: z.string().describe("Text prompt (input in English)"),
  images: z.array(z.string()).optional().describe("Array of reference image file paths (optional)"),
  temperature: z.number().min(0).max(1.0).optional().describe("Sampling temperature (0-1.0, default: 0.8)"),
});

const AnalyzeImageSchema = z.object({
  prompt: z.string().describe("Text prompt to ask questions about the image (input in English)"),
  images: z.array(z.string()).describe("Array of image file paths to analyze"),
  temperature: z.number().min(0).max(1.0).optional().describe("Sampling temperature (0-1.0, default: 0.8)"),
});

// 画像保存用のディレクトリパスを環境変数から取得
const IMAGES_DIR = process.env.IMAGES_DIR
  ? path.resolve(process.env.IMAGES_DIR)
  : path.join(process.cwd(), "temp");

// 保存用ディレクトリが存在しない場合は作成
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

export const createServer = async () => {
  const server = new Server(
    {
      name: "mcp-gemini-image",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // GoogleGenAIクライアントの初期化
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY environment variable is not set");
  }
  
  const ai = new GoogleGenAI({ apiKey });

  // ツール一覧の取得ハンドラー
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: ToolName.GENERATE_IMAGE,
        description: "Generate images from text prompts, or combine with reference images to create new images",
        inputSchema: zodToJsonSchema(GenerateImageSchema) as Tool["inputSchema"],
      },
      {
        name: ToolName.ANALYZE_IMAGE,
        description: "Analyze images and provide quality checks and improvement advice",
        inputSchema: zodToJsonSchema(AnalyzeImageSchema) as Tool["inputSchema"],
      },
    ];

    return { tools };
  });

  // ツールの実行ハンドラー
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === ToolName.GENERATE_IMAGE) {
      const validatedArgs = GenerateImageSchema.parse(args);
      const { prompt, images, temperature = 0.8 } = validatedArgs;

      try {
        let contents;
        
        if (images && images.length > 0) {
          // 画像がある場合はマルチモーダルリクエストを構築
          const parts = [{ text: prompt }];
          
          for (const imagePath of images) {
            if (!fs.existsSync(imagePath)) {
              throw new McpError(ErrorCode.InternalError, `指定された画像ファイルが存在しません: ${imagePath}`);
            }
            
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');
            
            parts.push({
              inlineData: {
                mimeType: "image/png",
                data: base64Image,
              },
            } as any);
          }
          
          contents = [{
            role: "user",
            parts,
          }];
        } else {
          // 画像がない場合はテキストのみ
          contents = prompt;
        }

        const response = await ai.models.generateContent({
          model: "gemini-3-pro-image-preview",
          contents,
          config: {
            temperature,
          }
        });

        if (!response.candidates?.[0]?.content?.parts) {
          throw new McpError(ErrorCode.InternalError, "画像生成に失敗しました: レスポンスデータが不正です");
        }

        const results = [];
        
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.mimeType?.startsWith("image/") && part.inlineData.data) {
            // Base64データをバッファに変換
            const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
            
            // 一時ファイルとして保存
            const timestamp = new Date().getTime();
            const filename = `generated_${timestamp}.png`;
            const filepath = path.join(IMAGES_DIR, filename);
            
            // 元のサイズで保存
            fs.writeFileSync(filepath, imageBuffer);

            // 画像メタデータを取得
            const metadata = await sharp(imageBuffer).metadata();
            const width = metadata.width || 1024;
            
            // 4分の1サイズにリサイズ(プレビュー用)
            const resizedImageBuffer = await sharp(imageBuffer)
              .resize(Math.round(width / 4), undefined, {
                fit: 'inside'
              })
              .png()
              .toBuffer();

            results.push({
              filepath,
              preview: resizedImageBuffer.toString('base64')
            });
          }
        }

        if (results.length === 0) {
          throw new McpError(ErrorCode.InternalError, "画像生成に失敗しました: 画像が生成されませんでした");
        }

        return {
          content: results.map(result => [
            {
              type: "text",
              text: result.filepath,
            },
            {
              type: "image",
              data: result.preview,
              mimeType: "image/png",
            }
          ]).flat(),
        };
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Image generation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // EDIT_IMAGE は GENERATE_IMAGE に統合されたため削除

    if (name === ToolName.ANALYZE_IMAGE) {
      const validatedArgs = AnalyzeImageSchema.parse(args);
      const { images, prompt, temperature = 0.8 } = validatedArgs;

      try {
        // 複数画像を分析用に準備
        const parts = [{ text: prompt }];
        
        for (const imagePath of images) {
          if (!fs.existsSync(imagePath)) {
            throw new McpError(ErrorCode.InternalError, `指定された画像ファイルが存在しません: ${imagePath}`);
          }
          
          const imageBuffer = fs.readFileSync(imagePath);
          const base64Image = imageBuffer.toString('base64');
          
          parts.push({
            inlineData: {
              mimeType: "image/png",
              data: base64Image,
            },
          } as any);
        }

        // Gemini 3 Proのマルチモーダル機能を使って画像を分析
        const response = await ai.models.generateContent({
          model: "gemini-3-pro-preview",
          contents: [
            {
              role: "user",
              parts,
            },
          ],
          config: {
            temperature,
          }
        });

        if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new McpError(ErrorCode.InternalError, "画像分析に失敗しました: レスポンスデータが不正です");
        }

        const analysisResult = response.candidates[0].content.parts[0].text;

        return {
          content: [
            {
              type: "text",
              text: analysisResult,
            },
          ],
        };
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Image analysis failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  });

  return { server };
};