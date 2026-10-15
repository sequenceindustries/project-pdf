import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Provider-neutral interface for "call a model and get back one structured
 * object". The model is given exactly one tool and forced to call it, so its
 * only possible action is returning data matching our schema. It has no
 * ability to run code, fetch URLs or touch infrastructure.
 */

export type LlmUsage = { model: string; inputTokens: number; outputTokens: number };

export type StructuredCall<T> = {
  model: string;
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  schema: z.ZodType<T>;
  maxTokens: number;
};

export interface LlmProvider {
  call<T>(req: StructuredCall<T>): Promise<{ data: T; usage: LlmUsage }>;
}

export class LlmError extends Error {
  constructor(
    public code: "ai_unavailable" | "ai_bad_output" | "ai_refused" | "ai_rate_limited" | "ai_timeout",
    message: string,
    public retryable: boolean
  ) {
    super(message);
  }
}

export class AnthropicProvider implements LlmProvider {
  private client: Anthropic;
  constructor(apiKey: string, timeoutMs: number) {
    // SDK retries 429/5xx/connection errors with backoff; we add job-level retries on top.
    this.client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 2 });
  }

  async call<T>(req: StructuredCall<T>): Promise<{ data: T; usage: LlmUsage }> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { $schema, ...inputSchema } = z.toJSONSchema(req.schema, { target: "draft-7" }) as Anthropic.Tool["input_schema"] & {
      $schema?: string;
    };
    let res: Anthropic.Message;
    try {
      res = await this.client.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        tools: [{ name: req.toolName, description: req.toolDescription, input_schema: inputSchema }],
        tool_choice: { type: "tool", name: req.toolName },
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new LlmError("ai_rate_limited", "The AI service is busy. We'll retry shortly.", true);
      if (e instanceof Anthropic.APIConnectionTimeoutError) throw new LlmError("ai_timeout", "The AI service took too long to respond.", true);
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
        throw new LlmError("ai_unavailable", "AI analysis is temporarily unavailable.", false);
      }
      if (e instanceof Anthropic.BadRequestError) throw new LlmError("ai_bad_output", "The AI service rejected the request.", false);
      if (e instanceof Anthropic.APIError && (e.status ?? 0) >= 500) {
        throw new LlmError("ai_unavailable", "The AI service is having problems. We'll retry shortly.", true);
      }
      throw new LlmError("ai_unavailable", "Couldn't reach the AI service.", true);
    }
    const usage = { model: res.model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
    if (res.stop_reason === "refusal") throw new LlmError("ai_refused", "The AI declined to process this document.", false);
    const block = res.content.find((b) => b.type === "tool_use" && b.name === req.toolName);
    if (!block || block.type !== "tool_use") throw new LlmError("ai_bad_output", "The AI returned no usable result.", true);
    const parsed = req.schema.safeParse(block.input);
    if (!parsed.success) {
      if (res.stop_reason === "max_tokens") throw new LlmError("ai_bad_output", "The AI result was cut off. Try a shorter request.", false);
      throw new LlmError("ai_bad_output", "The AI returned a result in an unexpected shape.", true);
    }
    return { data: parsed.data, usage };
  }
}
