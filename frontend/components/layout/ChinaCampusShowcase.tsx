'use client';

import { motion, useReducedMotion } from 'framer-motion';

const commonsImage = (fileName: string, width = 1600) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${width}`;

const IMAGES = {
  tsinghua: commonsImage('Main building of Tsinghua University.JPG'),
  peking: commonsImage('West gate of Peking University (20180418180213).jpg'),
  nanjing: commonsImage('Main building university of Nanking 2018.jpg'),
  tongji: commonsImage('Tongji University Library - Flickr - mripp.jpg'),
  wuhan: commonsImage('Administrative Building of Wuhan University.jpg'),
  wuhanSakura: commonsImage('Sakura Area in Wuhan University.jpg'),
  chineseStudents: commonsImage('Yuyendaxue campus students.jpg'),
  greatWall: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1600&q=85',
};

const PARTNERS = [
  { name: 'Đại học Thanh Hoa', cn: '清华大学', image: IMAGES.tsinghua },
  { name: 'Đại học Bắc Kinh', cn: '北京大学', image: IMAGES.peking },
  { name: 'Đại học Nam Kinh', cn: '南京大学', image: IMAGES.nanjing },
  { name: 'Đại học Đồng Tế', cn: '同济大学', image: IMAGES.tongji },
  { name: 'Đại học Vũ Hán', cn: '武汉大学', image: IMAGES.wuhan },
  { name: 'HSK · Chinese Test', cn: '汉语水平考试', image: IMAGES.chineseStudents },
];

const CAMPUS_GALLERY = [
  { src: IMAGES.tsinghua, title: 'Khuôn viên Đại học Thanh Hoa', tag: 'Tsinghua University', season: 'Thu' },
  { src: IMAGES.peking, title: 'Khuôn viên Đại học Bắc Kinh', tag: 'Peking University', season: 'Xuân' },
  { src: IMAGES.tongji, title: 'Thư viện Đại học Đồng Tế', tag: 'Tongji University', season: 'Đông' },
  { src: IMAGES.nanjing, title: 'Khuôn viên Đại học Nam Kinh', tag: 'Nanjing University', season: 'Thu' },
  { src: IMAGES.wuhanSakura, title: 'Hoa anh đào Đại học Vũ Hán', tag: 'Wuhan University', season: 'Xuân' },
  { src: IMAGES.chineseStudents, title: 'Sinh viên học tiếng Trung tại Bắc Kinh', tag: 'HSK · Tiếng Trung', season: 'Hè' },
  { src: IMAGES.greatWall, title: 'Tuyết phủ Vạn Lý Trường Thành', tag: 'Bắc Kinh', season: 'Đông' },
  { src: IMAGES.wuhan, title: 'Tòa nhà Đại học Vũ Hán', tag: 'Wuhan University', season: 'Quanh năm' },
] as const;

const SEASON_STYLES: Record<string, string> = {
  Xuân: 'bg-pink-100 text-pink-700 dark:bg-pink-900/70 dark:text-pink-200',
  Hè: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200',
  Thu: 'bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-200',
  Đông: 'bg-blue-100 text-blue-700 dark:bg-blue-900/70 dark:text-blue-200',
  'Quanh năm': 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied) return;
  image.dataset.fallbackApplied = 'true';
  image.src = IMAGES.greatWall;
}

function UniversityMarquee() {
  const reduceMotion = useReducedMotion();
  const items = [...PARTNERS, ...PARTNERS];

  return (
    <section aria-labelledby="partner-title" className="overflow-hidden border-y border-rose-100 bg-[#fff9f4] py-12 dark:border-rose-950/50 dark:bg-slate-900">
      <div className="mx-auto mb-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        <p id="partner-title" className="text-center text-xs font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
          Định hướng học tập và hồ sơ tới các trường đại học hàng đầu
        </p>
      </div>

      <div className="group relative w-full overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#fff9f4] to-transparent dark:from-slate-900 sm:w-24" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#fff9f4] to-transparent dark:from-slate-900 sm:w-24" />
        <motion.div
          className="flex w-max gap-4 sm:gap-6"
          animate={reduceMotion ? undefined : { x: ['0%', '-50%'] }}
          transition={{ x: { duration: 25, repeat: Infinity, ease: 'linear' } }}
          style={{ willChange: reduceMotion ? 'auto' : 'transform' }}
        >
          {items.map((item, index) => (
            <article key={`${item.name}-${index}`} className="group/card w-56 shrink-0 overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800 sm:w-64">
              <div className="relative h-36 overflow-hidden sm:h-40">
                <img src={item.image} alt={item.name} loading="lazy" onError={handleImageError} className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                <span className="absolute bottom-2 right-3 text-lg font-bold text-white/80">{item.cn}</span>
              </div>
              <div className="px-4 py-3 text-center text-sm font-bold text-slate-700 dark:text-slate-200">{item.name}</div>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function CampusGallery() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-gradient-to-b from-white via-rose-50/40 to-white px-4 py-24 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-rose-600 dark:text-amber-400">Trải nghiệm du học</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">Khám phá Trung Quốc qua bốn mùa</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400">
            Từ những khuôn viên đại học danh tiếng đến cảnh sắc thiên nhiên tuyệt đẹp, hành trình du học của bạn sẽ là trải nghiệm không thể nào quên.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {CAMPUS_GALLERY.map((item, index) => (
            <motion.article
              key={item.title}
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: index * 0.07 }}
              className={`group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-rose-950/10 dark:border-slate-800 dark:bg-slate-900 ${index === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}
            >
              <div className={`overflow-hidden ${index === 0 ? 'aspect-square' : 'aspect-[4/3]'}`}>
                <img src={item.src} alt={item.title} loading="lazy" onError={handleImageError} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-90" />
              </div>
              <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${SEASON_STYLES[item.season]}`}>{item.season}</span>
              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                <span className="mb-1 inline-block rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-sm">{item.tag}</span>
                <h3 className={`font-bold leading-tight text-white ${index === 0 ? 'text-lg sm:text-xl' : 'text-sm'}`}>{item.title}</h3>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ChinaCampusShowcase() {
  return (
    <>
      <UniversityMarquee />
      <CampusGallery />
    </>
  );
}
