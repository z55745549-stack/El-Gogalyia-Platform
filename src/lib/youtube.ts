// YouTube Integration Utilities & Playlist Importer

export interface YouTubePlaylistItem {
  videoId: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  position: number;
  duration?: string;
}

/**
 * Extracts a YouTube playlist ID from any supported URL format.
 */
export function extractYouTubePlaylistId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Extracts a YouTube video ID from any supported URL format.
 */
export function extractYouTubeVideoId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Fetches YouTube video oEmbed title if available.
 */
export async function fetchYouTubeVideoTitle(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    if (res.ok) {
      const data = await res.json();
      return data.title || null;
    }
  } catch (e) {
    // Ignore fallback
  }
  return null;
}

/**
 * Fetches playlist items using YouTube Data API v3 if key is configured.
 */
async function fetchViaYouTubeDataAPI(playlistId: string, apiKey: string): Promise<YouTubePlaylistItem[] | null> {
  try {
    const items: YouTubePlaylistItem[] = [];
    let nextPageToken = '';
    let pageCount = 0;

    do {
      pageCount++;
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${encodeURIComponent(
        playlistId
      )}&key=${encodeURIComponent(apiKey)}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;

      const res = await fetch(url);
      if (!res.ok) break;

      const data = await res.json();
      if (!data.items || !Array.isArray(data.items)) break;

      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        const snippet = item.snippet;
        const videoId = snippet?.resourceId?.videoId || item.contentDetails?.videoId;
        if (!videoId) continue;

        const title = snippet.title || `درس ${items.length + 1}`;
        if (title === 'Private video' || title === 'Deleted video') continue;

        const thumb =
          snippet.thumbnails?.maxres?.url ||
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        items.push({
          videoId,
          title,
          description: snippet.description || '',
          thumbnailUrl: thumb,
          position: items.length + 1,
        });
      }

      nextPageToken = data.nextPageToken;
    } while (nextPageToken && pageCount < 5);

    return items.length > 0 ? items : null;
  } catch (err) {
    console.warn('fetchViaYouTubeDataAPI failed:', err);
    return null;
  }
}

/**
 * Fetches playlist items by parsing YouTube public RSS feed via CORS proxy.
 */
async function fetchViaPublicFeed(playlistId: string): Promise<YouTubePlaylistItem[] | null> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
  const proxyEndpoints = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(feedUrl)}`,
  ];

  for (const proxyUrl of proxyEndpoints) {
    try {
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;

      const text = await res.text();
      if (!text || !text.includes('<feed')) continue;

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      const entries = xmlDoc.getElementsByTagName('entry');

      if (entries.length > 0) {
        const items: YouTubePlaylistItem[] = [];
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const videoIdElem = entry.getElementsByTagName('yt:videoId')[0];
          const titleElem = entry.getElementsByTagName('title')[0];
          const videoId = videoIdElem?.textContent?.trim();
          const title = titleElem?.textContent?.trim() || `الدرس ${i + 1}`;

          if (videoId) {
            items.push({
              videoId,
              title,
              thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              position: i + 1,
            });
          }
        }
        if (items.length > 0) return items;
      }
    } catch (e) {
      // Try next endpoint
    }
  }

  return null;
}

/**
 * Fetches playlist items via public Invidious API instances.
 */
async function fetchViaInvidious(playlistId: string): Promise<YouTubePlaylistItem[] | null> {
  const instances = [
    'https://invidious.privacydev.net',
    'https://vid.priv.au',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
  ];

  for (const host of instances) {
    try {
      const res = await fetch(`${host}/api/v1/playlists/${encodeURIComponent(playlistId)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      if (data.videos && Array.isArray(data.videos) && data.videos.length > 0) {
        return data.videos.map((v: any, idx: number) => ({
          videoId: v.videoId,
          title: v.title || `الدرس ${idx + 1}`,
          description: v.description || '',
          thumbnailUrl:
            v.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
          position: idx + 1,
          duration: v.lengthSeconds ? `${Math.floor(v.lengthSeconds / 60)} دقيقة` : undefined,
        }));
      }
    } catch (e) {
      // Try next instance
    }
  }

  return null;
}

/**
 * Main function: Imports and resolves a YouTube playlist into an array of structured lesson items.
 */
export async function importYouTubePlaylist(urlOrId: string): Promise<{
  playlistId: string;
  items: YouTubePlaylistItem[];
}> {
  let playlistId = extractYouTubePlaylistId(urlOrId) || urlOrId.trim();

  // If input is a single video URL instead of a playlist
  if (!playlistId.startsWith('PL') && !playlistId.startsWith('UU') && !playlistId.startsWith('OL')) {
    const singleVideoId = extractYouTubeVideoId(urlOrId);
    if (singleVideoId) {
      const title = (await fetchYouTubeVideoTitle(singleVideoId)) || 'الدرس الأول (فيديو تعليمي)';
      return {
        playlistId: `single_${singleVideoId}`,
        items: [
          {
            videoId: singleVideoId,
            title,
            thumbnailUrl: `https://img.youtube.com/vi/${singleVideoId}/hqdefault.jpg`,
            position: 1,
          },
        ],
      };
    }
  }

  if (!playlistId) {
    throw new Error('رابط قائمة تشغيل يوتيوب غير صالح.');
  }

  // 1. Try YouTube Data API if key provided
  const apiKey = (import.meta as any).env?.VITE_YOUTUBE_API_KEY;
  if (apiKey) {
    const apiResult = await fetchViaYouTubeDataAPI(playlistId, apiKey);
    if (apiResult && apiResult.length > 0) {
      return { playlistId, items: apiResult };
    }
  }

  // 2. Try Public RSS Feed via proxy
  const rssResult = await fetchViaPublicFeed(playlistId);
  if (rssResult && rssResult.length > 0) {
    return { playlistId, items: rssResult };
  }

  // 3. Try Invidious API
  const invidiousResult = await fetchViaInvidious(playlistId);
  if (invidiousResult && invidiousResult.length > 0) {
    return { playlistId, items: invidiousResult };
  }

  // Fallback: If playlist cannot be auto-fetched due to CORS/network restrictions,
  // return an initial starter lesson based on the first video or a clean template so Admin can customize.
  const fallbackVideoId = extractYouTubeVideoId(urlOrId);
  if (fallbackVideoId) {
    return {
      playlistId,
      items: [
        {
          videoId: fallbackVideoId,
          title: 'الدرس الأول - مقدمة الدورة',
          thumbnailUrl: `https://img.youtube.com/vi/${fallbackVideoId}/hqdefault.jpg`,
          position: 1,
        },
      ],
    };
  }

  throw new Error(
    'تعذر جلب فيديوهات قائمة التشغيل تلقائياً. تأكد من أن قائمة التشغيل عامة (Public) أو تحقق من صحة الرابط.'
  );
}
