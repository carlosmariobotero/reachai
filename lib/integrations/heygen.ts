import axios from "axios";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY!;
const HEYGEN_AVATAR_ID = process.env.HEYGEN_AVATAR_ID!;
const HEYGEN_BASE_URL = "https://api.heygen.com/v2";

export interface HeygenVideoRequest {
  script: string;
  avatarId?: string;
  voiceId?: string;
}

export interface HeygenVideoStatus {
  videoId: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  thumbnailUrl?: string;
}

export async function generateVideo(
  request: HeygenVideoRequest
): Promise<{ videoId: string }> {
  const response = await axios.post(
    `${HEYGEN_BASE_URL}/video/generate`,
    {
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: request.avatarId ?? HEYGEN_AVATAR_ID,
          },
          voice: {
            type: "text",
            input_text: request.script,
          },
        },
      ],
    },
    {
      headers: {
        "X-Api-Key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  return { videoId: response.data.data.video_id };
}

export async function getVideoStatus(videoId: string): Promise<HeygenVideoStatus> {
  const response = await axios.get(
    `${HEYGEN_BASE_URL}/video_status.get?video_id=${videoId}`,
    {
      headers: { "X-Api-Key": HEYGEN_API_KEY },
    }
  );

  const data = response.data.data;
  return {
    videoId,
    status: data.status,
    videoUrl: data.video_url,
    thumbnailUrl: data.thumbnail_url,
  };
}
