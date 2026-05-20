const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { getApiKey, getApiKeys, getSystemInstruction } = require('./config.cjs');

// Helper to detect if key is Paid (Placeholder)
async function checkTierInternal() {
    // Current logic returns false (Free tier assumption or logic not fully implemented)
    return false;
}

// List Models
async function listModels(explicitKey = null) {
    try {
        let models = [];
        const apiKey = explicitKey || getApiKey();
        if (!apiKey) throw new Error("API Key not found");

        // Use v1beta for widest model discovery including experimental ones
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.models) {
            models = data.models
                .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                .map(m => m.name.replace('models/', ''));
            
            // Deduplicate and clean
            models = [...new Set(models)];
        } 

        if (models.length === 0) {
            throw new Error("No models returned from API");
        }

        return { success: true, models };
    } catch (error) {
        console.warn('List Models Fetch failed, using fallback:', error.message);
        // Robust Fallback (Stable & Experimental)
        return {
            success: true, 
            models: [
                "gemini-2.0-flash-exp",
                "gemini-2.0-flash-thinking-exp",
                "gemini-3-flash",
                "gemini-2.5-flash",
                "gemini-1.5-pro",
                "gemini-1.5-pro-002",
                "gemini-1.5-flash",
                "gemini-1.5-flash-8b",
                "gemini-1.5-flash-002",
                "gemini-1.0-pro"
            ]
        };
    }
}

// Ask Gemini
async function askGemini({ prompt, modelName, images, image, audioData, history = [], workingMode }) {
    let smartFallbacks = [];
    const isPro = await checkTierInternal();

    // --- SMART ROUTER LOGIC ---
    if (modelName === 'zninja-auto-smart') {
        const lowerPrompt = prompt ? prompt.toLowerCase() : '';
        const codingKeywords = ['code', 'fix', 'api', 'o(n)', 'implementation', 'logic', 'algorithm'];
        const isComplex = image || audioData || codingKeywords.some(k => lowerPrompt.includes(k)) || (prompt && prompt.length > 300);

        if (isComplex) {
            console.log("ZNinja Router: Complex/Coding detected.");
            smartFallbacks = [
                "gemini-3.1-pro-preview",
                "gemini-2.5-pro",
                "gemini-3-pro-preview"
            ];
        } else {
            console.log("ZNinja Router: Simple Chat detected.");
            smartFallbacks = [
                "gemini-2.5-flash-lite",
                "gemini-3-flash-preview",
                "gemini-2.5-flash"
            ];
        }
        modelName = smartFallbacks[0];
    }

    const modelFallbacks = [
        ...smartFallbacks,
        modelName,
        "gemini-2.0-flash-thinking-exp",
        "gemini-3-flash",
        "gemini-2.5-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash-002",
        "gemini-1.5-flash"
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    // --- SYSTEM INSTRUCTION LOGIC ---
    const MODE_INSTRUCTIONS = {
        'general': `You are ZNinja, an ultra-direct and highly efficient assistant.
- Give the final correct answer or solution immediately as the very first sentence.
- Eliminate all conversational filler, introductory pleasantries, and redundant explanations.
- Keep reasoning high-density, concise, and purely factual.`,

        'code': `You are ZNinja, an Elite Senior Software Engineer.
- Deliver 100% complete, fully functional, production-ready code.
- Absolutely NO placeholders, no truncated snippets, and no comments like "// TODO" or "// ... rest of code".
- Default to writing NO comments in the code. Code must be highly readable and self-documenting. A maximum of one single-line comment is permitted only for non-obvious algorithmic tricks.
- Structure your output:
  1. A one-sentence explanation of the approach/design.
  2. The complete, clean code block.
  3. Time & Space complexity in Big O notation.
- Eliminate any introductory or concluding conversational fluff.`,

        'competitive': `You are ZNinja, an Elite Algorithmic Solver.
- Deliver the optimal, complete algorithmic solution immediately.
- Use clean, idiomatic code with optimal time and space complexity.
- Absolutely NO comments in the code, NO intro, NO outro, NO explanations, and NO conversational noise.
- Output ONLY the ready-to-paste code block containing the complete solution that gives correct output on the provided testcases (if provided).`,

        'quiz': `You are ZNinja, an Expert Academic Tutor.
- Output the correct option immediately (e.g., "Option A: [Option Content]").
- Provide exactly one concise sentence justifying the correctness.
- Absolutely NO extra text, introductory greeting, or closing conversation.`
    };

    const defaultSystemInstruction = getSystemInstruction();
    
    let systemInstruction = defaultSystemInstruction;
    if (audioData) {
        systemInstruction = "You are an expert executive secretary. Your goal is to create accurate, professional Minutes of Meeting from audio recordings. Output strictly the minutes, no code analysis or complexity metrics.";
    } else if (workingMode && MODE_INSTRUCTIONS[workingMode]) {
        systemInstruction = MODE_INSTRUCTIONS[workingMode];
    }

    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {
        return { success: false, error: "No API Keys configured. Please go to Setup." };
    }

    // --- EXECUTION LOOP (Models x Keys) ---
    for (const modelId of modelFallbacks) {
        if (!modelId) continue;
        
        for (let kIndex = 0; kIndex < apiKeys.length; kIndex++) {
            const currentKey = apiKeys[kIndex];
            
            try {
                console.log(`Attempting Gemini (${modelId}) with Key #${kIndex + 1}...`);
                const genAI = new GoogleGenerativeAI(currentKey);

                const isThinkingModel = modelId.includes('thinking');
                const isLegacyModel = modelId.includes('1.5') || modelId.includes('1.0');
                
                const modelOptions = {
                    model: modelId,
                    systemInstruction: systemInstruction
                };

                // Enable Search Grounding by default for 2.x/3.x non-thinking models
                if (!isThinkingModel && !isLegacyModel) {
                    modelOptions.tools = [{ googleSearch: {} }];
                }

                let model = genAI.getGenerativeModel(modelOptions);
                let result;
                const allImages = images || (image ? [image] : []);

                const executeCall = async (activeModel) => {
                    if (audioData) {
                        const base64Data = audioData.split(',')[1];
                        const parts = audioData.split(';');
                        const mimeType = parts[0].split(':')[1] || 'audio/webm';

                        const textPrompt = prompt || `Prepare professional Minutes of Meeting from this audio.`;

                        const contentParts = [
                            { text: textPrompt },
                            { inlineData: { data: base64Data, mimeType: mimeType } }
                        ];

                        const genConfig = { maxOutputTokens: 65536 };
                        if (modelId.includes('thinking') || modelId.includes('gemini-3')) {
                            genConfig.thinkingConfig = { includeThoughts: true, thinkingLevel: "HIGH" };
                        }

                        return activeModel.generateContent({
                            contents: [{ role: 'user', parts: contentParts }],
                            generationConfig: genConfig,
                            safetySettings: [
                                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                            ]
                        });
                    } else if (allImages.length > 0) {
                        let visionInstructions = "Analyze image directly.";
                        if (workingMode === 'competitive') visionInstructions = "Solve the CP problem in the image.";
                        else if (workingMode === 'quiz') visionInstructions = "Solve this quiz question.";

                        const visionPrompt = `[VISION ACTIVE] ${visionInstructions}\n${prompt || ""}`;
                        const visionParts = [{ text: visionPrompt }];
                        allImages.forEach(img => {
                            const mimeTypeMatch = img.match(/^data:(image\/[a-zA-Z]*);base64,/);
                            const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/png";
                            visionParts.push({ inlineData: { data: img.split(',')[1], mimeType: mimeType } });
                        });

                        const visionConfig = { maxOutputTokens: 65536 };
                        if (modelId.includes('thinking') || modelId.includes('gemini-3')) {
                            visionConfig.thinkingConfig = { includeThoughts: true, thinkingLevel: "HIGH" };
                        }

                        return activeModel.generateContent({
                            contents: [{ role: 'user', parts: visionParts }],
                            generationConfig: visionConfig,
                            safetySettings: [
                                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                            ]
                        });
                    } else {
                        const genConfig = { maxOutputTokens: 65536 };
                        if (modelId.includes('thinking') || modelId.includes('gemini-3')) {
                            genConfig.thinkingConfig = { includeThoughts: true, thinkingLevel: "HIGH" };
                        }

                        const chat = activeModel.startChat({
                            history: history,
                            generationConfig: genConfig,
                            safetySettings: [
                                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                            ]
                        });

                        return chat.sendMessage(prompt || ".");
                    }
                };

                try {
                    result = await executeCall(model);
                } catch (callError) {
                    const errorMsg = (callError.message || '').toLowerCase();
                    const isToolError = errorMsg.includes('tool') || 
                                       errorMsg.includes('grounding') || 
                                       errorMsg.includes('invalid_argument') || 
                                       errorMsg.includes('unsupported');
                    
                    if (isToolError && modelOptions.tools) {
                        console.warn(`Search grounding unsupported on ${modelId} (${callError.message}). Retrying without tools...`);
                        delete modelOptions.tools;
                        const fallbackModel = genAI.getGenerativeModel(modelOptions);
                        result = await executeCall(fallbackModel);
                    } else {
                        throw callError;
                    }
                }

                const response = await result.response;
                if (!response.candidates || response.candidates.length === 0) {
                    throw new Error("Response blocked by safety filters.");
                }
                
                let text = response.text();

                // Critique-and-refining pass for code/competitive modes if laziness is detected
                if (text && (workingMode === 'code' || workingMode === 'competitive')) {
                    const lazyPatterns = [
                        /\/\/\s*\.\.\./i,            // // ...
                        /\/\*\s*\.\.\.\s*\*\//i,    // /* ... */
                        /#\s*\.\.\./i,               // # ...
                        /\/\/\s*TODO/i,              // // TODO
                        /\/\*\s*TODO/i,              // /* TODO
                        /#\s*TODO/i,                 // # TODO
                        /\/\/\s*rest of/i,           // // rest of
                        /\/\/\s*implement/i,          // // implement
                        /\/\/\s*write your/i,        // // write your
                        /#\s*rest of/i,              // # rest of
                        /#\s*implement/i,            // # implement
                        /#\s*write your/i            // # write your
                    ];

                    const hasLaziness = lazyPatterns.some(pattern => pattern.test(text));
                    if (hasLaziness) {
                        console.log("ZNinja Refiner: Lazy placeholder detected in first draft. Initiating refinement pass...");
                        try {
                            const refinerPrompt = `The user asked for:
"${prompt}"

Here is an incomplete draft that contains placeholders, lazy comments (like "// ...", "// TODO"), or missing implementations:
\`\`\`
${text}
\`\`\`

You must rewrite this and output a 100% complete, fully implemented, ready-to-run solution.
Strictly adhere to the following rules:
1. Do NOT use any placeholders, inline TODOs, or truncated snippets under any circumstances. Implement EVERY single method, variable, and class completely.
2. Maintain clean, highly readable code with absolutely minimal or zero comments. Do not write obvious comments.
3. Match the direct, high-density system instruction style (no conversational fillers, no explanations before/after code unless requested).`;

                            const refinerModel = genAI.getGenerativeModel(modelOptions);
                            let refinerResult;
                            
                            const refConfig = { maxOutputTokens: 65536 };
                            if (modelId.includes('thinking') || modelId.includes('gemini-3')) {
                                refConfig.thinkingConfig = { includeThoughts: true, thinkingLevel: "HIGH" };
                            }

                            refinerResult = await refinerModel.generateContent({
                                contents: [{ role: 'user', parts: [{ text: refinerPrompt }] }],
                                generationConfig: refConfig,
                                safetySettings: [
                                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                ]
                            });

                            const refinerResponse = await refinerResult.response;
                            if (refinerResponse.candidates && refinerResponse.candidates.length > 0) {
                                const refinedText = refinerResponse.text();
                                if (refinedText && refinedText.trim().length > 0) {
                                    console.log("ZNinja Refiner: Refinement successful. Returning complete code.");
                                    text = refinedText;
                                }
                            }
                        } catch (refError) {
                            console.error("ZNinja Refiner failed, falling back to original draft:", refError.message);
                        }
                    }
                }

                return { success: true, text, usedModel: modelId };

            } catch (error) {
                const errorMessage = error.message.toLowerCase();
                const isRetryableError = 
                    errorMessage.includes('429') || 
                    errorMessage.includes('quota') || 
                    errorMessage.includes('limit') ||
                    errorMessage.includes('404') || 
                    errorMessage.includes('not found') ||
                    errorMessage.includes('unavailable') || 
                    errorMessage.includes('overloaded') ||
                    errorMessage.includes('503');

                if (isRetryableError) {
                    console.warn(`Key #${kIndex + 1} failed for ${modelId} (${error.message}). Checking next key...`);
                    continue; // Try next API Key
                }
                
                // If not retryable, or last key failed, move to next model fallback
                console.error(`Fatal error for ${modelId} with Key #${kIndex + 1}:`, error.message);
                break; 
            }
        }
    }
    return { success: false, error: "All API Keys and model fallbacks exhausted. Please check your network or quota." };
}

// Stream Gemini
async function streamGemini({ prompt, modelName, images, image, history = [], workingMode }, callbacks) {
    let smartFallbacks = [];
    const isPro = await checkTierInternal();

    // --- SMART ROUTER LOGIC ---
    if (modelName === 'zninja-auto-smart') {
        const lowerPrompt = prompt ? prompt.toLowerCase() : '';
        const codingKeywords = ['code', 'fix', 'api', 'o(n)', 'implementation', 'logic', 'algorithm'];
        const isComplex = image || codingKeywords.some(k => lowerPrompt.includes(k)) || (prompt && prompt.length > 300);

        if (isComplex) {
            console.log("ZNinja Router: Complex/Coding detected.");
            smartFallbacks = [
                "gemini-3.1-pro-preview",
                "gemini-2.5-pro",
                "gemini-3-pro-preview"
            ];
        } else {
            console.log("ZNinja Router: Simple Chat detected.");
            smartFallbacks = [
                "gemini-2.5-flash-lite",
                "gemini-3-flash-preview",
                "gemini-2.5-flash"
            ];
        }
        modelName = smartFallbacks[0];
    }

    const modelFallbacks = [
        ...smartFallbacks,
        modelName,
        "gemini-2.0-flash-thinking-exp",
        "gemini-3-flash",
        "gemini-2.5-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash-002",
        "gemini-1.5-flash"
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    // --- SYSTEM INSTRUCTION LOGIC ---
    const MODE_INSTRUCTIONS = {
        'general': `You are ZNinja, an ultra-direct and highly efficient assistant.
- Give the final correct answer or solution immediately as the very first sentence.
- Eliminate all conversational filler, introductory pleasantries, and redundant explanations.
- Keep reasoning high-density, concise, and purely factual.`,

        'code': `You are ZNinja, an Elite Senior Software Engineer.
- Deliver 100% complete, fully functional, production-ready code.
- Absolutely NO placeholders, no truncated snippets, and no comments like "// TODO" or "// ... rest of code".
- Default to writing NO comments in the code. Code must be highly readable and self-documenting. A maximum of one single-line comment is permitted only for non-obvious algorithmic tricks.
- Structure your output:
  1. A one-sentence explanation of the approach/design.
  2. The complete, clean code block.
  3. Time & Space complexity in Big O notation.
- Eliminate any introductory or concluding conversational fluff.`,

        'competitive': `You are ZNinja, an Elite Algorithmic Solver.
- Deliver the optimal, complete algorithmic solution immediately.
- Use clean, idiomatic code with optimal time and space complexity.
- Absolutely NO comments in the code, NO intro, NO outro, NO explanations, and NO conversational noise.
- Output ONLY the ready-to-paste code block containing the complete solution.`,

        'quiz': `You are ZNinja, an Expert Academic Tutor.
- Output the correct option immediately (e.g., "Option A: [Option Content]").
- Provide exactly one concise sentence justifying the correctness.
- Absolutely NO extra text, introductory greeting, or closing conversation.`
    };

    const defaultSystemInstruction = getSystemInstruction();
    
    let systemInstruction = defaultSystemInstruction;
    if (workingMode && MODE_INSTRUCTIONS[workingMode]) {
        systemInstruction = MODE_INSTRUCTIONS[workingMode];
    }

    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {
        if (callbacks.onError) callbacks.onError("No API Keys configured. Please go to Setup.");
        return;
    }

    // --- EXECUTION LOOP (Models x Keys) ---
    for (const modelId of modelFallbacks) {
        if (!modelId) continue;
        
        for (let kIndex = 0; kIndex < apiKeys.length; kIndex++) {
            const currentKey = apiKeys[kIndex];
            
            try {
                console.log(`Attempting Gemini Streaming (${modelId}) with Key #${kIndex + 1}...`);
                const genAI = new GoogleGenerativeAI(currentKey);

                const isThinkingModel = modelId.includes('thinking');
                const isLegacyModel = modelId.includes('1.5') || modelId.includes('1.0');

                const modelOptions = {
                    model: modelId,
                    systemInstruction: systemInstruction
                };

                // Enable Search Grounding by default for 2.x/3.x non-thinking models
                if (!isThinkingModel && !isLegacyModel) {
                    modelOptions.tools = [{ googleSearch: {} }];
                }

                let model = genAI.getGenerativeModel(modelOptions);
                const allImages = images || (image ? [image] : []);
                let resultStream;

                const executeStreamCall = async (activeModel) => {
                    if (allImages.length > 0) {
                        let visionInstructions = "Analyze image directly.";
                        if (workingMode === 'competitive') visionInstructions = "Solve the CP problem in the image.";
                        else if (workingMode === 'quiz') visionInstructions = "Solve this quiz question.";

                        const visionPrompt = `[VISION ACTIVE] ${visionInstructions}\n${prompt || ""}`;
                        const visionParts = [{ text: visionPrompt }];
                        allImages.forEach(img => {
                            const mimeTypeMatch = img.match(/^data:(image\/[a-zA-Z]*);base64,/);
                            const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/png";
                            visionParts.push({ inlineData: { data: img.split(',')[1], mimeType: mimeType } });
                        });

                        const visionConfig = { maxOutputTokens: 65536 };
                        if (modelId.includes('thinking') || modelId.includes('gemini-3')) {
                            visionConfig.thinkingConfig = { includeThoughts: true, thinkingLevel: "HIGH" };
                        }

                        return activeModel.generateContentStream({
                            contents: [{ role: 'user', parts: visionParts }],
                            generationConfig: visionConfig,
                            safetySettings: [
                                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                            ]
                        });
                    } else {
                        const genConfig = { maxOutputTokens: 65536 };
                        if (modelId.includes('thinking') || modelId.includes('gemini-3')) {
                            genConfig.thinkingConfig = { includeThoughts: true, thinkingLevel: "HIGH" };
                        }

                        const chat = activeModel.startChat({
                            history: history,
                            generationConfig: genConfig,
                            safetySettings: [
                                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                            ]
                        });

                        return chat.sendMessageStream(prompt || ".");
                    }
                };

                try {
                    resultStream = await executeStreamCall(model);
                } catch (callError) {
                    const errorMsg = (callError.message || '').toLowerCase();
                    const isToolError = errorMsg.includes('tool') || 
                                       errorMsg.includes('grounding') || 
                                       errorMsg.includes('invalid_argument') || 
                                       errorMsg.includes('unsupported');
                    
                    if (isToolError && modelOptions.tools) {
                        console.warn(`Search grounding unsupported for streaming on ${modelId} (${callError.message}). Retrying standard stream call...`);
                        delete modelOptions.tools;
                        const fallbackModel = genAI.getGenerativeModel(modelOptions);
                        resultStream = await executeStreamCall(fallbackModel);
                    } else {
                        throw callError;
                    }
                }

                // Consume stream
                for await (const chunk of resultStream.stream) {
                    const chunkText = chunk.text();
                    if (callbacks.onChunk) callbacks.onChunk(chunkText);
                }

                if (callbacks.onDone) callbacks.onDone(modelId);
                return; // Success!

            } catch (error) {
                const errorMessage = error.message.toLowerCase();
                const isRetryableError = 
                    errorMessage.includes('429') || 
                    errorMessage.includes('quota') || 
                    errorMessage.includes('limit') ||
                    errorMessage.includes('404') || 
                    errorMessage.includes('not found') ||
                    errorMessage.includes('unavailable') || 
                    errorMessage.includes('overloaded') ||
                    errorMessage.includes('503');

                if (isRetryableError) {
                    console.warn(`Key #${kIndex + 1} failed for ${modelId} (${error.message}). Checking next key...`);
                    continue; // Try next API Key
                }
                
                // If not retryable, or last key failed, move to next model fallback
                console.error(`Fatal error for ${modelId} with Key #${kIndex + 1}:`, error.message);
                break; 
            }
        }
    }
    
    if (callbacks.onError) callbacks.onError("All API Keys and model fallbacks exhausted. Please check your network or quota.");
}

module.exports = {
    listModels,
    askGemini,
    streamGemini
};
