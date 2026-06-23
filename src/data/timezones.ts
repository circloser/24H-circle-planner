export interface TzOption {
  tz: string; // IANA time zone id
  ko: string;
  en: string;
}

/** A curated set of common world time zones (city labels). */
export const TIMEZONES: TzOption[] = [
  { tz: 'America/Los_Angeles', ko: '로스앤젤레스', en: 'Los Angeles' },
  { tz: 'America/Denver', ko: '덴버', en: 'Denver' },
  { tz: 'America/Chicago', ko: '시카고', en: 'Chicago' },
  { tz: 'America/New_York', ko: '뉴욕', en: 'New York' },
  { tz: 'America/Sao_Paulo', ko: '상파울루', en: 'São Paulo' },
  { tz: 'Europe/London', ko: '런던', en: 'London' },
  { tz: 'Europe/Paris', ko: '파리', en: 'Paris' },
  { tz: 'Europe/Berlin', ko: '베를린', en: 'Berlin' },
  { tz: 'Europe/Moscow', ko: '모스크바', en: 'Moscow' },
  { tz: 'Asia/Dubai', ko: '두바이', en: 'Dubai' },
  { tz: 'Asia/Kolkata', ko: '뭄바이', en: 'Mumbai' },
  { tz: 'Asia/Bangkok', ko: '방콕', en: 'Bangkok' },
  { tz: 'Asia/Shanghai', ko: '베이징', en: 'Beijing' },
  { tz: 'Asia/Hong_Kong', ko: '홍콩', en: 'Hong Kong' },
  { tz: 'Asia/Singapore', ko: '싱가포르', en: 'Singapore' },
  { tz: 'Asia/Seoul', ko: '서울', en: 'Seoul' },
  { tz: 'Asia/Tokyo', ko: '도쿄', en: 'Tokyo' },
  { tz: 'Australia/Sydney', ko: '시드니', en: 'Sydney' },
  { tz: 'Pacific/Auckland', ko: '오클랜드', en: 'Auckland' },
  { tz: 'Pacific/Honolulu', ko: '호놀룰루', en: 'Honolulu' },
];

/** Default line colours for newly added world clocks (avoids the red now-line). */
export const WORLD_LINE_COLORS = ['#3B82F6', '#22C55E', '#A855F7', '#F59E0B', '#06B6D4', '#EC4899'];
