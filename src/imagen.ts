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
  EDIT_IMAGE = "edit_image",
}

const GenerateImageSchema = z.object({
  prompt: z.string().describe("テキストプロンプト"),
});

const EditImageSchema = z.object({
  image: z.string().describe("編集する画像のファイルパス"),
  prompt: z.string().describe("編集内容を説明するテキストプロンプト"),
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
        description: "テキストプロンプトから画像を生成",
        inputSchema: zodToJsonSchema(GenerateImageSchema) as Tool["inputSchema"],
      },
      {
        name: ToolName.EDIT_IMAGE,
        description: "既存画像をプロンプトと組み合わせて新しい画像を生成",
        inputSchema: zodToJsonSchema(EditImageSchema) as Tool["inputSchema"],
      },
    ];

    return { tools };
  });

  // ツールの実行ハンドラー
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === ToolName.GENERATE_IMAGE) {
      const validatedArgs = GenerateImageSchema.parse(args);
      const { prompt } = validatedArgs;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: prompt,
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

    if (name === ToolName.EDIT_IMAGE) {
      const validatedArgs = EditImageSchema.parse(args);
      const { image, prompt } = validatedArgs;

      try {
        // ファイルパスから画像を読み込む
        if (!fs.existsSync(image)) {
          throw new McpError(ErrorCode.InternalError, "指定された画像ファイルが存在しません");
        }

        const imageBuffer = fs.readFileSync(image);
        const base64Image = imageBuffer.toString('base64');

        // Geminiのマルチモーダル機能を使って画像編集
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
                },
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: base64Image,
                  },
                },
              ],
            },
          ],
        });

        if (!response.candidates?.[0]?.content?.parts) {
          throw new McpError(ErrorCode.InternalError, "画像編集に失敗しました: レスポンスデータが不正です");
        }

        const results = [];
        
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.mimeType?.startsWith("image/") && part.inlineData.data) {
            // Base64データをバッファに変換
            const resultImageBuffer = Buffer.from(part.inlineData.data, 'base64');
            
            // 一時ファイルとして保存
            const timestamp = new Date().getTime();
            const filename = `edited_${timestamp}.png`;
            const filepath = path.join(IMAGES_DIR, filename);
            
            // 元のサイズで保存
            fs.writeFileSync(filepath, resultImageBuffer);

            // 画像メタデータを取得
            const metadata = await sharp(resultImageBuffer).metadata();
            const width = metadata.width || 1024;
            
            // 4分の1サイズにリサイズ(プレビュー用)
            const resizedImageBuffer = await sharp(resultImageBuffer)
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
          throw new McpError(ErrorCode.InternalError, "画像編集に失敗しました: 画像が生成されませんでした");
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
          `Image editing failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  });

  return { server };
};