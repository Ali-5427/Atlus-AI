import { ChatMessage, UserProfile, SearchMode } from "../types";

const LOCAL_API_URL = '/api/chat';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function generateResponse(
  messages: ChatMessage[],
  profile: UserProfile | null,
  mode: SearchMode,
  onStream?: (chunk: string) => void,
  onSources?: (sources: any[]) => void,
  onStatus?: (status: string) => void
): Promise<string> {
  // Call our local backend proxy
  return callBackendLlm(messages, profile, mode, onStream, onSources, onStatus);
}

async function callBackendLlm(
  messages: ChatMessage[],
  profile: UserProfile | null,
  mode: SearchMode,
  onStream?: (chunk: string) => void,
  onSources?: (sources: any[]) => void,
  onStatus?: (status: string) => void
): Promise<string> {
  const body = {
    model: GROQ_MODEL,
    mode,
    messages: messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    })),
    stream: !!onStream,
    temperature: 0.7,
    max_tokens: 4096,
  };

  const response = await fetch(LOCAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`AI Service Error: ${errorData.error?.message || response.statusText}`);
  }

  if (onStream) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body is null");

    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ""; // Keep the last partial line in the buffer

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
        
        if (trimmedLine.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmedLine.slice(6));
            
            // Handle Typed Chunks
            switch (data.type) {
              case 'status':
                if (onStatus) onStatus(data.content);
                break;
              case 'sources':
                if (onSources) onSources(data.content);
                break;
              case 'answer':
                if (onStream) {
                  fullText += data.content;
                  onStream(data.content);
                }
                break;
              case 'error':
                if (onStatus) onStatus(`Error: ${data.content || "Failed to generate response"}`);
                break;
              case 'research_complete':
                if (onStatus) onStatus("Research complete. Synthesizing...");
                break;
              case 'done':
                if (onStatus) onStatus("Done.");
                break;
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", e, "Line:", trimmedLine);
          }
        }
      }
    }
    return fullText;
  } else {
    const data = await response.json();
    if (data.sources && onSources) {
      onSources(data.sources);
    }
    return data.choices[0].message.content;
  }
}
