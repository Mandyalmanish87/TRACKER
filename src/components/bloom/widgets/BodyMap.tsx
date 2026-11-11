import React, { useId } from 'react';

const zones = [
  {
    name: 'Head',
    path: 'M130 15 Q113 18 104 34 L101 52 Q101 67 107 78 L94 94 Q86 105 90 114 Q96 122 112 127 L130 130 L142 130 L159 127 Q176 122 190 114 Q200 108 196 99 L178 76 Q184 61 181 43 Q178 24 163 18 Q146 12 130 15 Z',
  },
  {
    name: 'Chest',
    path: 'M101 129 Q121 122 140 128 Q160 122 178 131 L190 140 L197 165 L185 170 L181 207 L194 241 L178 248 L162 235 L159 260 L108 260 L105 237 L91 250 L77 241 L88 205 L84 165 L79 158 L83 142 Z',
  },
  {
    name: 'Abdomen',
    path: 'M82 242 Q105 255 132 258 L159 258 Q176 254 188 242 L191 279 Q181 292 171 307 L103 307 Q94 292 78 279 Z',
  },
  {
    name: 'Pelvis',
    path: 'M78 278 Q102 293 122 301 L158 301 Q176 291 191 278 L189 319 Q177 333 162 348 L112 348 Q97 334 78 319 Z',
  },
  {
    name: 'Left arm',
    path: 'M82 143 Q76 148 76 164 L72 204 Q69 220 74 238 L76 259 L83 280 L89 303 Q92 311 98 308 L96 287 L88 260 L84 239 L96 208 L101 176 L96 155 Z',
  },
  {
    name: 'Right arm',
    path: 'M184 143 Q194 148 200 164 L212 205 Q220 222 216 239 L209 261 L200 282 L194 304 Q191 312 185 307 L187 286 L197 258 L202 239 L190 207 L180 175 Z',
  },
  {
    name: 'Left leg',
    path: 'M105 343 Q124 351 144 348 L141 431 L133 505 L129 550 L132 571 L125 588 L112 588 L108 576 L110 553 L105 505 L100 450 L91 383 Z',
  },
  {
    name: 'Right leg',
    path: 'M145 348 Q164 350 182 339 L189 381 L184 450 L180 505 L183 550 L179 574 L174 589 L160 589 L155 572 L158 552 L154 505 L146 432 Z',
  },
] as const;

interface BodyMapProps {
  selected: string[];
  onSelectZone: (zone: string) => void;
}

export const BodyMap: React.FC<BodyMapProps> = ({ selected, onSelectZone }) => {
  const maskId = `bloom-body-mask-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const toggleZone = (zone: string) => onSelectZone(zone);

  return (
    <div className="bloom-body-map-wrap">
      <div className="bloom-body-figure-panel">
        <div className="bloom-body-figure" role="group" aria-label="Select body areas for today’s check-in">
          <img className="bloom-body-illustration" src="/images/bloom/body-relief-figure.png" alt="Illustration of a person, shown from the front" />
          <svg className="bloom-body-map" viewBox="0 0 324 624" role="group" aria-label="Tap a body area to select it">
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="324" height="624" style={{ maskType: 'alpha' }}>
                <image href="/images/bloom/body-relief-figure.png" x="0" y="0" width="324" height="624" />
              </mask>
            </defs>
            <g mask={`url(#${maskId})`}>
            {zones.map(({ name, path }) => {
              const isSelected = selected.includes(name);
              return (
                <path
                  key={name}
                  className={`bloom-body-hit-area${isSelected ? ' is-selected' : ''}`}
                  d={path}
                  role="button"
                  tabIndex={0}
                  aria-label={`${name}${isSelected ? ', selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => toggleZone(name)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleZone(name);
                    }
                  }}
                />
              );
            })}
            </g>
          </svg>
        </div>
        <span className="bloom-body-figure-caption">Front view · tap an area</span>
      </div>

      <div className="bloom-body-zone-list" role="group" aria-label="Body areas">
        {zones.map(({ name }) => {
          const isSelected = selected.includes(name);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={isSelected}
              className={isSelected ? 'selected' : ''}
              onClick={() => toggleZone(name)}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
};
