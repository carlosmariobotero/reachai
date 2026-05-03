import axios from "axios";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY!;
const APOLLO_BASE_URL = "https://api.apollo.io/api/v1";

export interface ApolloSearchParams {
  query?: string;
  titles?: string[];
  companies?: string[];
  limit?: number;
}

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  title?: string;
  organization?: { name: string };
  linkedin_url?: string;
}

export async function searchPeople(
  params: ApolloSearchParams
): Promise<ApolloPerson[]> {
  const response = await axios.post(
    `${APOLLO_BASE_URL}/mixed_people/api_search`,
    {
      q_keywords: params.query,
      person_titles: params.titles,
      q_organization_name: params.companies?.join(","),
      per_page: params.limit ?? 25,
    },
    {
      headers: {
        Authorization: `Bearer ${APOLLO_API_KEY}`,
        "X-Api-Key": APOLLO_API_KEY,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data.people ?? [];
}

export async function enrichPerson(email: string): Promise<ApolloPerson | null> {
  const response = await axios.post(
    `${APOLLO_BASE_URL}/people/match`,
    { email },
    {
      headers: {
        Authorization: `Bearer ${APOLLO_API_KEY}`,
        "X-Api-Key": APOLLO_API_KEY,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data.person ?? null;
}
