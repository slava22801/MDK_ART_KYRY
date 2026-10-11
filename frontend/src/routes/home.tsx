import { Link } from "react-router";

/* ---------- Inline icons ---------- */

function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

/* ---------- Shared pieces ---------- */

function Footer() {
  return (
    <footer className="footer" aria-label="Подвал сайта">
      <div className="footer__contact-row">
        <div className="footer__brand">Арт-Кыры</div>
        <div className="footer__contact">
          +7 (495) 000-00-00
          <br />
          hello@art-kyry.example
        </div>
        <div className="footer__address">
          Москва, ул. Садовая, 12
          <br />
          Ежедневно · 12:00–23:00
        </div>
        <a
          href="https://t.me/"
          className="footer__social"
          target="_blank"
          rel="noreferrer"
        >
          Telegram ↗
        </a>
      </div>
      <div className="footer__legal">
        <span>© Арт-Кыры, 2026 · Концепт сайта</span>
        <span>
          Условия бронирования &nbsp;&nbsp;&nbsp; Политика конфиденциальности
        </span>
        <span>Контакты и цены — демонстрационные</span>
      </div>
    </footer>
  );
}

/* ---------- Hero (Architectural greeting) ---------- */

function Hero() {
  return (
    <section className="section section--cream hero two-col">
      <div className="hero__copy">
        <span className="eyebrow">01 / Минеральный · Ресторан Арт-Кыры</span>
        <h1 className="display display--xxl">Арт-Кыры</h1>
        <h2 className="display display--xl">
          Хороший вечер
          <br />
          начинается здесь.
        </h2>
        <p className="body-lead" style={{ width: 465 }}>
          Сезонная кухня, мягкий свет и время, которое принадлежит только вам.
          Добро пожаловать в Арт-Кыры.
        </p>
        <Link to="/reserve" className="btn-cta" style={{ alignSelf: "flex-start" }}>
          <span>Забронировать столик</span>
          <ArrowUpRight className="btn-cta__icon" />
        </Link>
        <p className="hero__address">
          Москва, ул. Садовая, 12 · Ежедневно 12:00–23:00
        </p>
      </div>
      <div className="hero__photo">
        <img
          src="/assets/hero-light.png"
          alt="Большой зал ресторана Арт-Кыры днём"
          loading="eager"
        />
      </div>
    </section>
  );
}

/* ---------- Story & Kitchen ---------- */

function Story() {
  return (
    <section className="section section--soft two-col two-col--story">
      <div className="story__heading">
        <span className="eyebrow">О ресторане / 01</span>
        <h2 className="display display--md">
          Вкус сезона.
          <br />
          Чувство места.
        </h2>
      </div>
      <div className="story__body">
        <p>
          Арт-Кыры — ресторан современной европейской кухни, где знакомые вкусы
          раскрываются по-новому. Мы соединяем сезонные продукты, понятные
          сочетания и внимание к каждой детали.
        </p>
        <p>
          Название отсылает к открытому пространству дома: месту встреч, света
          и гостеприимства. Приходите на обед, оставайтесь на долгий ужин —
          здесь у каждого вечера свой ритм.
        </p>
        <Link to="/menu" className="arrow-link">
          Познакомиться с меню ↗
        </Link>
      </div>
    </section>
  );
}

/* ---------- Menu & Featured dishes ---------- */

type Dish = {
  name: string;
  price: string;
  desc: string;
  weight: string;
  photo: string;
};

const FEATURED: Dish[] = [
  {
    name: "Тартар из говядины",
    price: "1 250 ₽",
    desc: "Каперсы, трюфельный айоли, хрустящий бриошь",
    weight: "160 г",
    photo: "/assets/dish-tartare.png",
  },
  {
    name: "Палтус с цветной капустой",
    price: "1 850 ₽",
    desc: "Крем из цветной капусты, beurre blanc, зелёное масло",
    weight: "280 г",
    photo: "/assets/dish-halibut.png",
  },
  {
    name: "Шоколадный фондан",
    price: "690 ₽",
    desc: "Тёплый шоколад, ванильное мороженое, ягоды",
    weight: "180 г",
    photo: "/assets/dish-fondant.png",
  },
];

const CATEGORIES = [
  {
    name: "Горячее ↗",
    desc: "Палтус, утиная грудка, ризотто с грибами",
    price: "от 980 ₽",
  },
  {
    name: "Напитки ↗",
    desc: "Авторские лимонады, чай, кофе, винная карта",
    price: "от 350 ₽",
  },
  {
    name: "Десерты ↗",
    desc: "Шоколадный фондан, тарт, сезонный сорбет",
    price: "от 490 ₽",
  },
];

function Menu() {
  return (
    <section className="section section--cream menu-section">
      <div className="menu-intro">
        <div className="menu-intro__heading">
          <span className="eyebrow">Меню и избранные блюда / 02</span>
          <h2 className="display display--md">Коллекция сезона</h2>
        </div>
      </div>

      <div className="dishes">
        {FEATURED.map((dish) => (
          <article key={dish.name} className="dish">
            <div className="dish__photo">
              <img src={dish.photo} alt={dish.name} loading="lazy" />
            </div>
            <div className="dish__head">
              <span className="dish__name">{dish.name}</span>
              <span className="dish__price">{dish.price}</span>
            </div>
            <p className="dish__desc">{dish.desc}</p>
            <p className="dish__weight">{dish.weight}</p>
          </article>
        ))}
      </div>

      <div className="menu-divider" />

      <div className="menu-cta-row">
        <h3 className="display display--sm">Продолжение — в меню</h3>
        <Link to="/menu" className="arrow-link">
          Открыть меню ↗
        </Link>
      </div>

      <div className="menu-categories">
        {CATEGORIES.map((cat) => (
          <article key={cat.name} className="menu-category">
            <h4 className="menu-category__name">{cat.name}</h4>
            <p className="menu-category__desc">{cat.desc}</p>
            <span className="menu-category__price">{cat.price}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- Interior ---------- */

function Interior() {
  return (
    <section className="section section--soft two-col two-col--interior">
      <div className="interior__photo">
        <img
          src="/assets/interior-light.png"
          alt="Интерьер ресторана Арт-Кыры"
          loading="lazy"
        />
      </div>
      <div className="interior__copy">
        <span className="eyebrow">Пространство / 04</span>
        <h2 className="display display--lg">
          Оставьте город
          <br />
          за дверью.
        </h2>
        <p className="body-text">
          Высокие окна, натуральный камень и мягкие кресла. Светлый зал днём,
          камерное пространство вечером — выберите своё любимое место.
        </p>
        <Link to="/contacts" className="arrow-link">
          Посмотреть интерьер ↗
        </Link>
      </div>
    </section>
  );
}

/* ---------- Booking rules ---------- */

function Booking() {
  return (
    <section className="section section--cream booking">
      <div className="booking__intro">
        <div className="booking__intro-heading">
          <span className="eyebrow">Ваш визит / 05</span>
          <h2 className="display display--md">Столик будет ждать вас</h2>
        </div>
        <Link to="/reserve" className="btn-cta">
          <span>Выбрать столик</span>
          <ArrowUpRight className="btn-cta__icon" />
        </Link>
      </div>

      <div className="booking__divider" />

      <div className="booking__rules">
        <article className="booking-rule">
          <span className="booking-rule__num">01</span>
          <h3 className="booking-rule__title">Выберите место</h3>
          <p className="booking-rule__desc">
            Дата, время и количество гостей. Свободные столики доступны на
            схеме зала даже без входа.
          </p>
        </article>
        <article className="booking-rule">
          <span className="booking-rule__num">02</span>
          <h3 className="booking-rule__title">Войдите и внесите предоплату</h3>
          <p className="booking-rule__desc">
            Для завершения брони нужен аккаунт. Обязательная предоплата — 1 500
            ₽ за гостя. Она учитывается в счёте, но не является полным счётом
            за заказ.
          </p>
        </article>
        <article className="booking-rule">
          <span className="booking-rule__num">03</span>
          <h3 className="booking-rule__title">Получите подтверждение</h3>
          <p className="booking-rule__desc">
            Стол удерживается 15 минут. Успешная оплата подтверждает бронь;
            неоплата за 15 минут отменяет её.
          </p>
        </article>
      </div>
    </section>
  );
}

/* ---------- Contacts ---------- */

function Contacts() {
  return (
    <section className="section section--card two-col two-col--contacts">
      <div className="contacts__copy">
        <span className="eyebrow">Встречаемся в Арт-Кыры / 06</span>
        <h2 className="display display--md">Ближе, чем кажется</h2>

        <div className="contacts__details">
          <div className="contacts__detail">
            <span className="contacts__detail-name">Москва, ул. Садовая, 12</span>
            <span className="contacts__detail-meta">
              5 минут от метро «Маяковская»
            </span>
            <a
              href="https://yandex.ru/maps/"
              className="contacts__detail-link"
              target="_blank"
              rel="noreferrer"
            >
              Построить маршрут ↗
            </a>
          </div>
          <div className="contacts__detail">
            <span className="contacts__detail-name">
              Ежедневно · 12:00–23:00
            </span>
            <span className="contacts__detail-meta">
              Кухня принимает заказы до 22:30
            </span>
          </div>
        </div>

        <a href="tel:+74950000000" className="contacts__phone">
          +7 (495) 000-00-00
        </a>
        <p className="contacts__email">
          hello@art-kyry.example · Для особых пожеланий к вашему визиту
        </p>
      </div>

      <div className="contacts__photo">
        <img
          src="/assets/contacts-light.png"
          alt="Вход в ресторан Арт-Кыры"
          loading="lazy"
        />
      </div>
    </section>
  );
}

/* ---------- Final invitation ---------- */

function FinalCta() {
  return (
    <section className="section section--accent two-col two-col--final">
      <div className="final__copy">
        <h2 className="lede">Увидимся за вашим столиком.</h2>
        <p className="final__sub">
          Для двоих, для близких, для вечера без повода.
        </p>
      </div>
      <Link to="/reserve" className="final__cta">
        <span>Забронировать столик</span>
        <ArrowUpRight className="final__cta-icon" />
      </Link>
    </section>
  );
}

/* ---------- Page ---------- */

export function HomePage() {
  return (
    <div className="home">
      <Hero />
      <Story />
      <Menu />
      <Interior />
      <Booking />
      <Contacts />
      <FinalCta />
      <Footer />
    </div>
  );
}