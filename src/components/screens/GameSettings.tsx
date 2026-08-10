import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { DIFFICULTY_META, CATEGORY_META, BASE_CATEGORIES } from '../../types';
import type { DifficultySelection } from '../../types';

function OptionButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
        selected
          ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );
}

const PRESET_TIMERS = [30, 45, 60, 90, 120];

const CATEGORY_SLOT_COLORS = [
  { bg: '#EF4444', ring: 'ring-red-300' },
  { bg: '#3B82F6', ring: 'ring-blue-300' },
  { bg: '#22C55E', ring: 'ring-green-300' },
  { bg: '#A855F7', ring: 'ring-purple-300' },
  { bg: '#F59E0B', ring: 'ring-amber-300' },
  { bg: '#06B6D4', ring: 'ring-cyan-300' },
];

export function GameSettingsScreen() {
  const settings = useGameStore((s) => s.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const setPhase = useGameStore((s) => s.setPhase);
  const startGame = useGameStore((s) => s.startGame);
  const isLoadingCustomWords = useGameStore((s) => s.isLoadingCustomWords);

  const diffMeta = DIFFICULTY_META[settings.difficulty];
  const isPreset = PRESET_TIMERS.includes(settings.timerDuration);
  const [showCustomTimer, setShowCustomTimer] = useState(!isPreset);
  const [customValue, setCustomValue] = useState(String(isPreset ? 60 : settings.timerDuration));
  const [newCategory, setNewCategory] = useState('');

  const handleCustomTimerConfirm = () => {
    const val = Math.max(10, parseInt(customValue) || 60);
    setCustomValue(String(val));
    updateSettings({ timerDuration: val });
  };

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name || settings.customCategoryNames.length >= 6) return;
    if (settings.customCategoryNames.some((n) => n.toLowerCase() === name.toLowerCase())) return;
    updateSettings({ customCategoryNames: [...settings.customCategoryNames, name] });
    setNewCategory('');
  };

  const removeCategory = (index: number) => {
    updateSettings({
      customCategoryNames: settings.customCategoryNames.filter((_, i) => i !== index),
    });
  };

  const canStart = !settings.useCustomCategories || settings.customCategoryNames.length >= 2;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="min-h-[100dvh] flex flex-col p-6 max-w-lg mx-auto w-full"
    >
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoadingCustomWords && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex flex-col items-center justify-center gap-4"
          >
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-white text-lg font-semibold">Fetching words...</p>
            <p className="text-white/60 text-sm">Getting creative content from Wikipedia</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pt-8 pb-6">
        <button onClick={() => setPhase('team_setup')} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-6 inline-flex items-center gap-1 cursor-pointer">
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Configure your game</p>
      </div>

      <div className="flex-1 space-y-8">
        {/* Categories Mode */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Categories</h2>
          <div className="flex gap-2 mb-3">
            <OptionButton
              label="Standard"
              selected={!settings.useCustomCategories}
              onClick={() => updateSettings({ useCustomCategories: false })}
            />
            <OptionButton
              label="Custom"
              selected={settings.useCustomCategories}
              onClick={() => updateSettings({ useCustomCategories: true })}
            />
          </div>

          <AnimatePresence>
            {!settings.useCustomCategories && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex flex-wrap gap-1.5">
                  {BASE_CATEGORIES.map((cat) => {
                    const meta = CATEGORY_META[cat];
                    return (
                      <span
                        key={cat}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: meta.bg }}
                      >
                        {meta.label}
                      </span>
                    );
                  })}
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-gray-600">
                    Spade
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {settings.useCustomCategories && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Pick any categories — words are fetched from Wikipedia. Try niche ones!
                </p>

                {/* Current custom categories */}
                <div className="space-y-2">
                  {settings.customCategoryNames.map((name, i) => (
                    <motion.div
                      key={`${name}-${i}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: CATEGORY_SLOT_COLORS[i]?.bg || '#6B7280' }}
                      />
                      <div className="flex-1 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-white">
                        {name}
                      </div>
                      <button
                        onClick={() => removeCategory(i)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                      >
                        ✕
                      </button>
                    </motion.div>
                  ))}
                </div>

                {/* Spade (always included) */}
                <div className="flex items-center gap-2 opacity-60">
                  <div className="w-3 h-3 rounded-full shrink-0 bg-gray-500" />
                  <div className="flex-1 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Spade (always included)
                  </div>
                </div>

                {/* Add category input */}
                {settings.customCategoryNames.length < 6 && (
                  <div className="flex items-center gap-2 pt-1">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 opacity-40"
                      style={{ backgroundColor: CATEGORY_SLOT_COLORS[settings.customCategoryNames.length]?.bg || '#6B7280' }}
                    />
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                      placeholder="e.g. Types of Cheese, 90s Cartoons..."
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                    <button
                      onClick={addCategory}
                      disabled={!newCategory.trim()}
                      className="px-3 py-2 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      Add
                    </button>
                  </div>
                )}

                <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
                  {settings.customCategoryNames.length}/6 categories
                  {settings.customCategoryNames.length < 2 && ' · Add at least 2 to start'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Difficulty (hidden in custom mode since cards are generated) */}
        {!settings.useCustomCategories && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Difficulty</h2>
            <div className="flex flex-wrap gap-2 mb-2">
              {(['easy', 'normal', 'hard', 'expert', 'mixed'] as DifficultySelection[]).map((d) => (
                <OptionButton
                  key={d}
                  label={DIFFICULTY_META[d].label}
                  selected={settings.difficulty === d}
                  onClick={() => updateSettings({ difficulty: d })}
                />
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {diffMeta.description}
            </p>
          </section>
        )}

        {/* Timer */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Timer (seconds)</h2>
          <div className="flex flex-wrap gap-2">
            {PRESET_TIMERS.map((t) => (
              <OptionButton
                key={t}
                label={`${t}s`}
                selected={settings.timerDuration === t && !showCustomTimer}
                onClick={() => {
                  setShowCustomTimer(false);
                  updateSettings({ timerDuration: t });
                }}
              />
            ))}
            <OptionButton
              label="Custom"
              selected={showCustomTimer || !isPreset}
              onClick={() => setShowCustomTimer(true)}
            />
          </div>

          <AnimatePresence>
            {(showCustomTimer || !isPreset) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 flex items-center gap-2"
              >
                <input
                  type="number"
                  min={10}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onBlur={handleCustomTimerConfirm}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomTimerConfirm()}
                  className="w-24 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <span className="text-sm text-gray-400">seconds (min 10)</span>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Board Size */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Board Size</h2>
          <p className="text-xs text-gray-400 mb-2">Number of spaces around the board</p>
          <div className="flex flex-wrap gap-2">
            {[28, 35, 42, 49, 56].map((s) => (
              <OptionButton key={s} label={`${s} spaces`} selected={settings.boardSize === s} onClick={() => updateSettings({ boardSize: s })} />
            ))}
          </div>
        </section>

        {/* Sound */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Sound</h2>
          <div className="flex gap-2">
            <OptionButton label="On" selected={settings.soundEnabled} onClick={() => updateSettings({ soundEnabled: true })} />
            <OptionButton label="Off" selected={!settings.soundEnabled} onClick={() => updateSettings({ soundEnabled: false })} />
          </div>
        </section>
      </div>

      <div className="py-6">
        <Button onClick={startGame} size="xl" className="w-full" disabled={!canStart || isLoadingCustomWords}>
          {isLoadingCustomWords ? 'Loading...' : 'Start Game'}
        </Button>
      </div>
    </motion.div>
  );
}
