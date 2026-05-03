import axios from "axios";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY?.trim() ?? "";
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
  const searchParams = new URLSearchParams();
  params.titles?.forEach((title) => searchParams.append("person_titles[]", title));
  if (params.query) searchParams.set("q_keywords", params.query);
  if (params.companies?.length) searchParams.set("q_organization_name", params.companies.join(","));
  searchParams.set("page", "1");
  searchParams.set("per_page", String(params.limit ?? 25));

  const response = await axios.post(
    `${APOLLO_BASE_URL}/mixed_people/api_search?${searchParams.toString()}`,
    undefined,
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
