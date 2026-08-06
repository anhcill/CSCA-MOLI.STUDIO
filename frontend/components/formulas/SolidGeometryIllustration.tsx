export type SolidGeometryIllustrationKind = 'polyhedra' | 'round-solids' | 'spatial-relations' | 'oxyz';

const line = 'stroke-slate-700 dark:stroke-slate-200';
const hiddenLine = 'stroke-slate-400 dark:stroke-slate-500';
const accentLine = 'stroke-sky-600 dark:stroke-sky-300';
const guideLine = 'stroke-amber-500 dark:stroke-amber-300';
const label = 'fill-slate-700 text-[11px] font-bold dark:fill-slate-200';

function PolyhedraDiagram() {
  return (
    <svg viewBox="0 0 760 250" role="img" aria-labelledby="polyhedra-title polyhedra-desc" className="h-auto w-full">
      <title id="polyhedra-title">Lăng trụ và hình chóp</title>
      <desc id="polyhedra-desc">Minh họa diện tích đáy B, chiều cao vuông góc h và đường cao mặt bên l.</desc>
      <g fill="none" strokeWidth="2.5" strokeLinejoin="round">
        <path d="M55 177 L185 177 L235 137 L105 137 Z M55 177 L55 72 L185 72 L235 32 L105 32 Z M55 72 L105 32 M185 72 L235 32 M185 177 L185 72 M235 137 L235 32" className={line} />
        <path d="M55 177 L105 137 M105 137 L105 32" strokeDasharray="7 6" className={hiddenLine} />
        <path d="M78 170 L78 78" className={accentLine} />
        <path d="M78 170 h14 v-14" className={accentLine} />
        <path d="M55 188 Q145 210 235 148" className={guideLine} />

        <path d="M430 183 L615 183 L680 140 L495 140 Z M555 35 L430 183 M555 35 L615 183 M555 35 L680 140 M555 35 L495 140" className={line} />
        <path d="M555 35 L555 158" strokeDasharray="7 6" className={accentLine} />
        <path d="M555 158 L555 183 M555 158 h14 v14" className={accentLine} />
        <path d="M555 35 L647 162" className={guideLine} />
      </g>
      <g className={label}>
        <text x="42" y="63">Lăng trụ</text><text x="88" y="125">h</text><text x="132" y="205">B</text>
        <text x="420" y="27">Hình chóp</text><text x="568" y="104">h</text><text x="621" y="94">l</text><text x="548" y="211">B</text>
      </g>
    </svg>
  );
}

function RoundSolidsDiagram() {
  return (
    <svg viewBox="0 0 760 250" role="img" aria-labelledby="round-title round-desc" className="h-auto w-full">
      <title id="round-title">Khối trụ, khối nón và khối cầu</title>
      <desc id="round-desc">Minh họa bán kính R, chiều cao h và đường sinh l của các khối tròn xoay.</desc>
      <g fill="none" strokeWidth="2.5">
        <ellipse cx="115" cy="57" rx="68" ry="24" className={line} />
        <path d="M47 57 V184 M183 57 V184 M47 184 A68 24 0 0 0 183 184" className={line} />
        <path d="M47 184 A68 24 0 0 1 183 184" strokeDasharray="7 6" className={hiddenLine} />
        <path d="M115 57 V184 M115 184 H183" className={accentLine} />

        <ellipse cx="380" cy="184" rx="82" ry="27" className={line} />
        <path d="M298 184 A82 27 0 0 1 462 184" strokeDasharray="7 6" className={hiddenLine} />
        <path d="M380 29 L298 184 M380 29 L462 184 M380 29 V184 M380 184 H462" className={line} />
        <path d="M380 29 V184 M380 184 H462" className={accentLine} />
        <path d="M380 29 L462 184" className={guideLine} />

        <circle cx="625" cy="121" r="82" className={line} />
        <ellipse cx="625" cy="121" rx="82" ry="25" className={hiddenLine} strokeDasharray="7 6" />
        <path d="M625 121 H707" className={accentLine} />
        <circle cx="625" cy="121" r="4" className="fill-sky-600 dark:fill-sky-300" stroke="none" />
      </g>
      <g className={label}>
        <text x="79" y="25">Khối trụ</text><text x="125" y="124">h</text><text x="146" y="175">R</text>
        <text x="345" y="20">Khối nón</text><text x="392" y="110">h</text><text x="424" y="100">l</text><text x="418" y="176">R</text>
        <text x="591" y="25">Khối cầu</text><text x="663" y="112">R</text>
      </g>
    </svg>
  );
}

function SpatialRelationsDiagram() {
  return (
    <svg viewBox="0 0 760 250" role="img" aria-labelledby="relation-title relation-desc" className="h-auto w-full">
      <title id="relation-title">Góc và khoảng cách trong không gian</title>
      <desc id="relation-desc">Minh họa hình chiếu của đường thẳng lên mặt phẳng và đoạn vuông góc biểu diễn khoảng cách.</desc>
      <g fill="none" strokeWidth="2.5" strokeLinejoin="round">
        <path d="M42 190 L292 190 L365 120 L115 120 Z" className={line} />
        <path d="M155 42 L285 154" className={guideLine} />
        <path d="M155 42 L155 154 L285 154" className={accentLine} />
        <path d="M155 154 h14 v-14" className={accentLine} />
        <path d="M207 154 A52 52 0 0 1 246 120" className={guideLine} />

        <path d="M438 190 L688 190 L728 147 L478 147 Z" className={line} />
        <path d="M560 43 V168" className={accentLine} />
        <path d="M560 168 h16 v-16" className={accentLine} />
        <path d="M505 82 L640 82 M505 112 L640 112" className={line} />
        <path d="M590 82 V112" strokeDasharray="7 6" className={guideLine} />
      </g>
      <g className={label}>
        <text x="95" y="28">Góc đường thẳng – mặt phẳng</text><text x="166" y="96">h</text><text x="214" y="139">φ</text><text x="229" y="174">hình chiếu</text>
        <text x="485" y="28">Khoảng cách vuông góc</text><text x="570" y="135">d</text><text x="650" y="140">(P)</text>
      </g>
    </svg>
  );
}

function OxyzDiagram() {
  return (
    <svg viewBox="0 0 760 250" role="img" aria-labelledby="oxyz-title oxyz-desc" className="h-auto w-full">
      <title id="oxyz-title">Hệ tọa độ không gian Oxyz</title>
      <desc id="oxyz-desc">Minh họa ba trục vuông góc, điểm M và hình chiếu của M xuống mặt phẳng Oxy.</desc>
      <g fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M340 185 H680 M340 185 L130 224 M340 185 V30" className={line} />
        <path d="M680 185 l-13 -7 M680 185 l-13 7 M130 224 l14 -10 M130 224 l16 3 M340 30 l-7 14 M340 30 l7 14" className={line} />
        <path d="M340 185 L535 106 M535 106 V185" className={accentLine} />
        <path d="M535 106 L475 217 M535 185 L475 217" strokeDasharray="7 6" className={hiddenLine} />
        <path d="M535 185 h14 v-14" className={accentLine} />
        <circle cx="535" cy="106" r="5" className="fill-amber-500 dark:fill-amber-300" stroke="none" />
      </g>
      <g className={label}>
        <text x="688" y="190">x</text><text x="112" y="235">y</text><text x="348" y="30">z</text><text x="321" y="203">O</text>
        <text x="548" y="100">M(x, y, z)</text><text x="550" y="151">|z|</text><text x="485" y="235">M′(x, y, 0)</text>
      </g>
    </svg>
  );
}

export default function SolidGeometryIllustration({ kind }: { kind: SolidGeometryIllustrationKind }) {
  const diagram = kind === 'polyhedra'
    ? <PolyhedraDiagram />
    : kind === 'round-solids'
      ? <RoundSolidsDiagram />
      : kind === 'spatial-relations'
        ? <SpatialRelationsDiagram />
        : <OxyzDiagram />;

  return (
    <figure className="mb-5 overflow-hidden rounded-xl border border-sky-100 bg-gradient-to-br from-white via-sky-50/60 to-amber-50/60 p-3 dark:border-slate-700 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:p-5">
      {diagram}
      <figcaption className="mt-2 text-center text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
        Hình minh họa quy ước — các đoạn nét đứt là cạnh khuất hoặc đường chiếu.
      </figcaption>
    </figure>
  );
}
