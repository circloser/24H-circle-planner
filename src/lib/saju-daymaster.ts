/**
 * The free part of 사주, and the part anyone in the world can read.
 *
 * The Day Master — the heavenly stem of the day you were born — is the
 * character the whole chart is read from; in the tradition it stands for you.
 * There are ten of them, and each has an image the tradition has used for
 * centuries: a great tree, a candle, a mountain, the rain. Their portraits are
 * written here, by hand, in every language the app speaks, so the first thing
 * anyone sees of Korean saju costs nothing, needs no account, and never leaves
 * the device. The written reading (worker/readings.ts) is the paid part.
 *
 * Everything here describes; nothing predicts.
 */
import type { Element } from './saju';

export type Lang = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'fr' | 'de' | 'ru';
const LANGS: readonly Lang[] = ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'ru'];
export const asLang = (l: string): Lang => ((LANGS as readonly string[]).includes(l) ? (l as Lang) : 'en');

/** The stems and branches as Koreans say them, in Latin letters. */
export const STEM_ROMAN = ['Gap', 'Eul', 'Byeong', 'Jeong', 'Mu', 'Gi', 'Gyeong', 'Sin', 'Im', 'Gye'] as const;
export const BRANCH_ROMAN = ['Ja', 'Chuk', 'In', 'Myo', 'Jin', 'Sa', 'O', 'Mi', 'Sin', 'Yu', 'Sul', 'Hae'] as const;

export const ELEMENT_NAME: Record<Lang, Record<Element, string>> = {
  ko: { wood: '나무', fire: '불', earth: '흙', metal: '쇠', water: '물' },
  en: { wood: 'Wood', fire: 'Fire', earth: 'Earth', metal: 'Metal', water: 'Water' },
  ja: { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' },
  zh: { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' },
  es: { wood: 'Madera', fire: 'Fuego', earth: 'Tierra', metal: 'Metal', water: 'Agua' },
  fr: { wood: 'Bois', fire: 'Feu', earth: 'Terre', metal: 'Métal', water: 'Eau' },
  de: { wood: 'Holz', fire: 'Feuer', earth: 'Erde', metal: 'Metall', water: 'Wasser' },
  ru: { wood: 'Дерево', fire: 'Огонь', earth: 'Земля', metal: 'Металл', water: 'Вода' },
};

/** "Yang Wood", said the way each language says it. */
export function elementLabel(lang: Lang, element: Element, yang: boolean): string {
  const e = ELEMENT_NAME[lang][element];
  switch (lang) {
    case 'ko': return `${yang ? '양' : '음'}의 ${e}`;
    case 'ja': return `${yang ? '陽' : '陰'}の${e}`;
    case 'zh': return `${yang ? '阳' : '阴'}${e}`;
    case 'es': return `${e} ${yang ? 'Yang' : 'Yin'}`;
    case 'fr': return `${e} ${yang ? 'yang' : 'yin'}`;
    case 'de': return `${yang ? 'Yang' : 'Yin'}-${e}`;
    case 'ru': return `${yang ? 'Ян' : 'Инь'}-${e}`;
    default: return `${yang ? 'Yang' : 'Yin'} ${e}`;
  }
}

/** The ten relations to the Day Master, glossed for a reader who does not
 *  know the Korean terms (ja and zh keep the classical characters). */
const TEN_GODS: Record<string, Partial<Record<Lang, string>>> = {
  일간: { en: 'Self', ja: '日干', zh: '日主', es: 'Uno mismo', fr: 'Soi', de: 'Selbst', ru: 'Я' },
  비견: { en: 'Companion', ja: '比肩', zh: '比肩', es: 'Compañero', fr: 'Compagnon', de: 'Gefährte', ru: 'Товарищ' },
  겁재: { en: 'Rival', ja: '劫財', zh: '劫财', es: 'Rival', fr: 'Rival', de: 'Rivale', ru: 'Соперник' },
  식신: { en: 'Talent', ja: '食神', zh: '食神', es: 'Talento', fr: 'Talent', de: 'Talent', ru: 'Талант' },
  상관: { en: 'Expression', ja: '傷官', zh: '伤官', es: 'Expresión', fr: 'Expression', de: 'Ausdruck', ru: 'Самовыражение' },
  편재: { en: 'Windfall', ja: '偏財', zh: '偏财', es: 'Fortuna', fr: 'Aubaine', de: 'Glücksfall', ru: 'Удача' },
  정재: { en: 'Earnings', ja: '正財', zh: '正财', es: 'Ingresos', fr: 'Revenus', de: 'Einkommen', ru: 'Доход' },
  편관: { en: 'Challenge', ja: '偏官', zh: '七杀', es: 'Desafío', fr: 'Défi', de: 'Herausforderung', ru: 'Вызов' },
  정관: { en: 'Authority', ja: '正官', zh: '正官', es: 'Autoridad', fr: 'Autorité', de: 'Autorität', ru: 'Власть' },
  편인: { en: 'Insight', ja: '偏印', zh: '偏印', es: 'Intuición', fr: 'Intuition', de: 'Intuition', ru: 'Интуиция' },
  정인: { en: 'Support', ja: '印綬', zh: '正印', es: 'Apoyo', fr: 'Soutien', de: 'Rückhalt', ru: 'Опора' },
};

export const tenGodLabel = (lang: Lang, ko: string): string => (lang === 'ko' ? ko : TEN_GODS[ko]?.[lang] ?? ko);

export interface DayMaster { title: string; text: string }

/** The ten portraits, in stem order (甲 乙 丙 丁 戊 己 庚 辛 壬 癸). */
export const DAY_MASTERS: Record<Lang, readonly DayMaster[]> = {
  ko: [
    { title: '큰 나무', text: '뿌리 깊고 곧게 서서, 천천히 그러나 꾸준히 빛을 향해 자랍니다. 사람들은 당신의 한결같음에 기대고, 당신은 남들이 멈춘 뒤에도 자라기를 멈추지 않는 편입니다.' },
    { title: '꽃 피는 덩굴', text: '유연하고 재치 있게, 움직일 수 없는 것은 돌아서 길을 찾습니다. 적응하는 힘이 곧 당신의 힘이고, 기대는 곳마다 조금 더 아름답게 만듭니다.' },
    { title: '태양', text: '따뜻하고 활짝 열려 있어, 애쓰지 않아도 주변을 밝힙니다. 당신의 기운은 한꺼번에 모두에게 닿는 넉넉함이라 좀처럼 숨겨지지 않습니다.' },
    { title: '촛불', text: '조용하고 집중된 빛으로 가까이에서 온기를 전합니다. 밤에 사람들이 모여드는 불빛처럼, 한결같고 섬세하며 작은 것까지 살핍니다.' },
    { title: '큰 산', text: '든든하고 서두르지 않는, 남들이 딛고 서는 땅입니다. 날씨가 바뀌어도 제 모양을 지키기에 믿음을 얻습니다.' },
    { title: '텃밭의 흙', text: '보살피고 실속 있게, 무엇이든 자라게 돕습니다. 들어오는 것을 받아들여 남을 먹이는 것으로 바꾸어 냅니다.' },
    { title: '무쇠', text: '곧고 결단력 있게, 망설임을 베어 내는 칼날입니다. 공정함과 의리를 중히 여기고, 압력을 받을수록 더 단단하게 벼려집니다.' },
    { title: '보석', text: '정제되고 섬세하게, 아주 작은 차이까지 알아봅니다. 보석처럼 다듬어질 때 가장 빛나며, 일을 어떻게 하는지에 마음을 씁니다.' },
    { title: '큰 바다', text: '넓고 가만히 있지 못하며, 커다란 생각의 흐름을 타고 움직입니다. 호기심 많고 자유로워 많은 것을 싣고 흐르며 좀처럼 머무르지 않습니다.' },
    { title: '비', text: '부드럽고 섬세한 감각으로, 남들이 닿지 못하는 곳까지 스며듭니다. 비처럼 조용하고 끈기 있게, 닿는 모든 것을 천천히 바꿉니다.' },
  ],
  en: [
    { title: 'The Great Tree', text: 'Rooted and upright, you grow toward the light slowly and steadily. People lean on your steadiness, and you tend to keep growing long after others have stopped.' },
    { title: 'The Flowering Vine', text: 'Supple and resourceful, you find a way around what cannot be moved. Your strength is in adapting — and in making whatever you climb a little more beautiful.' },
    { title: 'The Sun', text: 'Warm and open, you light up a room without trying. Your energy is generous: it reaches everyone at once, and it is hard to hide.' },
    { title: 'The Candle', text: 'Quiet and focused, you give warmth close up. Your light is the kind people gather around at night — steady, careful, attentive to detail.' },
    { title: 'The Mountain', text: 'Solid and unhurried, you are the ground others stand on. You keep your shape through changing weather, and you are trusted for it.' },
    { title: 'The Garden Soil', text: 'Nurturing and practical, you help things grow. You take in what comes and turn it into something that feeds others.' },
    { title: 'The Raw Metal', text: 'Direct and resolute, you are the blade that cuts through hesitation. You value fairness and loyalty, and pressure only sharpens you.' },
    { title: 'The Jewel', text: 'Refined and precise, you notice the finest distinctions. Like a gem, you shine most when polished — and you care how things are done.' },
    { title: 'The Ocean', text: 'Broad and restless, you move with big currents of ideas. Curious and free, you carry many things along and rarely stay still.' },
    { title: 'The Rain', text: 'Gentle and perceptive, you reach places others cannot. Like rain, your influence is quiet and patient, and it changes everything it touches.' },
  ],
  ja: [
    { title: '大樹', text: '根を深く張り、まっすぐに、ゆっくりと着実に光へ向かって伸びていきます。人はあなたの揺るがなさに寄りかかり、あなたは周りが止まった後も成長を続けます。' },
    { title: '花咲く蔦', text: 'しなやかで機転が利き、動かせないものは回り道をして道を見つけます。適応する力こそがあなたの強さで、寄り添う先を少し美しくします。' },
    { title: '太陽', text: '温かく開かれていて、努力しなくても周りを明るくします。そのエネルギーは惜しみなく一度に皆へ届き、隠しようがありません。' },
    { title: '灯火', text: '静かで集中した光で、身近な人に温もりを届けます。夜に人が集まる灯りのように、落ち着いていて細やかです。' },
    { title: '山', text: 'どっしりとして急がず、人が立つ大地となります。天気が変わっても形を保つので、信頼されます。' },
    { title: '畑の土', text: '面倒見がよく実際的で、物事を育てる手助けをします。受け取ったものを、人を養うものへと変えていきます。' },
    { title: '鉄', text: '率直で決断力があり、迷いを断ち切る刃です。公正さと義理を重んじ、圧力を受けるほど鍛えられます。' },
    { title: '宝石', text: '洗練されて精密で、ごく小さな違いにも気づきます。宝石のように磨かれるほど輝き、物事のやり方にこだわります。' },
    { title: '大海', text: '広くじっとしていられず、大きな発想の流れに乗って動きます。好奇心旺盛で自由、多くのものを運びながら留まりません。' },
    { title: '雨', text: 'やさしく鋭い感性で、他の人が届かない所まで染み込みます。雨のように静かで粘り強く、触れるものすべてを少しずつ変えていきます。' },
  ],
  zh: [
    { title: '参天大树', text: '根深而挺拔，缓慢而稳定地向着光生长。人们依靠你的沉稳，别人停下时你仍在成长。' },
    { title: '开花的藤蔓', text: '柔韧而机敏，遇到移不动的东西就绕道找路。适应就是你的力量，你攀附之处也因你而更美。' },
    { title: '太阳', text: '温暖而开朗，不用刻意就能照亮身边。你的能量慷慨大方，同时照到每个人，很难藏住。' },
    { title: '烛火', text: '安静而专注，在近处给人温暖。像夜里人们围坐的灯火，稳定、细心、留意细节。' },
    { title: '高山', text: '厚重而不急，是别人脚下的土地。风雨变幻你仍保持本色，因此值得信赖。' },
    { title: '田园之土', text: '善于照顾又务实，帮助万物生长。你接纳所来之物，并把它变成滋养他人的东西。' },
    { title: '刀剑之金', text: '直接而果断，是斩断犹豫的利刃。你看重公正与义气，越有压力越锋利。' },
    { title: '珠玉', text: '精致而细腻，能察觉最细微的差别。像宝石一样越打磨越闪亮，也在意事情做得是否得体。' },
    { title: '大海', text: '广阔而不安于静，随着宏大的思潮流动。好奇又自由，带着许多东西前行，很少停留。' },
    { title: '雨露', text: '温柔而敏锐，能渗入别人到不了的地方。像雨一样安静而有耐心，慢慢改变所触及的一切。' },
  ],
  es: [
    { title: 'El gran árbol', text: 'Con raíces firmes y recto, creces hacia la luz despacio y sin pausa. Los demás se apoyan en tu constancia, y sigues creciendo cuando otros ya se detuvieron.' },
    { title: 'La enredadera en flor', text: 'Flexible e ingeniosa, rodeas lo que no se puede mover hasta encontrar camino. Tu fuerza está en adaptarte y en embellecer aquello a lo que te sostienes.' },
    { title: 'El sol', text: 'Cálido y abierto, iluminas el lugar sin proponértelo. Tu energía es generosa: llega a todos a la vez y es difícil de esconder.' },
    { title: 'La vela', text: 'Tranquila y concentrada, das calor de cerca. Tu luz es de las que reúnen a la gente por la noche: constante, cuidadosa, atenta al detalle.' },
    { title: 'La montaña', text: 'Sólido y sin prisa, eres el suelo que sostiene a otros. Mantienes tu forma aunque cambie el tiempo, y por eso confían en ti.' },
    { title: 'La tierra del huerto', text: 'Protectora y práctica, ayudas a que las cosas crezcan. Recibes lo que llega y lo conviertes en algo que alimenta a los demás.' },
    { title: 'El metal en bruto', text: 'Directo y resuelto, eres la hoja que corta la duda. Valoras la justicia y la lealtad, y la presión te afila.' },
    { title: 'La joya', text: 'Refinada y precisa, notas las diferencias más finas. Como una gema, brillas más cuando te pules, y te importa cómo se hacen las cosas.' },
    { title: 'El océano', text: 'Amplio e inquieto, te mueves con grandes corrientes de ideas. Curioso y libre, llevas muchas cosas contigo y rara vez te quedas quieto.' },
    { title: 'La lluvia', text: 'Suave y perceptiva, llegas a donde otros no llegan. Como la lluvia, tu influencia es callada y paciente, y transforma todo lo que toca.' },
  ],
  fr: [
    { title: 'Le grand arbre', text: 'Enraciné et droit, vous grandissez vers la lumière, lentement et sûrement. Les autres s’appuient sur votre constance, et vous continuez à grandir quand d’autres se sont arrêtés.' },
    { title: 'La vigne en fleur', text: 'Souple et ingénieux, vous contournez ce qui ne bouge pas pour trouver votre chemin. Votre force est de vous adapter — et d’embellir ce à quoi vous vous accrochez.' },
    { title: 'Le soleil', text: 'Chaleureux et ouvert, vous éclairez une pièce sans effort. Votre énergie est généreuse : elle touche tout le monde à la fois et se cache mal.' },
    { title: 'La bougie', text: 'Calme et concentré, vous réchauffez de près. Votre lumière est de celles autour desquelles on se rassemble le soir : stable, soigneuse, attentive aux détails.' },
    { title: 'La montagne', text: 'Solide et sans hâte, vous êtes le sol sur lequel les autres se tiennent. Vous gardez votre forme quel que soit le temps, et l’on vous fait confiance.' },
    { title: 'La terre du jardin', text: 'Attentionné et pratique, vous aidez les choses à pousser. Vous accueillez ce qui vient et le transformez en ce qui nourrit les autres.' },
    { title: 'Le métal brut', text: 'Direct et résolu, vous êtes la lame qui tranche l’hésitation. Vous tenez à la justice et à la loyauté, et la pression vous aiguise.' },
    { title: 'Le joyau', text: 'Raffiné et précis, vous remarquez les plus fines nuances. Comme une pierre précieuse, vous brillez davantage une fois poli, et la manière compte pour vous.' },
    { title: 'L’océan', text: 'Vaste et agité, vous suivez de grands courants d’idées. Curieux et libre, vous emportez beaucoup avec vous et restez rarement immobile.' },
    { title: 'La pluie', text: 'Doux et perspicace, vous atteignez des endroits inaccessibles aux autres. Comme la pluie, votre influence est discrète et patiente, et transforme tout ce qu’elle touche.' },
  ],
  de: [
    { title: 'Der große Baum', text: 'Tief verwurzelt und aufrecht wächst du langsam, aber stetig dem Licht entgegen. Andere stützen sich auf deine Beständigkeit, und du wächst weiter, wenn andere längst aufgehört haben.' },
    { title: 'Die blühende Ranke', text: 'Biegsam und findig suchst du dir um das Unverrückbare herum einen Weg. Deine Stärke ist Anpassung – und alles, woran du dich hältst, wird schöner.' },
    { title: 'Die Sonne', text: 'Warm und offen erhellst du einen Raum, ohne es zu wollen. Deine Energie ist großzügig: Sie erreicht alle zugleich und lässt sich schwer verbergen.' },
    { title: 'Die Kerze', text: 'Ruhig und konzentriert spendest du Wärme aus der Nähe. Dein Licht ist eines, um das sich Menschen abends versammeln: beständig, sorgfältig, aufmerksam für Details.' },
    { title: 'Der Berg', text: 'Fest und ohne Eile bist du der Boden, auf dem andere stehen. Du behältst deine Form bei jedem Wetter, und man vertraut dir dafür.' },
    { title: 'Die Gartenerde', text: 'Fürsorglich und praktisch hilfst du Dingen beim Wachsen. Du nimmst auf, was kommt, und machst daraus etwas, das andere nährt.' },
    { title: 'Das rohe Metall', text: 'Direkt und entschlossen bist du die Klinge, die Zögern durchschneidet. Dir sind Fairness und Treue wichtig, und unter Druck wirst du schärfer.' },
    { title: 'Das Juwel', text: 'Fein und präzise bemerkst du die kleinsten Unterschiede. Wie ein Edelstein glänzt du am meisten, wenn du geschliffen wirst – und dir ist wichtig, wie etwas getan wird.' },
    { title: 'Der Ozean', text: 'Weit und rastlos bewegst du dich mit großen Strömungen von Ideen. Neugierig und frei trägst du vieles mit dir und bleibst selten still.' },
    { title: 'Der Regen', text: 'Sanft und feinfühlig erreichst du Orte, an die andere nicht gelangen. Wie Regen wirkst du leise und geduldig und verwandelst alles, was du berührst.' },
  ],
  ru: [
    { title: 'Большое дерево', text: 'Глубоко укоренённый и прямой, вы растёте к свету медленно, но верно. На вашу стойкость опираются другие, а вы продолжаете расти, когда остальные уже остановились.' },
    { title: 'Цветущая лоза', text: 'Гибкий и находчивый, вы обходите то, что нельзя сдвинуть, и находите путь. Ваша сила — в умении приспосабливаться и делать красивее всё, за что вы держитесь.' },
    { title: 'Солнце', text: 'Тёплый и открытый, вы освещаете всё вокруг без усилий. Ваша энергия щедрая: она достаётся всем сразу, и её трудно спрятать.' },
    { title: 'Свеча', text: 'Тихий и сосредоточенный, вы согреваете вблизи. Ваш свет — из тех, вокруг которых собираются вечером: ровный, бережный, внимательный к мелочам.' },
    { title: 'Гора', text: 'Надёжный и неторопливый, вы — почва, на которой стоят другие. Вы сохраняете себя при любой погоде, и вам за это доверяют.' },
    { title: 'Садовая земля', text: 'Заботливый и практичный, вы помогаете всему расти. Вы принимаете то, что приходит, и превращаете это в то, что питает других.' },
    { title: 'Необработанный металл', text: 'Прямой и решительный, вы — клинок, который рассекает сомнения. Вы цените справедливость и верность, а давление вас только закаляет.' },
    { title: 'Драгоценный камень', text: 'Утончённый и точный, вы замечаете тончайшие различия. Как самоцвет, вы сияете ярче после огранки, и вам важно, как делаются дела.' },
    { title: 'Океан', text: 'Широкий и неспокойный, вы движетесь с большими течениями идей. Любопытный и свободный, вы несёте с собой многое и редко стоите на месте.' },
    { title: 'Дождь', text: 'Мягкий и чуткий, вы проникаете туда, куда другим не добраться. Как дождь, ваше влияние тихое и терпеливое — оно меняет всё, чего касается.' },
  ],
};

/** The portrait for a day stem (0 = 甲 … 9 = 癸), in the reader's language. */
export function dayMasterOf(lang: string, stem: number): DayMaster {
  return DAY_MASTERS[asLang(lang)][((stem % 10) + 10) % 10];
}
