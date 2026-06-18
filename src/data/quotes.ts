/**
 * 50 well-known quotes (Korean), used to seed a new post-it so it never starts
 * blank. Attribution is the commonly-cited author.
 */
export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: Quote[] = [
  { text: '삶이 있는 한 희망은 있다.', author: '키케로' },
  { text: '오늘 할 수 있는 일에 전력을 다하라.', author: '아이작 뉴턴' },
  { text: '성공은 영원하지 않고 실패는 치명적이지 않다.', author: '윈스턴 처칠' },
  { text: '절대, 절대, 절대 포기하지 말라.', author: '윈스턴 처칠' },
  { text: '성공이란 열정을 잃지 않고 실패를 거듭하는 능력이다.', author: '윈스턴 처칠' },
  { text: '상상력은 지식보다 중요하다.', author: '알베르트 아인슈타인' },
  { text: '인생은 자전거를 타는 것과 같다. 균형을 잡으려면 움직여야 한다.', author: '알베르트 아인슈타인' },
  { text: '실패는 성공의 어머니다.', author: '토마스 에디슨' },
  { text: '천재는 1퍼센트의 영감과 99퍼센트의 노력으로 만들어진다.', author: '토마스 에디슨' },
  { text: '할 수 있다고 믿든 할 수 없다고 믿든, 믿는 대로 될 것이다.', author: '헨리 포드' },
  { text: '사람은 누구나 자기가 할 수 있다고 생각하는 것보다 더 많은 것을 할 수 있다.', author: '헨리 포드' },
  { text: '위대한 일을 하는 유일한 방법은 당신이 하는 일을 사랑하는 것이다.', author: '스티브 잡스' },
  { text: '계속 갈망하라, 계속 우직하게 나아가라.', author: '스티브 잡스' },
  { text: '당신의 시간은 한정되어 있다. 다른 사람의 삶을 사느라 시간을 낭비하지 말라.', author: '스티브 잡스' },
  { text: '혁신은 리더와 추종자를 구분 짓는 기준이다.', author: '스티브 잡스' },
  { text: '천 리 길도 한 걸음부터.', author: '노자' },
  { text: '아는 것을 안다고 하고 모르는 것을 모른다고 하는 것이 곧 아는 것이다.', author: '공자' },
  { text: '배우기만 하고 생각하지 않으면 얻는 것이 없다.', author: '공자' },
  { text: '가장 큰 영광은 한 번도 실패하지 않음이 아니라 실패할 때마다 다시 일어서는 데 있다.', author: '공자' },
  { text: '지식에 투자하는 것이 가장 이윤이 많이 남는다.', author: '벤저민 프랭클린' },
  { text: '어제는 역사, 내일은 미스터리, 오늘은 선물이다.', author: '엘리너 루스벨트' },
  { text: '꿈을 꿀 수 있다면 그것을 이룰 수도 있다.', author: '월트 디즈니' },
  { text: '미래를 예측하는 가장 좋은 방법은 미래를 창조하는 것이다.', author: '피터 드러커' },
  { text: '단순함이야말로 궁극의 정교함이다.', author: '레오나르도 다 빈치' },
  { text: '내가 더 멀리 보았다면 그것은 거인의 어깨 위에 서 있었기 때문이다.', author: '아이작 뉴턴' },
  { text: '세상은 고통으로 가득하지만 그것을 극복하는 사람들로도 가득하다.', author: '헬렌 켈러' },
  { text: '혼자서 할 수 있는 일은 적지만 함께라면 많은 것을 할 수 있다.', author: '헬렌 켈러' },
  { text: '고통이 남기고 간 뒤를 보라! 고난이 지나면 반드시 기쁨이 스며든다.', author: '괴테' },
  { text: '스스로를 신뢰하는 순간 어떻게 살아야 할지 알게 된다.', author: '괴테' },
  { text: '가장 유능한 사람은 가장 배우기에 힘쓰는 사람이다.', author: '괴테' },
  { text: '용기 있는 자로 살아라. 운이 따르지 않거든 용기 있는 가슴으로 불행에 맞서라.', author: '키케로' },
  { text: '시간은 가장 현명한 조언자다.', author: '페리클레스' },
  { text: '현재에 충실하라.', author: '호라티우스' },
  { text: '배움에는 끝이 없다.', author: '히포크라테스' },
  { text: '위대한 일은 갑자기 이루어지지 않는다.', author: '에픽테토스' },
  { text: '이미 끝난 일을 후회하기보다 하고 싶었던 일을 하지 못한 것을 후회하라.', author: '탈무드' },
  { text: '행복은 습관이다. 그것을 몸에 지니라.', author: '엘버트 허버드' },
  { text: '하루에 세 시간을 걸으면 칠 년 후에 지구를 한 바퀴 돌 수 있다.', author: '새뮤얼 존슨' },
  { text: '산다는 것 그것은 치열한 전투이다.', author: '로맹 롤랑' },
  { text: '고난의 시기에 흔들리지 않는 것이야말로 진정 칭찬받을 만한 사람의 증거다.', author: '베토벤' },
  { text: '행동은 모든 성공의 가장 중요한 열쇠다.', author: '파블로 피카소' },
  { text: '오늘이라는 날은 두 번 다시 오지 않는다는 것을 잊지 말라.', author: '단테' },
  { text: '남이 너에게 해주기를 바라는 그대로 남에게 해주어라.', author: '성경' },
  { text: '당신이 할 수 있는 가장 큰 모험은 바로 당신이 꿈꾸던 삶을 사는 것이다.', author: '오프라 윈프리' },
  { text: '성공의 비결은 단 한 가지, 잘할 수 있는 일에 광적으로 집중하는 것이다.', author: '톰 모나건' },
  { text: '위대한 정신은 항상 평범한 정신의 격렬한 반대에 부딪혀 왔다.', author: '알베르트 아인슈타인' },
  { text: '노력에는 늦음이란 없다.', author: '보들레르' },
  { text: '위대한 희망이 위대한 사람을 만든다.', author: '토머스 풀러' },
  { text: '인생은 가까이서 보면 비극이지만 멀리서 보면 희극이다.', author: '찰리 채플린' },
  { text: '가장 어두운 밤도 끝이 나고 해는 떠오른다.', author: '빅토르 위고' },
];

/** A random quote formatted for a memo: text + an em-dash attribution line. */
export function randomQuote(): string {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  return `${q.text}\n\n— ${q.author}`;
}
