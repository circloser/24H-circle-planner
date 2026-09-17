/**
 * Diary decorating (다꾸, Pro) — what a calendar day can be dressed with:
 * stickers stamped onto it and a highlighter tint behind it.
 *
 * Stickers are emoji: they render on every platform with no image assets, and a
 * day stays a few bytes in the synced store. Ids are stable short names so the
 * stored data does not depend on how an emoji happens to be encoded.
 */

export type StickerGroupId =
  'mood' | 'weather' | 'life' | 'hobby' | 'food' | 'animal' | 'nature' | 'moment' | 'symbol' | 'travel';

export interface StickerGroup {
  id: StickerGroupId;
  items: ReadonlyArray<{ id: string; glyph: string }>;
}

/** `id:glyph` pairs, one group per line — compact, and easy to extend. */
const SOURCE: ReadonlyArray<[StickerGroupId, string]> = [
  ['mood', 'smile:😊 laugh:😆 love:🥰 party:🥳 calm:😌 tired:😴 sad:😢 angry:😤 sick:🤒 wink:😉 cool:😎 think:🤔 shy:😳 yum:😋 starstruck:🤩 hug:🤗 cry:😭 scream:😱 sweat:😅 sleepy:😪 nerd:🤓 halo:😇 devil:😈 meh:😐 eyeroll:🙄 kiss:😘 ghost:👻 catlove:😻 mindblown:🤯'],
  ['weather', 'sun:☀️ partly:⛅ cloud:☁️ rain:🌧️ storm:⛈️ snow:❄️ rainbow:🌈 moon:🌙 glow:🌟 fog:🌫️ wind:🌬️ tornado:🌪️ umbrella:☂️ thermo:🌡️ snowman:⛄ sunrise:🌅 lightning:⚡ droplet:💧 fullmoon:🌕 comet:☄️'],
  ['life', 'run:🏃 yoga:🧘 book:📚 study:✏️ work:💼 coffee:☕ meal:🍽️ cake:🍰 movie:🎬 music:🎧 game:🎮 travel:✈️ hospital:🏥 shopping:🛍️ bed:🛌 bath:🛁 laundry:🧺 clean:🧹 cook:🍳 phone:📱 laptop:💻 mail:✉️ bank:🏦 car:🚗 bus:🚌 train:🚆 bike:🚲 pill:💊 tooth:🦷 haircut:💇 calendar:📅 pray:🙏 memo:📝 money:💰 cart:🛒 baby:👶 school:🏫 office:🏢 home:🏠'],
  ['hobby', 'swim:🏊 soccer:⚽ basketball:🏀 baseball:⚾ tennis:🎾 golf:⛳ gym:🏋️ dance:💃 paint:🎨 camera:📷 piano:🎹 guitar:🎸 bowling:🎳 ski:⛷️ fishing:🎣 knit:🧶 puzzle:🧩 dice:🎲 ticket:🎟️ theater:🎭 mic:🎤 drum:🥁 plant:🪴 hike:🥾 tent:⛺'],
  ['food', 'apple:🍎 strawberry:🍓 peach:🍑 grapes:🍇 watermelon:🍉 lemon:🍋 banana:🍌 cherry:🍒 avocado:🥑 carrot:🥕 corn:🌽 bread:🍞 croissant:🥐 pancake:🥞 egg:🥚 burger:🍔 pizza:🍕 fries:🍟 hotdog:🌭 taco:🌮 ramen:🍜 sushi:🍣 rice:🍚 bento:🍱 dumpling:🥟 curry:🍛 chicken:🍗 salad:🥗 icecream:🍦 donut:🍩 cookie:🍪 choco:🍫 candy:🍬 pudding:🍮 cupcake:🧁 tea:🍵 boba:🧋 juice:🧃 beer:🍺 wine:🍷 cocktail:🍹'],
  ['animal', 'cat:🐱 dog:🐶 rabbit:🐰 bear:🐻 panda:🐼 fox:🦊 koala:🐨 tiger:🐯 lion:🦁 pig:🐷 frog:🐸 monkey:🐵 chick:🐥 penguin:🐧 owl:🦉 duck:🦆 unicorn:🦄 horse:🐴 cow:🐮 hamster:🐹 mouse:🐭 whale:🐳 dolphin:🐬 fish:🐟 octopus:🐙 turtle:🐢 snail:🐌 bee:🐝 ladybug:🐞 butterfly:🦋 dino:🦕 paw:🐾 hedgehog:🦔 sloth:🦥 otter:🦦'],
  ['nature', 'tulip:🌷 rose:🌹 sunflower:🌻 blossom:🌸 hibiscus:🌺 daisy:🌼 seedling:🌱 tree:🌳 palm:🌴 cactus:🌵 maple:🍁 leaf:🍃 fallen:🍂 mushroom:🍄 herb:🌿 clover4:☘️ shell:🐚 wave:🌊 mountain:⛰️ volcano:🌋 earth:🌏 xmas:🎄 pumpkin:🎃 rock:🪨 wood:🪵'],
  ['moment', 'birthday:🎂 gift:🎁 flower:💐 heart:❤️ star:⭐ sparkle:✨ done:✅ pin:📌 fire:🔥 clover:🍀 balloon:🎈 confetti:🎊 popper:🎉 ribbon:🎀 trophy:🏆 medal:🥇 crown:👑 ring:💍 diamond:💎 champagne:🍾 fireworks:🎆 sparkler:🎇 lantern:🏮 letter:💌 grad:🎓 wedding:💒 candle:🕯️ bell:🔔 kissmark:💋 rocket:🚀 hundred:💯'],
  ['symbol', 'orangeheart:🧡 yellowheart:💛 greenheart:💚 blueheart:💙 purpleheart:💜 blackheart:🖤 whiteheart:🤍 brownheart:🤎 sparkleheart:💖 twohearts:💕 brokenheart:💔 check:✔️ cross:❌ question:❓ exclaim:❗ warning:⚠️ no:🚫 note:🎵 notes:🎶 zzz:💤 anger:💢 bulb:💡 target:🎯 flag:🚩 clip:📎 bookmark:🔖 key:🔑 lock:🔒 alarm:⏰ hourglass:⏳ speech:💬 thought:💭 point:👉 thumbsup:👍 clap:👏 muscle:💪 okhand:👌 peace:✌️ hello:👋'],
  ['travel', 'suitcase:🧳 map:🗺️ beach:🏖️ island:🏝️ camping:🏕️ ferris:🎡 coaster:🎢 castle:🏰 tower:🗼 liberty:🗽 hotel:🏨 taxi:🚕 bullet:🚄 ship:🚢 sailboat:⛵ compass:🧭 globe:🌍 carousel:🎠 fountain:⛲ takeoff:🛫 landing:🛬 fuji:🗻'],
];

export const STICKER_GROUPS: readonly StickerGroup[] = SOURCE.map(([id, body]) => ({
  id,
  items: body.split(' ').map((pair) => {
    const at = pair.indexOf(':');
    return { id: pair.slice(0, at), glyph: pair.slice(at + 1) };
  }),
}));

const GLYPH = new Map(STICKER_GROUPS.flatMap((g) => g.items.map((s) => [s.id, s.glyph] as const)));

export const stickerGlyph = (id: string): string | null => GLYPH.get(id) ?? null;
export const isSticker = (id: unknown): id is string => typeof id === 'string' && GLYPH.has(id);

/** Most stickers one day can hold — enough to decorate, not enough to bury it. */
export const MAX_STICKERS = 6;

/** Highlighter tints: soft enough that the day's plans stay readable on top. */
export const TINTS = ['#fef08a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#fed7aa', '#ddd6fe'] as const;
export type Tint = (typeof TINTS)[number];
export const isTint = (v: unknown): v is Tint => typeof v === 'string' && (TINTS as readonly string[]).includes(v);

export interface DayDecor {
  /** Sticker ids, in the order they were stamped. */
  s?: string[];
  /** Highlighter tint behind the whole day. */
  t?: Tint;
}

export type DecorByDate = Record<string, DayDecor>;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A stored day, cleaned: unknown stickers and tints are dropped, never trusted. */
export function cleanDay(raw: unknown): DayDecor | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out: DayDecor = {};
  const s = Array.isArray(o.s) ? o.s.filter(isSticker).slice(0, MAX_STICKERS) : [];
  if (s.length) out.s = s;
  if (isTint(o.t)) out.t = o.t;
  return out.s || out.t ? out : null;
}

export function cleanDecor(raw: unknown): DecorByDate | null {
  const p = raw as { version?: unknown; days?: unknown } | null;
  if (!p || p.version !== 1 || !p.days || typeof p.days !== 'object') return null;
  const out: DecorByDate = {};
  for (const [key, day] of Object.entries(p.days as Record<string, unknown>)) {
    if (!DAY_RE.test(key)) continue;
    const clean = cleanDay(day);
    if (clean) out[key] = clean;
  }
  return out;
}

/** Apply `fn` to one day; an empty result drops the day from the store. */
export function withDay(all: DecorByDate, key: string, fn: (day: DayDecor) => DayDecor): DecorByDate {
  const next = cleanDay(fn({ ...(all[key] ?? {}) }));
  const out = { ...all };
  if (next) out[key] = next;
  else delete out[key];
  return out;
}
