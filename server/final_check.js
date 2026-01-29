import { GoogleGenerativeAI } from "@google/generative-ai";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegStatic);

async function runTests() {
  console.log("--- SYSTEM CHECK ---");
  
  // 1. FFmpeg Check
  console.log("1. Checking FFmpeg...");
  try {
    const input = 'test_input.mp4';
    const outputDir = 'test_frames';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input('color=c=red:s=100x100:d=1')
        .inputFormat('lavfi')
        .save(input)
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log("   - Video created");
    
    await new Promise((resolve, reject) => {
      ffmpeg(input)
        .screenshots({ count: 1, folder: outputDir, filename: 'f.jpg' })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log("   - Frame extracted successfully!");
    
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.unlinkSync(input);
  } catch (err) {
    console.error("   - FFmpeg FAILED:", err.message);
  }

  // 2. Gemini Check
  console.log("\n2. Checking Gemini API...");
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.includes("your_")) {
    console.log("   - Gemini FAILED: No valid API key in .env");
  } else {
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent("Test");
      console.log("   - Gemini Success! Response:", (await result.response).text());
    } catch (err) {
      console.log("   - Gemini FAILED:", err.message);
    }
  }
}

runTests();
