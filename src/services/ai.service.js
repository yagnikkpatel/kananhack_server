import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

// Load env variables before creating the client
dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

async function main() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "What is the capital of France?",
    });
    console.log("Gemini service response:", response.text);
  } catch (error) {
    console.error("Error in Gemini service:", error);
  }
}

export default main;
