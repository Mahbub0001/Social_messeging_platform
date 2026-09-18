export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  pubDate: string;
  description: string;
  thumbnail?: string;
}

export interface NewsFetchResult {
  success: boolean;
  category: string;
  articles: NewsItem[];
  summary: string;
}

interface CacheEntry {
  timestamp: number;
  data: NewsItem[];
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
const memoryCache: Record<string, CacheEntry> = {};

// Clean HTML tags and entities from RSS descriptions
function cleanHtml(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Format date to human readable string
function formatNewsDate(rawDate: string): string {
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      return (
        d.toLocaleTimeString("bn-BD", {
          timeZone: "Asia/Dhaka",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }) +
        `, ${d.toLocaleDateString("bn-BD", {
          timeZone: "Asia/Dhaka",
          day: "numeric",
          month: "short",
        })}`
      );
    }
  } catch {}
  return rawDate;
}

class NewsService {
  /**
   * Fetch RSS feed converted to JSON via rss2json
   */
  private async fetchRss(rssUrl: string, sourceName: string): Promise<NewsItem[]> {
    try {
      const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
        rssUrl
      )}`;
      const res = await fetch(endpoint);
      if (!res.ok) return [];

      const data = await res.json();
      if (data.status !== "ok" || !Array.isArray(data.items)) return [];

      return data.items.map((item: any, idx: number) => ({
        id: `${sourceName.toLowerCase()}-${idx}-${Date.now()}`,
        title: cleanHtml(item.title || ""),
        link: item.link || "",
        source: sourceName,
        pubDate: formatNewsDate(item.pubDate || ""),
        description:
          cleanHtml(item.description || item.content || "").slice(0, 180) + "...",
        thumbnail:
          item.thumbnail ||
          item.enclosure?.link ||
          item.enclosure?.thumbnail,
      }));
    } catch (e) {
      console.warn(`[NewsService] Failed to fetch feed from ${sourceName}:`, e);
      return [];
    }
  }

  /**
   * Search Wikipedia for factual topics if no news matched
   */
  private async searchWikipedia(query: string): Promise<NewsItem[]> {
    try {
      // First try Bengali Wikipedia
      let res = await fetch(
        `https://bn.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          query
        )}&format=json&origin=*`
      );
      let data = await res.json();
      let results = data?.query?.search || [];

      // Fallback to English Wikipedia if no Bengali results
      if (!results || results.length === 0) {
        res = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
            query
          )}&format=json&origin=*`
        );
        data = await res.json();
        results = data?.query?.search || [];
      }

      return (results || []).slice(0, 3).map((item: any, idx: number) => ({
        id: `wiki-${idx}-${Date.now()}`,
        title: cleanHtml(item.title || ""),
        link: `https://bn.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
        source: "Wikipedia",
        pubDate: "রিয়েল-টাইম তথ্য",
        description: cleanHtml(item.snippet || "") + "...",
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get latest news articles based on category and optional search keyword
   */
  public async getLatestNews(
    category: string = "bangladesh",
    query?: string
  ): Promise<NewsFetchResult> {
    const normCategory = (category || "bangladesh").toLowerCase();
    const cacheKey = `${normCategory}_${(query || "").toLowerCase()}`;

    // Check memory cache
    const cached = memoryCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        success: true,
        category: normCategory,
        articles: cached.data,
        summary: this.generateSummary(cached.data, normCategory, query),
      };
    }

    const promises: Promise<NewsItem[]>[] = [];

    // Decide which feeds to fetch based on category
    if (normCategory === "world" || normCategory === "international") {
      promises.push(this.fetchRss("https://feeds.bbci.co.uk/news/rss.xml", "BBC News"));
      promises.push(this.fetchRss("https://feeds.bbci.co.uk/bengali/rss.xml", "BBC বাংলা"));
    } else {
      // Default / Bangladesh
      promises.push(this.fetchRss("https://www.prothomalo.com/feed", "প্রথম আলো"));
      promises.push(this.fetchRss("https://feeds.bbci.co.uk/bengali/rss.xml", "BBC বাংলা"));
      if (normCategory === "general") {
        promises.push(this.fetchRss("https://feeds.bbci.co.uk/news/rss.xml", "BBC News"));
      }
    }

    const results = await Promise.all(promises);
    let allArticles = results.flat();

    // Deduplicate by title similarity
    const seenTitles = new Set<string>();
    allArticles = allArticles.filter((item) => {
      const normalizedTitle = item.title
        .toLowerCase()
        .replace(/[^\w\s\u0980-\u09FF]/g, "");
      if (seenTitles.has(normalizedTitle)) return false;
      seenTitles.add(normalizedTitle);
      return true;
    });

    // If query provided, filter items
    if (query && query.trim()) {
      const cleanQ = query.trim().toLowerCase();
      const filtered = allArticles.filter(
        (a) =>
          a.title.toLowerCase().includes(cleanQ) ||
          a.description.toLowerCase().includes(cleanQ)
      );

      if (filtered.length > 0) {
        allArticles = filtered;
      } else {
        // Fallback to Wikipedia search if query not found in top headlines
        const wikiArticles = await this.searchWikipedia(query);
        if (wikiArticles.length > 0) {
          allArticles = [...wikiArticles, ...allArticles.slice(0, 3)];
        }
      }
    }

    // Category specific keyword filtering
    if (normCategory === "sports" || normCategory === "খেলা") {
      const sportsTerms = [
        "খেলা",
        "ক্রিকেট",
        "ফুটবল",
        "sports",
        "cricket",
        "football",
        "goal",
        "match",
        "সিরিজ",
      ];
      const sports = allArticles.filter((a) =>
        sportsTerms.some(
          (t) =>
            a.title.toLowerCase().includes(t) ||
            a.description.toLowerCase().includes(t)
        )
      );
      if (sports.length > 0) allArticles = sports;
    } else if (
      normCategory === "technology" ||
      normCategory === "tech" ||
      normCategory === "প্রযুক্তি"
    ) {
      const techTerms = [
        "প্রযুক্তি",
        "tech",
        "ai",
        "মোবাইল",
        "স্মার্টফোন",
        "গুগল",
        "অ্যাপ",
        "কম্পিউটার",
      ];
      const tech = allArticles.filter((a) =>
        techTerms.some(
          (t) =>
            a.title.toLowerCase().includes(t) ||
            a.description.toLowerCase().includes(t)
        )
      );
      if (tech.length > 0) allArticles = tech;
    }

    // Pick top 6 most relevant/recent articles
    const selectedArticles = allArticles.slice(0, 6);

    // Save to memory cache
    memoryCache[cacheKey] = {
      timestamp: Date.now(),
      data: selectedArticles,
    };

    return {
      success: selectedArticles.length > 0,
      category: normCategory,
      articles: selectedArticles,
      summary: this.generateSummary(selectedArticles, normCategory, query),
    };
  }

  /**
   * Helper to format a clean Bengali text summary of top articles
   */
  private generateSummary(
    articles: NewsItem[],
    category: string,
    query?: string
  ): string {
    if (articles.length === 0) {
      return "দুঃখিত, এই মুহূর্তে নির্দিষ্ট বিষয়ের ওপর কোনো লাইভ সংবাদ পাওয়া যায়নি।";
    }

    let header = "";
    if (query) {
      header = `📰 **"${query}" সম্পর্কিত সর্বশেষ সংবাদ ও আপডেট:**\n\n`;
    } else if (category === "sports" || category === "খেলা") {
      header = `🏆 **আজকের সর্বশেষ খেলার খবর:**\n\n`;
    } else if (category === "world" || category === "international") {
      header = `🌍 **আজকের আন্তর্জাতিক তাজা খবর:**\n\n`;
    } else {
      header = `📰 **আজকের শীর্ষ ও তাজা খবর (বাংলাদেশ ও বিশ্ব):**\n\n`;
    }

    const itemsText = articles
      .map(
        (a, i) =>
          `${i + 1}. **${a.title}**\n   _${a.source}_ • ${a.pubDate}\n   ${a.description}`
      )
      .join("\n\n");

    return `${header}${itemsText}\n\n👉 *বিস্তারিত পড়তে নিচের সংবাদের কার্ডগুলোতে ট্যাপ করতে পারেন।*`;
  }
}

export const newsService = new NewsService();
