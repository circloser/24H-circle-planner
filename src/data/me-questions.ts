/**
 * 100 questions, 100 answers — the questions.
 *
 * Written in Korean and English. The other six languages read the English:
 * a hundred questions are a piece of writing rather than a label, and a
 * machine translation of them would read like one. Each question has a fixed
 * id, so an answer is never attached to the wrong question if the wording is
 * improved later — the id is what is stored, not the words.
 *
 * Grouped loosely, from the easy to the deep, so the list can be answered from
 * the top on a slow evening and still be worth coming back to.
 */
export interface MeQuestion { id: string; ko: string; en: string }

export const ME_QUESTIONS: readonly MeQuestion[] = [
  // 기본 · the basics
  { id: 'q001', ko: '사람들이 나를 부르는 이름이나 별명은?', en: 'What do people call you — a name, a nickname?' },
  { id: 'q002', ko: '태어난 곳은 어디인가요?', en: 'Where were you born?' },
  { id: 'q003', ko: '지금 사는 곳을 한 줄로 소개한다면?', en: 'Describe where you live now in one line.' },
  { id: 'q004', ko: '나를 세 단어로 표현하면?', en: 'Describe yourself in three words.' },
  { id: 'q005', ko: '처음 만난 사람에게 나를 어떻게 소개하나요?', en: 'How do you introduce yourself to someone new?' },
  { id: 'q006', ko: '혈액형이나 별자리를 믿는 편인가요?', en: 'Do you believe in blood types or star signs?' },
  { id: 'q007', ko: '아침형 인간인가요, 저녁형 인간인가요?', en: 'Are you a morning person or a night person?' },
  { id: 'q008', ko: '오른손잡이, 왼손잡이, 아니면 양손?', en: 'Right-handed, left-handed, or both?' },
  { id: 'q009', ko: '내 이름에 담긴 뜻이나 이야기는?', en: 'What does your name mean, or what is its story?' },
  { id: 'q010', ko: '어릴 때 장래 희망은 무엇이었나요?', en: 'What did you want to be as a child?' },

  // 취향 · likes
  { id: 'q011', ko: '가장 좋아하는 음식은?', en: 'Your favourite food?' },
  { id: 'q012', ko: '절대 못 먹는 음식은?', en: 'A food you cannot eat at all?' },
  { id: 'q013', ko: '가장 좋아하는 계절과 그 이유는?', en: 'Your favourite season, and why?' },
  { id: 'q014', ko: '좋아하는 색은?', en: 'Your favourite colour?' },
  { id: 'q015', ko: '인생 영화나 드라마 한 편은?', en: 'One film or series that stays with you?' },
  { id: 'q016', ko: '몇 번이고 다시 읽은 책은?', en: 'A book you have read more than once?' },
  { id: 'q017', ko: '요즘 가장 많이 듣는 노래는?', en: 'The song you play most these days?' },
  { id: 'q018', ko: '커피파인가요, 차파인가요?', en: 'Coffee or tea?' },
  { id: 'q019', ko: '좋아하는 냄새는?', en: 'A smell you love?' },
  { id: 'q020', ko: '좋아하는 날씨는?', en: 'Your favourite kind of weather?' },
  { id: 'q021', ko: '가장 좋아하는 동물은?', en: 'Your favourite animal?' },
  { id: 'q022', ko: '좋아하는 꽃이나 나무는?', en: 'A flower or tree you love?' },
  { id: 'q023', ko: '즐겨 입는 옷 스타일은?', en: 'How do you like to dress?' },
  { id: 'q024', ko: '가장 좋아하는 간식은?', en: 'Your favourite snack?' },
  { id: 'q025', ko: '가보고 싶은 나라 한 곳은?', en: 'One country you would love to visit?' },

  // 하루와 습관 · days and habits
  { id: 'q026', ko: '평일 아침의 첫 30분은 어떻게 보내나요?', en: 'How do you spend the first half hour of a weekday?' },
  { id: 'q027', ko: '완벽한 주말 하루를 그려 본다면?', en: 'Describe a perfect Saturday.' },
  { id: 'q028', ko: '잠들기 전 꼭 하는 일은?', en: 'Something you always do before sleep?' },
  { id: 'q029', ko: '스트레스를 푸는 나만의 방법은?', en: 'How do you let off stress?' },
  { id: 'q030', ko: '꾸준히 이어 온 습관 하나는?', en: 'One habit you have kept up for years?' },
  { id: 'q031', ko: '고치고 싶은 습관 하나는?', en: 'One habit you would like to break?' },
  { id: 'q032', ko: '휴대폰에서 가장 많이 쓰는 앱은?', en: 'The app you use most on your phone?' },
  { id: 'q033', ko: '혼자 있는 시간에 주로 무엇을 하나요?', en: 'What do you do with time alone?' },
  { id: 'q034', ko: '요즘 빠져 있는 취미는?', en: 'A hobby you are into lately?' },
  { id: 'q035', ko: '운동은 어떻게 하고 있나요?', en: 'How do you keep moving?' },
  { id: 'q036', ko: '하루 중 가장 좋아하는 시간대는?', en: 'Your favourite time of day?' },
  { id: 'q037', ko: '정리정돈을 잘하는 편인가요?', en: 'Are you tidy?' },
  { id: 'q038', ko: '계획형인가요, 즉흥형인가요?', en: 'A planner, or spontaneous?' },
  { id: 'q039', ko: '마지막으로 손편지를 쓴 건 언제인가요?', en: 'When did you last write a letter by hand?' },
  { id: 'q040', ko: '요즘 가장 자주 하는 말은?', en: 'What do you find yourself saying a lot lately?' },

  // 사람 · people
  { id: 'q041', ko: '가장 오래된 친구와 어떻게 만났나요?', en: 'How did you meet your oldest friend?' },
  { id: 'q042', ko: '힘들 때 가장 먼저 떠오르는 사람은?', en: 'Who comes to mind first when things are hard?' },
  { id: 'q043', ko: '가족 중 나와 가장 닮은 사람은?', en: 'Who in your family are you most like?' },
  { id: 'q044', ko: '부모님께 가장 고마운 점은?', en: 'What are you most grateful to your parents for?' },
  { id: 'q045', ko: '친구들이 말하는 나의 장점은?', en: 'What do your friends say is best about you?' },
  { id: 'q046', ko: '사람을 볼 때 가장 먼저 보는 것은?', en: 'What do you notice first about a person?' },
  { id: 'q047', ko: '연락이 끊겼지만 다시 보고 싶은 사람이 있나요?', en: 'Someone you lost touch with and would like to see again?' },
  { id: 'q048', ko: '내 인생에 가장 큰 영향을 준 사람은?', en: 'Who has shaped your life most?' },
  { id: 'q049', ko: '좋아하는 사람에게 마음을 표현하는 방식은?', en: 'How do you show someone you care?' },
  { id: 'q050', ko: '받았던 선물 중 가장 기억에 남는 것은?', en: 'The gift you remember most?' },
  { id: 'q051', ko: '다툰 뒤 먼저 사과하는 편인가요?', en: 'After an argument, are you first to apologise?' },
  { id: 'q052', ko: '롤모델이 있다면 누구인가요?', en: 'Do you have a role model? Who?' },
  { id: 'q053', ko: '누군가에게 들었던 가장 따뜻한 말은?', en: 'The kindest thing anyone has said to you?' },
  { id: 'q054', ko: '내가 누군가에게 해 주고 싶은 말은?', en: 'Something you would like to say to someone?' },
  { id: 'q055', ko: '혼자가 편한가요, 함께가 편한가요?', en: 'Easier alone or with others?' },

  // 일과 배움 · work and learning
  { id: 'q056', ko: '지금 하는 일을 한 문장으로 설명하면?', en: 'Your work, in one sentence?' },
  { id: 'q057', ko: '이 일을 하게 된 계기는?', en: 'How did you come to do it?' },
  { id: 'q058', ko: '일하면서 가장 뿌듯했던 순간은?', en: 'The proudest moment of your working life?' },
  { id: 'q059', ko: '일하면서 가장 힘들었던 순간은?', en: 'The hardest?' },
  { id: 'q060', ko: '학창 시절 가장 좋아한 과목은?', en: 'Your favourite subject at school?' },
  { id: 'q061', ko: '지금 배우고 싶은 것 하나는?', en: 'One thing you would like to learn now?' },
  { id: 'q062', ko: '남들보다 잘한다고 생각하는 것은?', en: 'Something you are better at than most?' },
  { id: 'q063', ko: '잘하고 싶지만 아직 서툰 것은?', en: 'Something you would like to be good at but are not yet?' },
  { id: 'q064', ko: '돈을 벌지 않아도 된다면 무슨 일을 하고 싶나요?', en: 'If you did not need the money, what would you do?' },
  { id: 'q065', ko: '10년 뒤 나는 어떤 일을 하고 있을까요?', en: 'What will you be doing in ten years?' },

  // 추억 · memories
  { id: 'q066', ko: '가장 오래된 기억은?', en: 'Your earliest memory?' },
  { id: 'q067', ko: '어린 시절 살던 집을 떠올리면 생각나는 것은?', en: 'What do you remember of the house you grew up in?' },
  { id: 'q068', ko: '가장 행복했던 여행은?', en: 'The happiest trip you have taken?' },
  { id: 'q069', ko: '인생에서 가장 크게 웃었던 날은?', en: 'The day you laughed hardest?' },
  { id: 'q070', ko: '가장 많이 울었던 날은?', en: 'The day you cried most?' },
  { id: 'q071', ko: '다시 돌아가고 싶은 나이는?', en: 'An age you would go back to?' },
  { id: 'q072', ko: '처음으로 번 돈은 어디에 썼나요?', en: 'What did you spend your first wages on?' },
  { id: 'q073', ko: '인생을 바꾼 결정 하나는?', en: 'One decision that changed your life?' },
  { id: 'q074', ko: '후회하는 일이 있다면?', en: 'Something you regret?' },
  { id: 'q075', ko: '가장 용기 냈던 순간은?', en: 'The bravest thing you have done?' },
  { id: 'q076', ko: '잊지 못할 음식 한 끼는?', en: 'A meal you will never forget?' },
  { id: 'q077', ko: '가장 아끼는 물건과 그 이야기는?', en: 'The thing you treasure most, and its story?' },
  { id: 'q078', ko: '어린 나에게 한마디 해 준다면?', en: 'What would you tell your younger self?' },
  { id: 'q079', ko: '올해 가장 기억에 남는 일은?', en: 'The thing you will remember most about this year?' },
  { id: 'q080', ko: '작년의 나와 지금의 나는 무엇이 달라졌나요?', en: 'What is different about you since last year?' },

  // 마음 · the inside
  { id: 'q081', ko: '요즘 가장 자주 느끼는 감정은?', en: 'The feeling you have most often lately?' },
  { id: 'q082', ko: '나를 가장 화나게 하는 것은?', en: 'What makes you angriest?' },
  { id: 'q083', ko: '나를 가장 설레게 하는 것은?', en: 'What makes your heart race?' },
  { id: 'q084', ko: '무서워하는 것은?', en: 'What are you afraid of?' },
  { id: 'q085', ko: '나만 아는 나의 약점은?', en: 'A weakness only you know about?' },
  { id: 'q086', ko: '나를 위로해 주는 것은?', en: 'What comforts you?' },
  { id: 'q087', ko: '행복이란 무엇이라고 생각하나요?', en: 'What is happiness, to you?' },
  { id: 'q088', ko: '돈, 시간, 사람 중 하나를 고른다면?', en: 'Money, time or people — if you could keep one?' },
  { id: 'q089', ko: '절대 양보할 수 없는 원칙은?', en: 'A principle you will not give up?' },
  { id: 'q090', ko: '요즘 가장 큰 고민은?', en: 'Your biggest worry at the moment?' },

  // 앞으로 · ahead
  { id: 'q091', ko: '올해 꼭 이루고 싶은 것은?', en: 'What must happen this year?' },
  { id: 'q092', ko: '죽기 전에 꼭 해 보고 싶은 일 세 가지는?', en: 'Three things to do before you die?' },
  { id: 'q093', ko: '살고 싶은 도시나 동네는?', en: 'A city or neighbourhood you would like to live in?' },
  { id: 'q094', ko: '노년의 나는 어떤 모습이었으면 하나요?', en: 'What would you like to be like when you are old?' },
  { id: 'q095', ko: '사람들이 나를 어떤 사람으로 기억했으면 하나요?', en: 'How would you like to be remembered?' },
  { id: 'q096', ko: '지금 당장 떠날 수 있다면 어디로?', en: 'If you could leave right now, where would you go?' },
  { id: 'q097', ko: '갖고 싶은 능력 하나는?', en: 'One ability you wish you had?' },
  { id: 'q098', ko: '1년 뒤의 나에게 보내는 한마디는?', en: 'A word to yourself a year from now?' },
  { id: 'q099', ko: '오늘 하루를 한 단어로 표현하면?', en: 'Today, in one word?' },
  { id: 'q100', ko: '지금 이 순간 가장 고마운 것은?', en: 'What are you most grateful for right now?' },
];
