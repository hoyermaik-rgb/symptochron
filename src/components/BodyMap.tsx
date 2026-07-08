import React from 'react';

interface BodyMapProps {
  activeAreas: string[];
  onChange: (areas: string[]) => void;
  readOnly?: boolean;
}

interface Segment {
  key: string;
  label: string;
  type: 'circle' | 'rect';
  props: Record<string, any>;
}

export const AREA_LABELS: Record<string, string> = {
  // Front
  'front-head': 'Kopf (vorne)',
  'front-neck': 'Hals/Nacken (vorne)',
  'front-shoulder-l': 'Schulter (L, vorne)',
  'front-shoulder-r': 'Schulter (R, vorne)',
  'front-chest': 'Brust',
  'front-abdomen': 'Bauch',
  'front-arm-l': 'Arm (L, vorne)',
  'front-arm-r': 'Arm (R, vorne)',
  'front-hand-l': 'Hand (L, vorne)',
  'front-hand-r': 'Hand (R, vorne)',
  'front-hip-l': 'Hüfte (L)',
  'front-hip-r': 'Hüfte (R)',
  'front-leg-l': 'Bein (L, vorne)',
  'front-leg-r': 'Bein (R, vorne)',
  'front-foot-l': 'Fuß (L, vorne)',
  'front-foot-r': 'Fuß (R, vorne)',
  // Back
  'back-head': 'Hinterkopf',
  'back-neck': 'Nacken (hinten)',
  'back-shoulder-l': 'Schulter (L, hinten)',
  'back-shoulder-r': 'Schulter (R, hinten)',
  'back-upper': 'Oberer Rücken',
  'back-lower': 'Unterer Rücken',
  'back-arm-l': 'Arm (L, hinten)',
  'back-arm-r': 'Arm (R, hinten)',
  'back-hand-l': 'Hand (L, hinten)',
  'back-hand-r': 'Hand (R, hinten)',
  'back-glute': 'Gesäß',
  'back-leg-l': 'Bein (L, hinten)',
  'back-leg-r': 'Bein (R, hinten)',
  'back-foot-l': 'Fuß (L, hinten)',
  'back-foot-r': 'Fuß (R, hinten)'
};

export default function BodyMap({ activeAreas = [], onChange, readOnly = false }: BodyMapProps) {
  const frontSegments: Segment[] = [
    { key: 'front-head', label: 'Kopf', type: 'circle', props: { cx: 50, cy: 15, r: 10 } },
    { key: 'front-neck', label: 'Hals', type: 'rect', props: { x: 46, y: 25, width: 8, height: 6, rx: 1 } },
    { key: 'front-shoulder-l', label: 'Schulter L', type: 'rect', props: { x: 22, y: 32, width: 9, height: 10, rx: 3 } },
    { key: 'front-shoulder-r', label: 'Schulter R', type: 'rect', props: { x: 69, y: 32, width: 9, height: 10, rx: 3 } },
    { key: 'front-chest', label: 'Brust', type: 'rect', props: { x: 32, y: 32, width: 36, height: 24, rx: 2 } },
    { key: 'front-abdomen', label: 'Bauch', type: 'rect', props: { x: 34, y: 57, width: 32, height: 20, rx: 2 } },
    { key: 'front-arm-l', label: 'Arm L', type: 'rect', props: { x: 19, y: 43, width: 10, height: 34, rx: 4 } },
    { key: 'front-arm-r', label: 'Arm R', type: 'rect', props: { x: 71, y: 43, width: 10, height: 34, rx: 4 } },
    { key: 'front-hand-l', label: 'Hand L', type: 'rect', props: { x: 18, y: 78, width: 12, height: 10, rx: 3 } },
    { key: 'front-hand-r', label: 'Hand R', type: 'rect', props: { x: 70, y: 78, width: 12, height: 10, rx: 3 } },
    { key: 'front-hip-l', label: 'Hüfte L', type: 'rect', props: { x: 34, y: 78, width: 15, height: 12, rx: 2 } },
    { key: 'front-hip-r', label: 'Hüfte R', type: 'rect', props: { x: 51, y: 78, width: 15, height: 12, rx: 2 } },
    { key: 'front-leg-l', label: 'Bein L', type: 'rect', props: { x: 34, y: 91, width: 13, height: 50, rx: 4 } },
    { key: 'front-leg-r', label: 'Bein R', type: 'rect', props: { x: 53, y: 91, width: 13, height: 50, rx: 4 } },
    { key: 'front-foot-l', label: 'Fuß L', type: 'rect', props: { x: 31, y: 142, width: 16, height: 8, rx: 2 } },
    { key: 'front-foot-r', label: 'Fuß R', type: 'rect', props: { x: 53, y: 142, width: 16, height: 8, rx: 2 } },
  ];

  const backSegments: Segment[] = [
    { key: 'back-head', label: 'Hinterkopf', type: 'circle', props: { cx: 50, cy: 15, r: 10 } },
    { key: 'back-neck', label: 'Nacken', type: 'rect', props: { x: 46, y: 25, width: 8, height: 6, rx: 1 } },
    { key: 'back-shoulder-l', label: 'Schulter L', type: 'rect', props: { x: 22, y: 32, width: 9, height: 10, rx: 3 } },
    { key: 'back-shoulder-r', label: 'Schulter R', type: 'rect', props: { x: 69, y: 32, width: 9, height: 10, rx: 3 } },
    { key: 'back-upper', label: 'Oberer Rücken', type: 'rect', props: { x: 32, y: 32, width: 36, height: 24, rx: 2 } },
    { key: 'back-lower', label: 'Unterer Rücken', type: 'rect', props: { x: 34, y: 57, width: 32, height: 20, rx: 2 } },
    { key: 'back-arm-l', label: 'Arm L', type: 'rect', props: { x: 19, y: 43, width: 10, height: 34, rx: 4 } },
    { key: 'back-arm-r', label: 'Arm R', type: 'rect', props: { x: 71, y: 43, width: 10, height: 34, rx: 4 } },
    { key: 'back-hand-l', label: 'Hand L', type: 'rect', props: { x: 18, y: 78, width: 12, height: 10, rx: 3 } },
    { key: 'back-hand-r', label: 'Hand R', type: 'rect', props: { x: 70, y: 78, width: 12, height: 10, rx: 3 } },
    { key: 'back-glute', label: 'Gesäß', type: 'rect', props: { x: 34, y: 78, width: 32, height: 12, rx: 3 } },
    { key: 'back-leg-l', label: 'Bein L', type: 'rect', props: { x: 34, y: 91, width: 13, height: 50, rx: 4 } },
    { key: 'back-leg-r', label: 'Bein R', type: 'rect', props: { x: 53, y: 91, width: 13, height: 50, rx: 4 } },
    { key: 'back-foot-l', label: 'Fuß L', type: 'rect', props: { x: 31, y: 142, width: 16, height: 8, rx: 2 } },
    { key: 'back-foot-r', label: 'Fuß R', type: 'rect', props: { x: 53, y: 142, width: 16, height: 8, rx: 2 } },
  ];

  const handleToggle = (key: string) => {
    if (readOnly) return;
    if (activeAreas.includes(key)) {
      onChange(activeAreas.filter(a => a !== key));
    } else {
      onChange([...activeAreas, key]);
    }
  };

  const renderShape = (segment: Segment) => {
    const isActive = activeAreas.includes(segment.key);
    const classes = `cursor-pointer transition-all duration-200 stroke-[1.2px] hover:scale-105 origin-center ${
      isActive 
        ? 'fill-rose-500/80 stroke-rose-600 drop-shadow-[0_2px_8px_rgba(239,68,68,0.4)]' 
        : 'fill-slate-800/80 stroke-slate-700 hover:fill-slate-750 hover:stroke-slate-500'
    }`;

    if (segment.type === 'circle') {
      return (
        <circle
          key={segment.key}
          {...(segment.props as React.SVGProps<SVGCircleElement>)}
          className={classes}
          onClick={() => handleToggle(segment.key)}
        >
          <title>{AREA_LABELS[segment.key] || segment.label}</title>
        </circle>
      );
    } else {
      return (
        <rect
          key={segment.key}
          {...(segment.props as React.SVGProps<SVGRectElement>)}
          className={classes}
          onClick={() => handleToggle(segment.key)}
        >
          <title>{AREA_LABELS[segment.key] || segment.label}</title>
        </rect>
      );
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
      {/* Front */}
      <div className="flex flex-col items-center">
        <span className="text-xs font-semibold text-slate-400 mb-2.5 uppercase tracking-wide">Vorderseite</span>
        <svg
          viewBox="0 0 100 160"
          className="w-36 h-56 bg-slate-950/45 border border-slate-800 rounded-3xl p-3 shadow-inner"
        >
          {frontSegments.map(renderShape)}
        </svg>
      </div>

      {/* Back */}
      <div className="flex flex-col items-center">
        <span className="text-xs font-semibold text-slate-400 mb-2.5 uppercase tracking-wide">Rückseite</span>
        <svg
          viewBox="0 0 100 160"
          className="w-36 h-56 bg-slate-950/45 border border-slate-800 rounded-3xl p-3 shadow-inner"
        >
          {backSegments.map(renderShape)}
        </svg>
      </div>

      {/* Mini Legend for Selection */}
      {!readOnly && (
        <div className="flex flex-wrap sm:flex-col items-start gap-2 max-w-xs sm:max-h-56 overflow-y-auto pr-1">
          {activeAreas.length === 0 ? (
            <span className="text-xs text-slate-500 italic p-2 text-center sm:text-left w-full">
              Klicke Körpersegmente an, um Schmerzbereiche zu protokollieren.
            </span>
          ) : (
            <>
              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider px-2">Erfasst:</div>
              {activeAreas.map(key => (
                <div
                  key={key}
                  className="flex items-center gap-2 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs"
                >
                  <span className="h-2 w-2 rounded-full bg-rose-500 shadow-md shadow-rose-500/50" />
                  <span className="text-slate-300 font-medium">{AREA_LABELS[key]}</span>
                  <button
                    type="button"
                    onClick={() => handleToggle(key)}
                    className="text-[10px] text-rose-400 hover:text-rose-200 ml-1 font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
