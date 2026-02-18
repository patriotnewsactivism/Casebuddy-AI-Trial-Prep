
import { GoogleGenAI, Type } from "@google/genai";
import { DocumentType, StrategyInsight, CoachingAnalysis, TrialPhase, SimulationMode } from "../types";
import { retryWithBackoff, withTimeout } from "../utils/errorHandler";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

interface ChatSession {
  id: string;
  chat: ReturnType<typeof ai.chats.create>;
  type: 'witness' | 'opponent' | 'trial';
  createdAt: number;
}

const chatSessions = new Map<string, ChatSession>();

export const createChatSession = (
  id: string,
  type: 'witness' | 'opponent' | 'trial',
  systemInstruction: string,
  initialHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
) => {
  const existing = chatSessions.get(id);
  if (existing) {
    return existing.chat;
  }

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction,
      temperature: 0.9,
    },
    history: initialHistory
  });

  chatSessions.set(id, {
    id,
    chat,
    type,
    createdAt: Date.now()
  });

  return chat;
};

export const getChatSession = (id: string) => {
  return chatSessions.get(id)?.chat || null;
};

export const clearChatSession = (id: string) => {
  chatSessions.delete(id);
};

export const clearAllChatSessions = () => {
  chatSessions.clear();
};

// Helper to convert file blob to base64
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const base64Content = base64data.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeDocument = async (text: string, imagePart?: any) => {
  return retryWithBackoff(async () => {
    const model = imagePart ? 'gemini-2.5-flash' : 'gemini-2.5-flash';
    const prompt = `Analyze the following legal document content.
    Extract:
    1. A concise summary (max 3 sentences).
    2. Key legal entities (people, organizations, statutes).
    3. A list of potential risks or contradictions found in the text.

    Return the response in JSON format.
    `;

    const parts = [];
    if (imagePart) parts.push(imagePart);
    parts.push({ text: prompt + "\n\nDocument Content:\n" + text });

    const response = await withTimeout(
      ai.models.generateContent({
        model: model,
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              entities: { type: Type.ARRAY, items: { type: Type.STRING } },
              risks: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      }),
      30000 // 30 second timeout
    );

    return JSON.parse(response.text || '{}');
  }, 3); // Retry up to 3 times
};

export const generateWitnessResponse = async (
  sessionId: string,
  message: string,
  witnessName: string,
  personality: string,
  caseContext: string,
  forceNew: boolean = false
) => {
  try {
    const systemInstruction = `You are roleplaying as a witness named ${witnessName} in a legal trial.
    Your personality is: ${personality}.
    Case Context: ${caseContext}.

    Rules:
    1. Stay in character at all times.
    2. If you are 'hostile', be short, evasive, and defensive.
    3. If you are 'nervous', stutter occasionally and be unsure.
    4. If you are 'cooperative', provide helpful details but only what you know.
    5. Do not break character or mention you are an AI.
    6. Keep responses relatively concise, as in a courtroom cross-examination.
    `;

    if (forceNew) {
      clearChatSession(sessionId);
    }

    let chat = getChatSession(sessionId);
    if (!chat) {
      chat = createChatSession(sessionId, 'witness', systemInstruction);
    }

    const response = await withTimeout(
      chat.sendMessage({ message }),
      20000
    );

    return response.text;

  } catch (error) {
    throw new Error(`Witness simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const predictStrategy = async (caseSummary: string, opponentProfile: string): Promise<StrategyInsight[]> => {
  try {
    // Using thinking model for complex reasoning
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Analyze this case and the opposing counsel profile.
        Case: ${caseSummary}
        Opponent: ${opponentProfile}

        Provide 3 strategic insights (Risks, Opportunities, or Predictions).
        Think deeply about the opponent's psychological tendencies and legal history.
        `,
        config: {
          thinkingConfig: { thinkingBudget: 2048 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                confidence: { type: Type.NUMBER, description: "0 to 100" },
                type: { type: Type.STRING, enum: ['risk', 'opportunity', 'prediction'] }
              }
            }
          }
        }
      }),
      45000 // 45 second timeout for thinking model
    );

    return JSON.parse(response.text || '[]');
  } catch (error) {
    throw new Error(`Strategy prediction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const generateOpponentResponse = async (
  sessionId: string,
  message: string,
  opponentName: string,
  opponentStyle: string,
  caseContext: string,
  forceNew: boolean = false
) => {
  try {
    const systemInstruction = `You are ${opponentName}, opposing counsel in a trial.
    Style: ${opponentStyle}.
    Case Context: ${caseContext}.

    Rules:
    1. Argue effectively against the user's points.
    2. Be professional but adversarial.
    3. Use objections if the user violates legal procedure (e.g., hearsay, leading).
    4. Keep responses under 4 sentences to maintain flow.
    5. Do not admit defeat easily; pivot if cornered.
    `;

    if (forceNew) {
      clearChatSession(sessionId);
    }

    let chat = getChatSession(sessionId);
    if (!chat) {
      chat = createChatSession(sessionId, 'opponent', systemInstruction);
    }

    const response = await withTimeout(
      chat.sendMessage({ message }),
      20000
    );

    return response.text;

  } catch (error) {
    throw new Error(`Opponent simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const getCoachingTip = async (
  lastUserMessage: string,
  lastOpponentMessage: string,
  caseContext: string
): Promise<CoachingAnalysis | null> => {
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a senior legal strategist coaching a junior attorney during a mock argument.

        Context: ${caseContext}

        The exchange just happened:
        Attorney (User): "${lastUserMessage}"
        Opposing Counsel: "${lastOpponentMessage}"

        Provide a JSON response with:
        1. "critique": A 1-sentence critique of the user's last argument.
        2. "suggestion": A short tip on what to say or do next.
        3. "sampleResponse": A recommended strong rebuttal string.
        4. "fallaciesIdentified": A list of any logical fallacies committed by EITHER the user or the opponent (e.g., Ad Hominem, Straw Man, Red Herring, False Equivalence). If none, return empty list.
        5. "rhetoricalEffectiveness": A score from 0-100 of how persuasive and rhetorically sound the user's argument was.
        6. "rhetoricalFeedback": A brief comment on tone, pacing, or persuasive impact (e.g. "Tone was too defensive", "Great use of ethos").
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              critique: { type: Type.STRING },
              suggestion: { type: Type.STRING },
              sampleResponse: { type: Type.STRING },
              fallaciesIdentified: { type: Type.ARRAY, items: { type: Type.STRING } },
              rhetoricalEffectiveness: { type: Type.NUMBER },
              rhetoricalFeedback: { type: Type.STRING },
            }
          }
        }
      }),
      20000 // 20 second timeout
    );

    return JSON.parse(response.text || '{}');
  } catch (error) {
    // Return null for coaching failures - it's not critical
    return null;
  }
};

// New helper for Trial Sim System Instructions
export const getTrialSimSystemInstruction = (
  phase: TrialPhase,
  mode: SimulationMode,
  opponentName: string,
  caseContext: string
) => {
  const baseRole = `You are an advanced legal AI simulator. The user is a practicing attorney. You must simulate the courtroom environment realistically.`;
  
  // Aggressiveness based on mode
  let objectionPolicy = "";
  if (mode === 'trial') {
    objectionPolicy = `
      MODE: TRIAL (HARD).
      - You MUST be aggressive.
      - Interrupt the user IMMEDIATELY if they make a mistake.
      - Do not give hints.
      - Object to everything that is even slightly objectionable.
    `;
  } else if (mode === 'practice') {
    objectionPolicy = `
      MODE: PRACTICE (MEDIUM).
      - Object if the user makes a clear error.
      - Offer brief guidance after the objection on how to cure it.
    `;
  } else {
    objectionPolicy = `
      MODE: LEARN (EASY).
      - Rarely object, mainly explain concepts.
      - Focus on guiding the user.
    `;
  }

  let phaseInstructions = "";
  switch (phase) {
    case 'pre-trial-motions':
      phaseInstructions = `
        PHASE: PRE-TRIAL MOTIONS (e.g., Motion to Suppress, Motion in Limine).
        Role: You are the JUDGE and OPPOSING COUNSEL (${opponentName}).
        
        ACTION:
        - As Judge: Listen to the user's argument on admissibility/procedure. Ask clarification questions. Rule on the motion.
        - As Opposing Counsel: Interject with counter-arguments regarding the legal basis.
      `;
      break;
    case 'voir-dire':
      phaseInstructions = `
        PHASE: VOIR DIRE (Jury Selection).
        Role: You play individual JURORS (switch personas often) and the OPPOSING COUNSEL (${opponentName}).
        
        OPPOSING COUNSEL OBJECTIONS:
        - "Objection! Pre-conditioning the jury." (If user argues facts of case)
        - "Objection! Asking for a commitment." (If user asks "Would you vote X?")
        - "Objection! Personal question."
      `;
      break;
    case 'opening-statement':
      phaseInstructions = `
        PHASE: OPENING STATEMENT.
        Role: You are the JUDGE and OPPOSING COUNSEL (${opponentName}).
        
        OPPOSING COUNSEL OBJECTIONS:
        - "Objection! Argumentative." (If user starts arguing inferences instead of stating facts)
        - "Objection! Facts not in evidence."
        - "Objection! Vouching for credibility."
        
        As JUDGE, sustain/overrule.
      `;
      break;
    case 'direct-examination':
      phaseInstructions = `
        PHASE: DIRECT EXAMINATION.
        Role: You are the WITNESS (Cooperative).
        
        OPPOSING COUNSEL OBJECTIONS (CRITICAL):
        - "Objection! LEADING QUESTION." (If user asks Yes/No questions suggesting the answer).
        - "Objection! Hearsay."
        - "Objection! Calls for speculation."
        - "Objection! Compound question."
      `;
      break;
    case 'cross-examination':
      phaseInstructions = `
        PHASE: CROSS EXAMINATION.
        Role: You are the HOSTILE WITNESS.
        
        OPPOSING COUNSEL OBJECTIONS:
        - "Objection! Badgering the witness." (If user is shouting or repetitive)
        - "Objection! Asked and answered."
        - "Objection! Argumentative."
        - "Objection! Assumes facts not in evidence."
        
        As WITNESS: Be evasive, admit nothing unless pinned down.
      `;
      break;
    case 'closing-argument':
      phaseInstructions = `
        PHASE: CLOSING ARGUMENT.
        Role: You are the JUDGE and OPPOSING COUNSEL (${opponentName}).
        
        OPPOSING COUNSEL OBJECTIONS:
        - "Objection! Misstating the evidence."
        - "Objection! Misstating the law."
        - "Objection! Personal attack on counsel."
        - "Objection! Golden Rule argument." (Asking jury to step in victim's shoes)
      `;
      break;
    case 'defendant-testimony':
      phaseInstructions = `
        PHASE: DEFENDANT TESTIMONY (User is Defendant).
        Role: You are the PROSECUTOR (${opponentName}).
        
        ACTION:
        - Cross-examine the user aggressively.
        - Try to catch them in lies regarding: ${caseContext}
        - Use Leading Questions against the user.
        - Impeach them with prior statements if they contradict themselves.
      `;
      break;
    case 'sentencing':
      phaseInstructions = `
        PHASE: SENTENCING HEARING.
        Role: You are the JUDGE.
        
        ACTION:
        - Listen to the user's allocution or sentencing recommendation.
        - Weigh factors of mitigation (remorse, lack of history) and aggravation (harm caused).
        - Deliver the sentence at the end.
      `;
      break;
  }

  return `
    ${baseRole}
    ${phaseInstructions}
    ${objectionPolicy}
    
    Case Context: ${caseContext}

    CRITICAL TOOLS INSTRUCTIONS:
    1. 'sendCoachingTip': Use this to provide scripts or feedback text to the user.
    2. 'raiseObjection': IF you object verbally, you MUST also call this tool immediately to flash the objection on screen.
    
    AUDIO BEHAVIOR:
    - Speak clearly and professionally.
    - If objecting, speak loudly: "OBJECTION! [Grounds]."
    - Do not ramble.
  `;
};
