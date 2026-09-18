// Weather Service using Open-Meteo (Free, No API key, CORS-enabled)

export interface WeatherData {
  location: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherDescription: string;
  isDay: boolean;
}

const BD_CITIES_MAP: Record<string, string> = {
  "নরসিংদী": "Narsingdi",
  "নরসিংদীতে": "Narsingdi",
  "ঢাকা": "Dhaka",
  "ঢাকায়": "Dhaka",
  "ঢাকাতে": "Dhaka",
  "চট্টগ্রাম": "Chittagong",
  "চট্টগ্রামে": "Chittagong",
  "সিলেট": "Sylhet",
  "সিলেটে": "Sylhet",
  "রাজশাহী": "Rajshahi",
  "রাজশাহীতে": "Rajshahi",
  "খুলনা": "Khulna",
  "খুলনায়": "Khulna",
  "বরিশাল": "Barisal",
  "বরিশালে": "Barisal",
  "রংপুর": "Rangpur",
  "রংপুরে": "Rangpur",
  "ময়মনসিংহ": "Mymensingh",
  "ময়মনসিংহ": "Mymensingh",
  "কুমিল্লা": "Comilla",
  "কুমিল্লায়": "Comilla",
  "গাজীপুর": "Gazipur",
  "গাজীপুরে": "Gazipur",
  "নারায়ণগঞ্জ": "Narayanganj",
  "নারায়ণগঞ্জ": "Narayanganj",
  "কক্সবাজার": "Cox's Bazar",
  "কক্সবাজারে": "Cox's Bazar",
  "বগুড়া": "Bogra",
  "বগুড়া": "Bogra",
  "যশোর": "Jashore",
  "যশোরে": "Jashore",
  "দিনাজপুর": "Dinajpur",
  "ফরিদপুর": "Faridpur",
  "পাবনা": "Pabna",
  "টাঙ্গাইল": "Tangail",
  "ব্রাহ্মণবাড়িয়া": "Brahmanbaria",
  "ব্রাহ্মণবাড়িয়া": "Brahmanbaria",
};

// Translate WMO weather codes to concise Bengali descriptions
function getWeatherDescriptionBn(code: number, isDay: boolean = true): string {
  switch (code) {
    case 0:
      return isDay ? "আকাশ পরিষ্কার ও রৌদ্রোজ্জ্বল" : "আকাশ পরিষ্কার";
    case 1:
    case 2:
      return "প্রধানত পরিষ্কার ও হালকা মেঘলা";
    case 3:
      return "আংশিক মেঘলা";
    case 45:
    case 48:
      return "কুয়াশাচ্ছন্ন";
    case 51:
    case 53:
    case 55:
      return "হালকা গুঁড়ি গুঁড়ি বৃষ্টি";
    case 61:
    case 63:
      return "মাঝারি বৃষ্টিপাত";
    case 65:
      return "ভারী বৃষ্টিপাত";
    case 71:
    case 73:
    case 75:
      return "তুষারপাত";
    case 80:
    case 81:
    case 82:
      return "বৃষ্টির সম্ভাবনা রয়েছে";
    case 95:
    case 96:
    case 99:
      return "বজ্রসহ বৃষ্টিপাত";
    default:
      return "স্বাভাবিক আবহাওয়া";
  }
}

class WeatherService {
  /**
   * Normalize location string
   */
  private cleanLocationName(raw: string): string {
    let loc = raw.trim();
    // Check Bengali dictionary
    for (const [bnName, enName] of Object.entries(BD_CITIES_MAP)) {
      if (loc.includes(bnName)) return enName;
    }

    // Strip common Bengali suffixes (যেমন: নরসিংদীতে -> নরসিংদী)
    loc = loc.replace(/(তে|এ|র|এর|city|district)$/i, "").trim();
    return loc || "Dhaka";
  }

  /**
   * Fetch real-time weather concisely
   */
  public async getWeather(locationQuery: string): Promise<{
    success: boolean;
    text: string;
    data?: WeatherData;
  }> {
    try {
      const cleanLoc = this.cleanLocationName(locationQuery);

      // 1. Geocode location name
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        cleanLoc
      )}&count=1&language=en&format=json`;

      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();

      if (!geoData?.results || geoData.results.length === 0) {
        return {
          success: false,
          text: `'${locationQuery}' এর আবহাওয়া তথ্য পাওয়া যায়নি। অনুগ্রহ করে শহরের নাম সঠিকভাবে লিখুন।`,
        };
      }

      const place = geoData.results[0];
      const lat = place.latitude;
      const lon = place.longitude;
      const resolvedName = place.name || cleanLoc;

      // 2. Fetch current weather forecast from Open-Meteo
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=auto`;

      const wRes = await fetch(weatherUrl);
      const wData = await wRes.json();
      const current = wData?.current;

      if (!current) {
        return {
          success: false,
          text: "এই মুহূর্তে আবহাওয়া সার্ভার থেকে তথ্য সংগ্রহ করা যাচ্ছে না।",
        };
      }

      const temp = Math.round(current.temperature_2m);
      const apparent = Math.round(current.apparent_temperature);
      const humidity = current.relative_humidity_2m;
      const desc = getWeatherDescriptionBn(current.weather_code, current.is_day === 1);

      // Construct a crisp, concise 1-sentence answer
      const resultText = `🌡️ **${resolvedName}**-এ বর্তমান তাপমাত্রা **${temp}°C** (অনুভূত হচ্ছে প্রায় ${apparent}°C), আর্দ্রতা ${humidity}%, এবং ${desc}।`;

      return {
        success: true,
        text: resultText,
        data: {
          location: resolvedName,
          temperature: temp,
          apparentTemperature: apparent,
          humidity,
          windSpeed: current.wind_speed_10m,
          weatherDescription: desc,
          isDay: current.is_day === 1,
        },
      };
    } catch (e) {
      console.error("[WeatherService] Error:", e);
      return {
        success: false,
        text: "আবহাওয়া তথ্য লোড করার সময় একটি ত্রুটি ঘটেছে।",
      };
    }
  }
}

export const weatherService = new WeatherService();
