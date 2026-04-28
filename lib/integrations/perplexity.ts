import axios from "axios";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY!;
const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

export interface PerplexitySearchResult {
  query: string;
  answer: string;
  sources?: string[];
}

export async function research(query: string): Promise<PerplexitySearchResult> {
  const response = await axios.post(
    `${PERPLEXITY_BASE_URL}/chat/completions`,
    {
      model: "llama-3.1-sonar-small-128k-online",
      messages: [{ role: "user", content: query }],
    },
    {
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const answer = response.data.choices?.[0]?.message?.content ?? "";
  return { query, answer };
}

export async function researchCompany(companyName: string): Promise<PerplexitySearchResult> {
  return research(
    `Research the company "${companyName}": what do they do, recent news, key pain points, and growth signals.`
  );
}

export async function researchPerson(
  name: string,
  company: string
): Promise<PerplexitySearchResult> {
  return research(
    `Research ${name} at ${company}: their role, recent activity, LinkedIn presence, and professional background.`
  );
}
