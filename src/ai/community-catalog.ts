import { FacebookChannelRecommendation } from './ai.types';

export const CURATED_FACEBOOK_COMMUNITIES: FacebookChannelRecommendation[] = [
  // General & Nationwide
  {
    name: 'Facebook Marketplace Israel',
    url: 'https://www.facebook.com/marketplace/',
    language: 'HE',
    type: 'MARKETPLACE',
    description:
      'Основная витрина объявлений Facebook в Израиле с максимальным охватом покупателей.',
  },
  {
    name: 'Secret Tel Aviv',
    url: 'https://www.facebook.com/groups/secrettelaviv/',
    language: 'EN',
    type: 'CITY_COMMUNITY',
    description:
      'Крупнейшее англоязычное сообщество Израиля (450k+ участников) для быстрой продажи в центре страны.',
  },
  {
    name: 'Барахолка Израиль | Купи / Продай',
    url: 'https://www.facebook.com/groups/baraholka.israel/',
    language: 'RU',
    type: 'GENERAL_RESALE',
    description:
      'Популярная всеизраильская русскоязычная группа для любых категорий товаров.',
  },
  {
    name: 'Second Hand Israel יד 2 ישראל',
    url: 'https://www.facebook.com/groups/secondhand.israel/',
    language: 'HE',
    type: 'GENERAL_RESALE',
    description:
      'Общенациональная группа вторичного рынка на иврите с активными покупателями.',
  },
  {
    name: 'Покупка / Продажа в Израиле',
    url: 'https://www.facebook.com/groups/kuplyu.prodam.israel/',
    language: 'RU',
    type: 'GENERAL_RESALE',
    description:
      'Активная русскоязычная площадка для объявлений о продаже товаров и техники.',
  },

  // City & Regional
  {
    name: 'פשפשוק תל אביב (Pishpeshuk Tel Aviv)',
    url: 'https://www.facebook.com/groups/pishpeshuk.telaviv/',
    language: 'HE',
    type: 'CITY_COMMUNITY',
    description: 'Главная городская барахолка Тель-Авива и Гуш-Дана.',
  },
  {
    name: 'Барахолка Тель-Авив / Бат-Ям / Холон',
    url: 'https://www.facebook.com/groups/baraholka.tlv.batyam/',
    language: 'RU',
    type: 'CITY_COMMUNITY',
    description: 'Русскоязычное сообщество центрального региона Израиля.',
  },
  {
    name: 'פשפשוק חיפה והצפון (Pishpeshuk Haifa & North)',
    url: 'https://www.facebook.com/groups/pishpeshuk.haifa/',
    language: 'HE',
    type: 'CITY_COMMUNITY',
    description:
      'Крупнейшее сообщество купли-продажи в Хайфе и на севере Израиля.',
  },
  {
    name: 'Барахолка Хайфа и Крайот',
    url: 'https://www.facebook.com/groups/baraholka.haifa.krayot/',
    language: 'RU',
    type: 'CITY_COMMUNITY',
    description:
      'Локальная русскоязычная группа для жителей севера и побережья.',
  },
  {
    name: 'Secret Jerusalem',
    url: 'https://www.facebook.com/groups/secretjerusalem/',
    language: 'EN',
    type: 'CITY_COMMUNITY',
    description: 'Ведущее сообщество Иерусалима для объявлений и экспатов.',
  },
  {
    name: 'Барахолка Нетания и Шарон',
    url: 'https://www.facebook.com/groups/baraholka.netanya/',
    language: 'RU',
    type: 'CITY_COMMUNITY',
    description: 'Русскоязычные объявления в Нетании и округе Шарон.',
  },
  {
    name: 'Барахолка Юг Израиля / Беэр-Шева',
    url: 'https://www.facebook.com/groups/baraholka.south.israel/',
    language: 'RU',
    type: 'CITY_COMMUNITY',
    description: 'Объявления для южного округа и Беэр-Шевы.',
  },

  // Category Niches
  {
    name: 'פשפשוק גאдג׳טים ומחשבים (Electronics & Gadgets)',
    url: 'https://www.facebook.com/groups/pishpeshuk.gadgets/',
    language: 'HE',
    type: 'CATEGORY_NICHE',
    description:
      'Специализированная группа для электроники, смартфонов, ноутбуков и гаджетов.',
  },
  {
    name: 'Куплю / Продам Электронику в Израиле',
    url: 'https://www.facebook.com/groups/electronics.resale.israel/',
    language: 'RU',
    type: 'CATEGORY_NICHE',
    description:
      'Русскоязычная барахолка техники, бытовых приборов и аудио/видео.',
  },
  {
    name: 'פשפשוק ריהוט ומוצרים לבית (Furniture & Home)',
    url: 'https://www.facebook.com/groups/pishpeshuk.furniture/',
    language: 'HE',
    type: 'CATEGORY_NICHE',
    description: 'Профильная группа для мебели, предметов интерьера и декора.',
  },
  {
    name: 'Мебель и вещи для дома б/у в Израиле',
    url: 'https://www.facebook.com/groups/mebel.israel.secondhand/',
    language: 'RU',
    type: 'CATEGORY_NICHE',
    description: 'Быстрая продажа мебели при переезде и ремонте.',
  },
  {
    name: 'Детская барахолка Израиль (Baby & Kids)',
    url: 'https://www.facebook.com/groups/kids.baby.secondhand.israel/',
    language: 'RU',
    type: 'CATEGORY_NICHE',
    description: 'Коляски, детская одежда, автокресла и игрушки.',
  },
];

export function buildFacebookSearchUrl(query: string): string {
  return `https://www.facebook.com/groups/search/groups/?q=${encodeURIComponent(query)}`;
}

export function getRecommendedFacebookChannels(
  category?: string,
  city?: string,
): FacebookChannelRecommendation[] {
  const normalizedCategory = (category || '').toLowerCase();
  const normalizedCity = (city || '').toLowerCase();

  const matched: FacebookChannelRecommendation[] = [];

  // 1. Marketplace always first
  const marketplace = CURATED_FACEBOOK_COMMUNITIES.find(
    (c) => c.type === 'MARKETPLACE',
  );
  if (marketplace) matched.push(marketplace);

  // 2. City match if specified
  if (normalizedCity) {
    const cityMatches = CURATED_FACEBOOK_COMMUNITIES.filter(
      (c) =>
        c.type === 'CITY_COMMUNITY' &&
        (c.name.toLowerCase().includes(normalizedCity) ||
          c.description.toLowerCase().includes(normalizedCity) ||
          (normalizedCity.includes('тель') && c.name.includes('Tel Aviv')) ||
          (normalizedCity.includes('хайф') && c.name.includes('Haifa')) ||
          (normalizedCity.includes('иерусал') &&
            c.name.includes('Jerusalem')) ||
          (normalizedCity.includes('нетан') && c.name.includes('Нетания')) ||
          (normalizedCity.includes('беэр') && c.name.includes('Беэр-Шева'))),
    );
    for (const cm of cityMatches) {
      if (!matched.some((m) => m.url === cm.url)) {
        matched.push(cm);
      }
    }
  }

  // 3. Category niche match
  const isElectronics =
    normalizedCategory.includes('электрон') ||
    normalizedCategory.includes('телефон') ||
    normalizedCategory.includes('компьют') ||
    normalizedCategory.includes('гаджет') ||
    normalizedCategory.includes('ноутбук') ||
    normalizedCategory.includes('electronic');

  const isFurniture =
    normalizedCategory.includes('мебел') ||
    normalizedCategory.includes('диван') ||
    normalizedCategory.includes('стол') ||
    normalizedCategory.includes('шкаф') ||
    normalizedCategory.includes('furniture');

  const isKids =
    normalizedCategory.includes('детск') ||
    normalizedCategory.includes('коляск') ||
    normalizedCategory.includes('игрушк') ||
    normalizedCategory.includes('baby');

  const nicheMatches = CURATED_FACEBOOK_COMMUNITIES.filter((c) => {
    if (c.type !== 'CATEGORY_NICHE') return false;
    if (isElectronics && c.description.includes('электроник')) return true;
    if (isFurniture && c.description.includes('мебел')) return true;
    if (isKids && c.description.includes('детск')) return true;
    return false;
  });

  for (const nm of nicheMatches) {
    if (!matched.some((m) => m.url === nm.url)) {
      matched.push(nm);
    }
  }

  // 4. Fill with high-reputation general communities
  for (const comm of CURATED_FACEBOOK_COMMUNITIES) {
    if (!matched.some((m) => m.url === comm.url)) {
      matched.push(comm);
    }
    if (matched.length >= 5) break;
  }

  // 5. If city or category provided, synthesize a direct search URL as targeted option
  if (matched.length < 5 && (city || category)) {
    const searchTerms = [category, city, 'Israel'].filter(Boolean).join(' ');
    matched.push({
      name: `Поиск групп: "${searchTerms}"`,
      url: buildFacebookSearchUrl(searchTerms),
      language: 'RU',
      type: 'GENERAL_RESALE',
      description: `Прямой поиск релевантных групп в Facebook по запросу "${searchTerms}".`,
    });
  }

  return matched.slice(0, 5);
}
