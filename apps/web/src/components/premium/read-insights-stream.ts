export type InsightsFailure = "refused" | "failed";

// Reads the SSE body from /api/ai/insights. Returns a failure code when the
// server reported an error event, otherwise null.
export async function readInsightsStream(
  body: ReadableStream<Uint8Array>,
  onText: (text: string) => void
): Promise<InsightsFailure | null> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let failure: InsightsFailure | null = null;

  const handleLine = (line: string) => {
    if (!line.startsWith("data: ")) return;
    const data = line.slice(6).trim();
    if (!data || data === "[DONE]") return;
    try {
      const event = JSON.parse(data) as {
        type: string;
        text?: string;
        error?: string;
      };
      if (event.type === "text_delta" && event.text) onText(event.text);
      if (event.type === "error") {
        failure = event.error === "refused" ? "refused" : "failed";
      }
    } catch {
      // Ignore a partial or malformed line.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handleLine);
  }
  handleLine(buffer);

  return failure;
}
